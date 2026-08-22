// scene/player — first-person movement + look (SRS-SCN-3x).
// KeyboardEvent.code based, arrows always parallel, Q/E yaw + R/F pitch keyboard look,
// constant velocity with <=80ms input ramp (R-2 v1.2), collision against walkable AABBs.

import { Box3, Euler, PerspectiveCamera, Vector3 } from 'three';
import type { AppState, Settings } from '../types';
import { LOOK_RAD_PER_PX, MOVE_SPEED_MPS } from '../core/settings';

const INPUT_RAMP_S = 0.08; // <=80ms ramp — the redefined "smoothness" (RFP R-2 v1.2)
const KEY_LOOK_RAD_PER_S = (90 * Math.PI) / 180; // 90 deg/s (SRS-SCN-31)
const PITCH_LIMIT = Math.PI / 2 - 0.05;
const PLAYER_RADIUS = 0.35;

export class Player {
  readonly camera: PerspectiveCamera;
  private keys = new Set<string>();
  private yaw = 0;
  private pitch = 0;
  private mouseDx = 0;
  private mouseDy = 0;
  private smoothBufX: number[] = [];
  private smoothBufY: number[] = [];
  private vel = new Vector3();
  private walkables: Box3[] = [];
  private obstacles: Box3[] = [];
  private bobPhase = 0;
  private enabled = false;
  private settings: Settings | null = null;
  private baseY = 1.65;

  constructor(camera: PerspectiveCamera) {
    this.camera = camera;
    document.addEventListener('keydown', (e) => this.onKey(e, true));
    document.addEventListener('keyup', (e) => this.onKey(e, false));
    document.addEventListener('mousemove', (e) => this.onMouse(e));
    addEventListener('blur', () => this.keys.clear());
  }

