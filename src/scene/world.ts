// scene/world — procedural corridor + hall (placeholder art within SRS-SCN-2x constraints).
// DEV NOTE: real art arrives at M1 as GLB with the SRS-SCN-24 naming convention
// (SPAWN_corridor / SPAWN_hall / TRIGGER_hallEntry / BOUNDS_viewing). This module builds the
// same logical anchors procedurally so the rest of the app already consumes the contract.
// v2 (사용자 피드백): colonnade, ceiling beams, corridor ribs, fog, dust motes in the light
// beam, viewing benches, entry portal — grandeur pass on the placeholder space (R-4).

import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  Box3,
  BufferGeometry,
  CanvasTexture,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Points,
  PointsMaterial,
  PointLight,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  Vector3,
} from 'three';

/** Procedural tile texture: visible grout grid + per-tile tonal variation so the
 *  floor reads as a floor (user feedback: floor was indistinguishable from walls). */
function makeTileTexture(tilePx = 128, tiles = 4, base = '#1c1712', grout = '#060504'): CanvasTexture {
  const size = tilePx * tiles;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d')!;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const jitter = ((tx * 7 + ty * 13) % 5) * 4 - 8; // deterministic tone variation
      g.fillStyle = shade(base, jitter);
      g.fillRect(tx * tilePx, ty * tilePx, tilePx, tilePx);
      // subtle inner sheen gradient per tile
      const gr = g.createLinearGradient(tx * tilePx, ty * tilePx, tx * tilePx, (ty + 1) * tilePx);
      gr.addColorStop(0, 'rgba(255,220,180,0.05)');
      gr.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = gr;
      g.fillRect(tx * tilePx, ty * tilePx, tilePx, tilePx);
    }
  }
  g.strokeStyle = grout;
  g.lineWidth = Math.max(2, tilePx * 0.04);
  for (let i = 0; i <= tiles; i++) {
    g.beginPath();
    g.moveTo(i * tilePx, 0);
    g.lineTo(i * tilePx, size);
    g.moveTo(0, i * tilePx);
    g.lineTo(size, i * tilePx);
    g.stroke();
  }
  const tex = new CanvasTexture(cv);
  tex.wrapS = RepeatWrapping;
  tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function shade(hex: string, delta: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number): number => Math.min(255, Math.max(0, v));
  const r = clamp(((n >> 16) & 255) + delta);
  const g = clamp(((n >> 8) & 255) + delta);
  const b = clamp((n & 255) + delta);
  return `rgb(${r},${g},${b})`;
}

// v3 (사용자 피드백): corridor 40→24m + normal speed 2.0 m/s → 도보 ~12초.
// 천장 6→4.2m — 사람 스케일 복도에서 18m 홀로 열리는 대비가 웅장함을 키운다.
export const CORRIDOR_LENGTH = 24;
export const CORRIDOR_WIDTH = 4;
export const CORRIDOR_HEIGHT = 4.2;
export const HALL_WIDTH = 44;
export const HALL_DEPTH = 30;
export const HALL_HEIGHT = 18;
export const SCREEN_WIDTH = 30; // (legacy flat-screen constant — video mode aspect)
export const SCREEN_HEIGHT = 12.5;
export const EYE_HEIGHT = 1.65;
// v4 (사용자 결정): 스크린은 단일 평면이 아니라 입구를 제외한 홀 벽면 전체(ㄷ자+뒷벽
// 세그먼트) — 직교 벽면 그대로, 원통 곡면 아님. 파노라마는 벽 둘레를 따라 이어진다.
export const BAND_BOTTOM = 0.5; // screen band vertical extent on the walls
export const BAND_TOP = 14.0;

export interface WorldAnchors {
  spawnCorridor: Vector3;
  spawnHall: Vector3;
  triggerHallEntry: Box3;
  boundsViewing: Box3;
  viewingMaxDistance: number;
}

/** One wall-screen segment of the surrounding panorama (SRS-SCN v4).
 *  Pano distance for a world point P: dot(P.xz, dir) + base — continuous across walls. */
export interface ScreenSurface {
  mesh: Mesh;
  dir: [number, number]; // path direction in xz
  base: number;
  isFront: boolean;
}

export interface World {
  root: Group;
  anchors: WorldAnchors;
  walkables: Box3[];
  /** Solid obstacles inside walkable areas (columns, benches). */
  obstacles: Box3[];
  /** Front (main) screen — video target, positional-audio anchor, spill sampling. */
  screenMesh: Mesh;
  /** All wall-screen segments incl. the front, with panorama mapping. */
  screenSurfaces: ScreenSurface[];
  /** Total panorama path length + sun position along it (metres). */
  panorama: { totalLen: number; sunDist: number; bandBottom: number; bandHeight: number };
  spillLights: PointLight[];
  setBgAnimation(level: number): void;
  update(dt: number): void;
}