  setWalkables(w: Box3[], obstacles: Box3[] = []): void {
    this.walkables = w;
    this.obstacles = obstacles;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) this.keys.clear();
  }

  private lastVFov = 0;

  applySettings(s: Settings): void {
    this.settings = s;
    this.syncFov();
  }

  /**
   * settings.fov is a HORIZONTAL fov (industry convention, GAG "monitor 90°");
   * three.js camera.fov is VERTICAL — convert per current aspect. 90°h at 16:9 ≈ 59°v.
   * (Feeding 90 straight into camera.fov caused a fisheye looking-up feel.)
   */
  private syncFov(): void {
    const s = this.settings;
    if (!s) return;
    const hRad = (s.fov * Math.PI) / 180;
    const vRad = 2 * Math.atan(Math.tan(hRad / 2) / this.camera.aspect);
    const vDeg = (vRad * 180) / Math.PI;
    if (Math.abs(vDeg - this.lastVFov) > 0.01) {
      this.lastVFov = vDeg;
      this.camera.fov = vDeg;
      this.camera.updateProjectionMatrix();
    }
  }

  teleport(pos: Vector3, yaw = 0): void {
    this.camera.position.copy(pos);
    this.baseY = pos.y;
    this.yaw = yaw;
    this.pitch = 0;
    this.syncRotation();
  }

  get position(): Vector3 {
    return this.camera.position;
  }

  /** True while any movement key is held (used to fade corridor hints). */
  get isMoving(): boolean {
    return this.vel.lengthSq() > 0.01;
  }

  private onKey(e: KeyboardEvent, down: boolean): void {
    // IME guard (SRS-SCN-30): composing events must not drive movement.
    if (e.isComposing || e.keyCode === 229) return;
    if (down) this.keys.add(e.code);
    else this.keys.delete(e.code);
  }

  private onMouse(e: MouseEvent): void {
    if (!this.enabled || !document.pointerLockElement) return;
    this.mouseDx += e.movementX;
    this.mouseDy += e.movementY;
  }

  update(dt: number, appState: AppState): void {
    const s = this.settings;
    if (!s) return;
    this.syncFov(); // re-derive vertical fov when aspect changes (resize)

    if (this.enabled && !appState.scene.paused && !appState.scene.transitioning) {
      this.updateLook(dt, s, appState.sys.pointerLocked);
      this.updateMove(dt, s);
    } else {
      this.vel.multiplyScalar(Math.max(0, 1 - dt / INPUT_RAMP_S));
    }
  }

  private updateLook(dt: number, s: Settings, locked: boolean): void {
    let dx = this.mouseDx;
    let dy = this.mouseDy;
    this.mouseDx = 0;
    this.mouseDy = 0;

    if (s.mouseSmoothing) {
      // 3-frame moving average (SRS-COR-21 mapping)
      this.smoothBufX.push(dx);
      this.smoothBufY.push(dy);
      if (this.smoothBufX.length > 3) this.smoothBufX.shift();
      if (this.smoothBufY.length > 3) this.smoothBufY.shift();
      dx = this.smoothBufX.reduce((a, b) => a + b, 0) / this.smoothBufX.length;
      dy = this.smoothBufY.reduce((a, b) => a + b, 0) / this.smoothBufY.length;
    }

    if (locked) {
      this.yaw -= dx * LOOK_RAD_PER_PX * s.sensitivityX;
      const dir = s.invertY ? -1 : 1;
      this.pitch -= dy * LOOK_RAD_PER_PX * s.sensitivityY * dir;
    }

    // Keyboard look — always available (WCAG 2.1.1; SRS-SCN-31 incl. vertical R/F).
    const k = this.keys;
    if (k.has('KeyQ')) this.yaw += KEY_LOOK_RAD_PER_S * dt;
    if (k.has('KeyE')) this.yaw -= KEY_LOOK_RAD_PER_S * dt;
    if (k.has('KeyR')) this.pitch += KEY_LOOK_RAD_PER_S * dt;
    if (k.has('KeyF')) this.pitch -= KEY_LOOK_RAD_PER_S * dt;

    this.pitch = Math.min(PITCH_LIMIT, Math.max(-PITCH_LIMIT, this.pitch));
    this.syncRotation();
  }

  private syncRotation(): void {
    this.camera.quaternion.setFromEuler(new Euler(this.pitch, this.yaw, 0, 'YXZ'));
  }

  private updateMove(dt: number, s: Settings): void {
    const k = this.keys;
    const fwd = (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) - (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0);
    const strafe = (k.has('KeyD') || k.has('ArrowRight') ? 1 : 0) - (k.has('KeyA') || k.has('ArrowLeft') ? 1 : 0);

    const speed = MOVE_SPEED_MPS[s.moveSpeed];
    const target = new Vector3(strafe, 0, -fwd);
    if (target.lengthSq() > 0) target.normalize().multiplyScalar(speed);
    target.applyEuler(new Euler(0, this.yaw, 0, 'YXZ'));

    // Constant-velocity model with a short ramp toward the target (no acceleration curve).
    const alpha = Math.min(1, dt / INPUT_RAMP_S);
    this.vel.lerp(target, alpha);

    if (this.vel.lengthSq() < 1e-6) {
      this.applyBob(0, s);
      return;
    }

    const pos = this.camera.position;
    const step = this.vel.clone().multiplyScalar(dt);
    // Axis-separated slide against the walkable union (SRS-SCN-22).
    const tryMove = (dx: number, dz: number): void => {
      const next = new Vector3(pos.x + dx, this.baseY, pos.z + dz);
      if (this.isWalkable(next)) {
        pos.x = next.x;
        pos.z = next.z;
      }
    };
    tryMove(step.x, 0);
    tryMove(0, step.z);

    this.bobPhase += this.vel.length() * dt * 2.2;
    this.applyBob(s.headBob, s);
  }

  private applyBob(amount: number, _s: Settings): void {
    // headBob default 0 (comfort). 1.0 = 0.03m amplitude synced to stride (SRS-COR-21).
    const offset = amount > 0 ? Math.sin(this.bobPhase * Math.PI) * 0.03 * amount : 0;
    this.camera.position.y = this.baseY + offset;
  }

  private isWalkable(p: Vector3): boolean {
    for (const o of this.obstacles) {
      if (p.x >= o.min.x && p.x <= o.max.x && p.z >= o.min.z && p.z <= o.max.z) return false;
    }
    for (const box of this.walkables) {
      if (
        p.x >= box.min.x + PLAYER_RADIUS - 0.5 &&
        p.x <= box.max.x - PLAYER_RADIUS + 0.5 &&
        p.z >= box.min.z &&
        p.z <= box.max.z &&
        p.x >= box.min.x &&
        p.x <= box.max.x
      ) {
        // radius check against x walls only where box is authoritative
        if (p.x >= box.min.x + PLAYER_RADIUS && p.x <= box.max.x - PLAYER_RADIUS) return true;
      }
    }
    return false;
  }
}