export function buildWorld(scene: Scene): World {
  const root = new Group();
  root.name = 'world';

  // Warm dark fog gives the hall depth and makes light beams readable.
  // (0.014 → 0.008: distant geometry was vanishing — "잘려 보인다" feedback.)
  scene.fog = new FogExp2(0x0c0906, 0.008);

  const wallMat = new MeshStandardMaterial({ color: 0x171310, roughness: 0.92, metalness: 0.02 });
  const columnMat = new MeshStandardMaterial({ color: 0x1e1813, roughness: 0.85, metalness: 0.05 });
  // Floors are textured tiles — clearly distinct from walls, slight sheen catches
  // the screen spill so the ground plane reads (공간감).
  const hallFloorTex = makeTileTexture(128, 4, '#221b14', '#070605');
  hallFloorTex.repeat.set(HALL_WIDTH / 2.4, HALL_DEPTH / 2.4);
  const hallFloorMat = new MeshStandardMaterial({
    map: hallFloorTex,
    roughness: 0.45,
    metalness: 0.2,
  });
  const corrFloorTex = makeTileTexture(128, 2, '#1d1712', '#070605');
  corrFloorTex.repeat.set(CORRIDOR_WIDTH / 1.6, CORRIDOR_LENGTH / 1.6);
  const corrFloorMat = new MeshStandardMaterial({
    map: corrFloorTex,
    roughness: 0.5,
    metalness: 0.15,
  });
  const darkMat = new MeshStandardMaterial({ color: 0x090807, roughness: 1 });
  const benchMat = new MeshStandardMaterial({ color: 0x2b2218, roughness: 0.75 });

  const obstacles: Box3[] = [];

  const addBox = (
    w: number, h: number, d: number,
    x: number, y: number, z: number,
    mat: MeshStandardMaterial,
    solid = false,
  ): Mesh => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    root.add(m);
    if (solid) {
      obstacles.push(new Box3(
        new Vector3(x - w / 2 - 0.25, 0, z - d / 2 - 0.25),
        new Vector3(x + w / 2 + 0.25, 3, z + d / 2 + 0.25),
      ));
    }
    return m;
  };

  const hallZ0 = -CORRIDOR_LENGTH;
  const hallZc = hallZ0 - HALL_DEPTH / 2;
  const screenZ = hallZ0 - HALL_DEPTH + 0.35;

  // ---------------- Corridor ----------------
  const cw = CORRIDOR_WIDTH / 2;
  // Paneled walls — visible texture so motion parallax reads while walking.
  const corrWallTex = makeTileTexture(128, 2, '#2a2018', '#0a0806');
  corrWallTex.repeat.set(CORRIDOR_LENGTH / 2.1, CORRIDOR_HEIGHT / 2.1);
  const corrWallMat = new MeshStandardMaterial({ map: corrWallTex, roughness: 0.85, metalness: 0.03 });
  addBox(0.3, CORRIDOR_HEIGHT, CORRIDOR_LENGTH, -cw - 0.15, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2, corrWallMat);
  addBox(0.3, CORRIDOR_HEIGHT, CORRIDOR_LENGTH, cw + 0.15, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2, corrWallMat);
  addBox(CORRIDOR_WIDTH + 0.6, 0.3, CORRIDOR_LENGTH, 0, CORRIDOR_HEIGHT + 0.15, -CORRIDOR_LENGTH / 2, darkMat);
  addBox(CORRIDOR_WIDTH + 0.6, 0.3, CORRIDOR_LENGTH, 0, -0.15, -CORRIDOR_LENGTH / 2, corrFloorMat);
  addBox(CORRIDOR_WIDTH + 0.6, CORRIDOR_HEIGHT, 0.3, 0, CORRIDOR_HEIGHT / 2, 0.15, wallMat);

  // Rhythmic ribs (every 4m) — cadence + depth cues.
  for (let i = 1; i <= 5; i++) {
    const z = (-CORRIDOR_LENGTH * i) / 6;
    addBox(0.22, CORRIDOR_HEIGHT, 0.45, -cw + 0.11, CORRIDOR_HEIGHT / 2, z, columnMat);
    addBox(0.22, CORRIDOR_HEIGHT, 0.45, cw - 0.11, CORRIDOR_HEIGHT / 2, z, columnMat);
    addBox(CORRIDOR_WIDTH, 0.22, 0.45, 0, CORRIDOR_HEIGHT - 0.11, z, columnMat);
  }
  // Wall sconces: visible warm fixtures at eye-ish height — bright anchors that make
  // the walk legible in the dark (사용자 피드백: 가는지도 모르겠음).
  const sconceGlowMat = new MeshBasicMaterial({ color: 0xffc37f });
  for (let i = 0; i <= 5; i++) {
    const z = -2 - (CORRIDOR_LENGTH - 4) * (i / 5);
    for (const side of [-1, 1]) {
      const fixture = new Mesh(new BoxGeometry(0.06, 0.5, 0.12), sconceGlowMat);
      fixture.position.set(side * (cw - 0.05), 1.9, z);
      root.add(fixture);
      const glow = new PointLight(0xffb37a, 0.9, 7, 1.8);
      glow.position.set(side * (cw - 0.35), 1.9, z);
      root.add(glow);
    }
  }
  // Center floor guide line running the whole corridor toward the hall.
  const corrGuide = new Mesh(
    new PlaneGeometry(0.1, CORRIDOR_LENGTH - 1),
    new MeshBasicMaterial({ color: 0x8a5526, transparent: true, opacity: 0.6 }),
  );
  corrGuide.rotation.x = -Math.PI / 2;
  corrGuide.position.set(0, 0.013, -CORRIDOR_LENGTH / 2);
  root.add(corrGuide);

  // ---------------- Hall shell ----------------
  const hw = HALL_WIDTH / 2;
  addBox(0.4, HALL_HEIGHT, HALL_DEPTH, -hw - 0.2, HALL_HEIGHT / 2, hallZc, wallMat);
  addBox(0.4, HALL_HEIGHT, HALL_DEPTH, hw + 0.2, HALL_HEIGHT / 2, hallZc, wallMat);
  addBox(HALL_WIDTH + 0.8, 0.4, HALL_DEPTH, 0, HALL_HEIGHT + 0.2, hallZc, darkMat);
  addBox(HALL_WIDTH + 0.8, 0.4, HALL_DEPTH, 0, -0.2, hallZc, hallFloorMat);
  // Dim aisle guide strips on the floor, leading the eye (and feet) to the screen.
  for (const gx of [-CORRIDOR_WIDTH / 2 + 0.3, CORRIDOR_WIDTH / 2 - 0.3]) {
    const strip = new Mesh(
      new PlaneGeometry(0.12, HALL_DEPTH - 4),
      new MeshBasicMaterial({ color: 0x66401f, transparent: true, opacity: 0.5 }),
    );
    strip.rotation.x = -Math.PI / 2;
    strip.position.set(gx, 0.012, hallZc);
    root.add(strip);
  }
  addBox(HALL_WIDTH + 0.8, HALL_HEIGHT, 0.4, 0, HALL_HEIGHT / 2, hallZ0 - HALL_DEPTH - 0.2, wallMat);
  const doorHalf = CORRIDOR_WIDTH / 2 + 0.2;
  const segW = (HALL_WIDTH - CORRIDOR_WIDTH) / 2;
  addBox(segW, HALL_HEIGHT, 0.4, -(doorHalf + segW / 2), HALL_HEIGHT / 2, hallZ0 + 0.2, wallMat);
  addBox(segW, HALL_HEIGHT, 0.4, doorHalf + segW / 2, HALL_HEIGHT / 2, hallZ0 + 0.2, wallMat);
  addBox(CORRIDOR_WIDTH + 0.4, HALL_HEIGHT - CORRIDOR_HEIGHT, 0.4, 0, CORRIDOR_HEIGHT + (HALL_HEIGHT - CORRIDOR_HEIGHT) / 2, hallZ0 + 0.2, wallMat);

  // Entry portal frame — the doorway reads as a threshold, heightens arrival.
  addBox(0.8, CORRIDOR_HEIGHT + 1.2, 1.2, -(doorHalf + 0.4), (CORRIDOR_HEIGHT + 1.2) / 2, hallZ0, columnMat, true);
  addBox(0.8, CORRIDOR_HEIGHT + 1.2, 1.2, doorHalf + 0.4, (CORRIDOR_HEIGHT + 1.2) / 2, hallZ0, columnMat, true);
  addBox(doorHalf * 2 + 1.6, 0.8, 1.2, 0, CORRIDOR_HEIGHT + 1.0, hallZ0, columnMat);

  // Colonnade along both side walls — columns silhouette against the glowing wall
  // screens behind them, giving strong depth. (Wall sconces removed — walls are screens.)
  for (let i = 0; i < 5; i++) {
    const z = hallZ0 - 4 - i * 5.5;
    addBox(1.1, HALL_HEIGHT, 1.1, -hw + 2.2, HALL_HEIGHT / 2, z, columnMat, true);
    addBox(1.1, HALL_HEIGHT, 1.1, hw - 2.2, HALL_HEIGHT / 2, z, columnMat, true);
  }

  // Ceiling beams — coffered depth overhead.
  for (let i = 0; i < 6; i++) {
    const z = hallZ0 - 2.5 - i * 5;
    addBox(HALL_WIDTH, 0.9, 0.7, 0, HALL_HEIGHT - 0.45, z, darkMat);
  }
  for (const x of [-HALL_WIDTH / 3, 0, HALL_WIDTH / 3]) {
    addBox(0.7, 0.9, HALL_DEPTH, x, HALL_HEIGHT - 0.9, hallZc, darkMat);
  }

  // Viewing benches — two staggered rows; places to settle without blocking the view.
  for (const [bx, bz] of [
    [-7, hallZ0 - 9], [7, hallZ0 - 9],
    [-11, hallZ0 - 15], [0, hallZ0 - 15.5], [11, hallZ0 - 15],
  ] as Array<[number, number]>) {
    addBox(4.6, 0.45, 1.1, bx, 0.225, bz, benchMat, true);
  }

  // ---------------- Surrounding wall screens (v4 — 사용자 결정) ----------------
  // Panorama path (clockwise from the door's right edge, viewer inside):
  //   backR → right wall → front wall → left wall → backL. Door stays open.
  const bandH = BAND_TOP - BAND_BOTTOM;
  const bandY = BAND_BOTTOM + bandH / 2;
  const inset = 0.18; // screens sit just inside the structural walls
  const backSeg = hw - doorHalf;
  const sideLen = HALL_DEPTH;
  const frontLen = HALL_WIDTH;
  const totalLen = backSeg * 2 + sideLen * 2 + frontLen;
  const sunDist = backSeg + sideLen + frontLen / 2;

  const placeholderMat = (): MeshStandardMaterial =>
    new MeshStandardMaterial({ color: 0x000000, roughness: 1 });

  const screenSurfaces: ScreenSurface[] = [];
  const addScreen = (
    w: number,
    pos: Vector3,
    rotY: number,
    dir: [number, number],
    pathStart: number,
    edgeXZ: [number, number],
    isFront = false,
  ): Mesh => {
    const m = new Mesh(new PlaneGeometry(w, bandH), placeholderMat());
    m.position.copy(pos);
    m.rotation.y = rotY;
    m.name = isFront ? 'SCREEN' : 'SCREEN_SIDE';
    root.add(m);
    const base = pathStart - (edgeXZ[0] * dir[0] + edgeXZ[1] * dir[1]);
    screenSurfaces.push({ mesh: m, dir, base, isFront });
    return m;
  };

  // back-right segment (door edge → right corner), inner face looks -z
  addScreen(
    backSeg,
    new Vector3(doorHalf + backSeg / 2, bandY, hallZ0 - inset),
    Math.PI,
    [1, 0],
    0,
    [doorHalf, hallZ0],
  );
  // right wall (back → front), inner face looks -x
  addScreen(
    sideLen,
    new Vector3(hw - inset, bandY, hallZc),
    -Math.PI / 2,
    [0, -1],
    backSeg,
    [hw, hallZ0],
  );
  // front wall (right → left), inner face looks +z — the main/video screen
  const screenMesh = addScreen(
    frontLen,
    new Vector3(0, bandY, hallZ0 - HALL_DEPTH + inset),
    0,
    [-1, 0],
    backSeg + sideLen,
    [hw, hallZ0 - HALL_DEPTH],
    true,
  );
  // left wall (front → back), inner face looks +x
  addScreen(
    sideLen,
    new Vector3(-hw + inset, bandY, hallZc),
    Math.PI / 2,
    [0, 1],
    backSeg + sideLen + frontLen,
    [-hw, hallZ0 - HALL_DEPTH],
  );
  // back-left segment (left corner → door edge), inner face looks -z
  addScreen(
    backSeg,
    new Vector3(-(doorHalf + backSeg / 2), bandY, hallZ0 - inset),
    Math.PI,
    [1, 0],
    backSeg + sideLen + frontLen + sideLen,
    [-hw, hallZ0],
  );

  // Thin dark sill under the band so the screens read as installed surfaces.
  addBox(HALL_WIDTH, BAND_BOTTOM, 0.25, 0, BAND_BOTTOM / 2, hallZ0 - HALL_DEPTH + 0.3, darkMat);

  // ---------------- Lighting ----------------
  root.add(new AmbientLight(0x241a12, 0.8));
  // Low grazing light across the hall floor so the tile grid is legible.
  const floorWash = new SpotLight(0x8a5a30, 1.2, 55, Math.PI / 2.4, 0.8, 1.4);
  floorWash.position.set(0, 6, hallZ0 - 2);
  floorWash.target.position.set(0, 0, screenZ + 8);
  root.add(floorWash, floorWash.target);
  const hallGlow = new SpotLight(0x40281a, 1.8, 70, Math.PI / 2.6, 0.6, 1.1);
  hallGlow.position.set(0, HALL_HEIGHT - 2, hallZc + 6);
  hallGlow.target.position.set(0, 2, screenZ);
  root.add(hallGlow, hallGlow.target);

  const spillLights: PointLight[] = [];
  for (const x of [-HALL_WIDTH / 4, 0, HALL_WIDTH / 4]) {
    const l = new PointLight(0xff8844, 0, 60, 1.5);
    l.position.set(x, HALL_HEIGHT / 2, hallZ0 - HALL_DEPTH + 7);
    spillLights.push(l);
    root.add(l);
  }

  // ---------------- Dust motes in the projection light ----------------
  const DUST = 500;
  const positions = new Float32Array(DUST * 3);
  const speeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    positions[i * 3] = (Math.random() - 0.5) * HALL_WIDTH * 0.8;
    positions[i * 3 + 1] = Math.random() * HALL_HEIGHT * 0.85;
    positions[i * 3 + 2] = hallZ0 - 2 - Math.random() * (HALL_DEPTH - 4);
    speeds[i] = 0.05 + Math.random() * 0.12;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const dustMat = new PointsMaterial({
    color: 0xffcf9a,
    size: 0.045,
    transparent: true,
    opacity: 0.35,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  const dust = new Points(dustGeo, dustMat);
  root.add(dust);

  scene.add(root);

  // ---------------- Anchors & movement volumes ----------------
  const margin = 0.5;
  const walkCorridor = new Box3(
    new Vector3(-cw + margin, 0, -CORRIDOR_LENGTH - 1),
    new Vector3(cw - margin, 3, -margin),
  );
  const walkHall = new Box3(
    new Vector3(-hw + margin, 0, hallZ0 - HALL_DEPTH + 2.5),
    new Vector3(hw - margin, 3, hallZ0 - margin),
  );
  const boundsViewing = walkHall.clone();
  const viewingMaxDistance = new Vector3(HALL_WIDTH, 0, HALL_DEPTH).length();

  const anchors: WorldAnchors = {
    spawnCorridor: new Vector3(0, EYE_HEIGHT, -2),
    spawnHall: new Vector3(0, EYE_HEIGHT, hallZ0 - 4),
    triggerHallEntry: new Box3(
      new Vector3(-doorHalf, 0, hallZ0 - 2),
      new Vector3(doorHalf, 3, hallZ0 + 0.5),
    ),
    boundsViewing,
    viewingMaxDistance,
  };

  let bgLevel = 0.6;
  let dustTime = 0;

  return {
    root,
    anchors,
    walkables: [walkCorridor, walkHall],
    obstacles,
    screenMesh,
    screenSurfaces,
    panorama: { totalLen, sunDist, bandBottom: BAND_BOTTOM, bandHeight: bandH },
    spillLights,
    setBgAnimation(level: number): void {
      bgLevel = level;
      hallGlow.intensity = 1.2 + level * 1.0;
      dustMat.opacity = 0.1 + level * 0.4; // comfort: low bgAnimation calms the motes
    },
    update(dt: number): void {
      // Slow upward drift with wrap — quiet, continuous, flash-free.
      dustTime += dt;
      const arr = dustGeo.getAttribute('position');
      const speedScale = 0.4 + bgLevel * 0.8;
      for (let i = 0; i < DUST; i++) {
        let y = arr.getY(i) + speeds[i]! * dt * speedScale;
        const sway = Math.sin(dustTime * 0.3 + i) * 0.02 * dt;
        if (y > HALL_HEIGHT * 0.9) y = 0.2;
        arr.setY(i, y);
        arr.setX(i, arr.getX(i) + sway);
      }
      arr.needsUpdate = true;
    },
  };
}
