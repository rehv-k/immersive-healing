// scene/world — procedural corridor + elliptical immersive hall (SRS-SCN-2x, v5).
// v5 (사용자 방향 전환 2026-09-06): the hall is an ELLIPSE whose whole wall — except the
// entrance — is one continuous screen (국립중앙박물관 실감1관 파노라마·아르떼뮤지엄 참조,
// 조사 K). The floor and ceiling are glossy and reflect the panorama analytically (no
// extra render pass — SRS-SCN-26). Columns/beams are gone: nothing may stand between the
// viewer and the wall. Real art still arrives at M1 as GLB with the SRS-SCN-24 anchors.

import {
  AdditiveBlending,
  AmbientLight,
  BoxGeometry,
  Box3,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  EllipseCurve,
  Float32BufferAttribute,
  FogExp2,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NearestFilter,
  Object3D,
  PlaneGeometry,
  Points,
  PointsMaterial,
  PointLight,
  RepeatWrapping,
  RGFormat,
  Scene,
  Shape,
  ShapeGeometry,
  SpotLight,
  SRGBColorSpace,
  UnsignedByteType,
  Vector3,
  type ShaderMaterial,
} from 'three';
import {
  BAND_BOTTOM,
  BAND_TOP,
  DOOR_HALF_WIDTH,
  HALL_A,
  HALL_B,
  HALL_CEILING,
  buildArcLut,
  buildArcTable,
  buildRibbon,
  insideEllipse,
  panoramaLength,
  sunArc as sunArcOf,
  thetaAtClockwiseArc,
} from './hallGeometry';
import { createReflectiveMaterial } from './surfaces';
import type { SkyUniforms } from './skyShader';
import type { MediaUniforms } from './panoMedia';

export { BAND_BOTTOM, BAND_TOP, HALL_A, HALL_B, HALL_CEILING } from './hallGeometry';

/** Procedural tile texture for the corridor (hall floor is the reflective shader). */
function makeTileTexture(tilePx = 128, tiles = 4, base = '#1c1712', grout = '#060504'): CanvasTexture {
  const size = tilePx * tiles;
  const cv = document.createElement('canvas');
  cv.width = size;
  cv.height = size;
  const g = cv.getContext('2d')!;
  for (let ty = 0; ty < tiles; ty++) {
    for (let tx = 0; tx < tiles; tx++) {
      const jitter = ((tx * 7 + ty * 13) % 5) * 4 - 8;
      g.fillStyle = shade(base, jitter);
      g.fillRect(tx * tilePx, ty * tilePx, tilePx, tilePx);
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

/** Soft radial sprite so dust motes read as light, not squares. */
function makeSoftSprite(): CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 32;
  cv.height = 32;
  const g = cv.getContext('2d')!;
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return new CanvasTexture(cv);
}

function shade(hex: string, delta: number): string {
  const n = parseInt(hex.slice(1), 16);
  const clamp = (v: number): number => Math.min(255, Math.max(0, v));
  const r = clamp(((n >> 16) & 255) + delta);
  const g = clamp(((n >> 8) & 255) + delta);
  const b = clamp((n & 255) + delta);
  return `rgb(${r},${g},${b})`;
}

// 24 -> 12 (사용자 결정 2026-09-11: 홀까지 걸어가는 시간이 길다). 2.0 m/s 기준 ≈5초.
export const CORRIDOR_LENGTH = 12;
export const CORRIDOR_WIDTH = 4;
export const CORRIDOR_HEIGHT = 4.2;
export const EYE_HEIGHT = 1.65;
/** Front (video-capable) ribbon length centred on the sun, metres of arc. */
const FRONT_ARC_LEN = 24;

export interface WalkRegion {
  contains(x: number, z: number): boolean;
}

export interface WorldAnchors {
  spawnCorridor: Vector3;
  spawnHall: Vector3;
  triggerHallEntry: Box3;
  boundsViewing: Box3;
  viewingMaxDistance: number;
}

/** One ribbon of the surrounding screen. The panorama arc is the `aArc` vertex attribute. */
export interface ScreenSurface {
  mesh: Mesh;
  isFront: boolean;
}

export interface AudioAnchors {
  front: Object3D;
  left: Object3D;
  right: Object3D;
  backLeft: Object3D;
  backRight: Object3D;
}

export interface World {
  root: Group;
  anchors: WorldAnchors;
  walkRegions: WalkRegion[];
  obstacles: Box3[];
  screenMesh: Mesh;
  screenSurfaces: ScreenSurface[];
  panorama: { panoLen: number; sunArc: number; bandBottom: number; bandHeight: number; frontArcLen: number; perimeter: number; center: [number, number]; startBearing: number; nearWallDistance: number };
  spillLights: PointLight[];
  audioAnchors: AudioAnchors;
  /** Reflective floor + ceiling share the sky uniforms with the screen. */
  reflectiveMaterials: ShaderMaterial[];
  setBgAnimation(level: number): void;
  /** Optional breathing-rhythm light on the floor around the viewer (SRS-COR-25). */
  setBreath(centerX: number, centerZ: number, amount: number): void;
  /** Dust mote tint follows the sky (warm by day, cool at night). */
  setDustColor(r: number, g: number, b: number): void;
  setReflectionQuality(taps: number, ceilingOn: boolean): void;
  update(dt: number): void;
}

export function buildWorld(scene: Scene, sky: SkyUniforms, media: MediaUniforms): World {
  const root = new Group();
  root.name = 'world';

  scene.fog = new FogExp2(0x0b0806, 0.007);

  const wallMat = new MeshStandardMaterial({ color: 0x171310, roughness: 0.92, metalness: 0.02 });
  const columnMat = new MeshStandardMaterial({ color: 0x1e1813, roughness: 0.85, metalness: 0.05 });
  const corrFloorTex = makeTileTexture(128, 2, '#1d1712', '#070605');
  corrFloorTex.repeat.set(CORRIDOR_WIDTH / 1.6, CORRIDOR_LENGTH / 1.6);
  const corrFloorMat = new MeshStandardMaterial({ map: corrFloorTex, roughness: 0.5, metalness: 0.15 });
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

  const hallZ0 = -CORRIDOR_LENGTH; // door apex (+z apex of the ellipse)
  const hallZc = hallZ0 - HALL_B; // ellipse centre
  const cx = 0;
  const cz = hallZc;

  // ---------------- Corridor (unchanged from v3) ----------------
  const cw = CORRIDOR_WIDTH / 2;
  const corrWallTex = makeTileTexture(128, 2, '#2a2018', '#0a0806');
  corrWallTex.repeat.set(CORRIDOR_LENGTH / 2.1, CORRIDOR_HEIGHT / 2.1);
  const corrWallMat = new MeshStandardMaterial({ map: corrWallTex, roughness: 0.85, metalness: 0.03 });
  addBox(0.3, CORRIDOR_HEIGHT, CORRIDOR_LENGTH, -cw - 0.15, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2, corrWallMat);
  addBox(0.3, CORRIDOR_HEIGHT, CORRIDOR_LENGTH, cw + 0.15, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2, corrWallMat);
  addBox(CORRIDOR_WIDTH + 0.6, 0.3, CORRIDOR_LENGTH, 0, CORRIDOR_HEIGHT + 0.15, -CORRIDOR_LENGTH / 2, darkMat);
  addBox(CORRIDOR_WIDTH + 0.6, 0.3, CORRIDOR_LENGTH, 0, -0.15, -CORRIDOR_LENGTH / 2, corrFloorMat);
  addBox(CORRIDOR_WIDTH + 0.6, CORRIDOR_HEIGHT, 0.3, 0, CORRIDOR_HEIGHT / 2, 0.15, wallMat);
  for (let i = 1; i <= 5; i++) {
    const z = (-CORRIDOR_LENGTH * i) / 6;
    addBox(0.22, CORRIDOR_HEIGHT, 0.45, -cw + 0.11, CORRIDOR_HEIGHT / 2, z, columnMat);
    addBox(0.22, CORRIDOR_HEIGHT, 0.45, cw - 0.11, CORRIDOR_HEIGHT / 2, z, columnMat);
    addBox(CORRIDOR_WIDTH, 0.22, 0.45, 0, CORRIDOR_HEIGHT - 0.11, z, columnMat);
  }
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
  const corrGuide = new Mesh(
    new PlaneGeometry(0.1, CORRIDOR_LENGTH - 1),
    new MeshBasicMaterial({ color: 0x8a5526, transparent: true, opacity: 0.6 }),
  );
  corrGuide.rotation.x = -Math.PI / 2;
  corrGuide.position.set(0, 0.013, -CORRIDOR_LENGTH / 2);
  root.add(corrGuide);

  // Entry portal frame — the threshold between the human-scale corridor and the hall.
  addBox(0.8, CORRIDOR_HEIGHT + 1.2, 1.2, -(DOOR_HALF_WIDTH + 0.4), (CORRIDOR_HEIGHT + 1.2) / 2, hallZ0, columnMat, true);
  addBox(0.8, CORRIDOR_HEIGHT + 1.2, 1.2, DOOR_HALF_WIDTH + 0.4, (CORRIDOR_HEIGHT + 1.2) / 2, hallZ0, columnMat, true);
  addBox(DOOR_HALF_WIDTH * 2 + 1.6, 0.8, 1.2, 0, CORRIDOR_HEIGHT + 1.0, hallZ0, columnMat);

  // ---------------- Elliptical hall shell ----------------
  const table = buildArcTable(HALL_A, HALL_B);
  const panoLen = panoramaLength(table);
  const sunArc = sunArcOf(table);
  const bandH = BAND_TOP - BAND_BOTTOM;
  // The hall owns the panorama metrics; every sky material reads them from the shared uniforms.
  sky.uBandH!.value = bandH;
  sky.uSunArc!.value = sunArc;
  sky.uPanoLen!.value = panoLen;

  const ribbonMesh = (arcStart: number, arcEnd: number, yBottom: number, yTop: number, mat: MeshStandardMaterial | null, name: string): Mesh => {
    const r = buildRibbon(table, arcStart, arcEnd, cx, cz, yBottom, yTop);
    const geo = new BufferGeometry();
    geo.setAttribute('position', new BufferAttribute(r.positions, 3));
    geo.setAttribute('uv', new BufferAttribute(r.uvs, 2));
    geo.setAttribute('aArc', new BufferAttribute(r.arcs, 1));
    geo.setIndex(new BufferAttribute(r.indices, 1));
    geo.computeVertexNormals();
    const m = new Mesh(geo, mat ?? new MeshStandardMaterial({ color: 0x000000, roughness: 1 }));
    m.name = name;
    m.frustumCulled = false;
    root.add(m);
    return m;
  };

  // Screen band: right ribbon → front (video-capable) → left ribbon. Continuous arc.
  const frontStart = sunArc - FRONT_ARC_LEN / 2;
  const frontEnd = sunArc + FRONT_ARC_LEN / 2;
  const screenSurfaces: ScreenSurface[] = [
    { mesh: ribbonMesh(0, frontStart, BAND_BOTTOM, BAND_TOP, null, 'SCREEN_SIDE'), isFront: false },
    { mesh: ribbonMesh(frontStart, frontEnd, BAND_BOTTOM, BAND_TOP, null, 'SCREEN'), isFront: true },
    { mesh: ribbonMesh(frontEnd, panoLen, BAND_BOTTOM, BAND_TOP, null, 'SCREEN_SIDE'), isFront: false },
  ];
  const screenMesh = screenSurfaces[1]!.mesh;
  // Dark sill below and wall above the band close the shell.
  ribbonMesh(0, panoLen, -0.05, BAND_BOTTOM, darkMat, 'SILL');
  ribbonMesh(0, panoLen, BAND_TOP, HALL_CEILING + 0.05, wallMat, 'WALL_UPPER');

  // Floor + ceiling: elliptical discs with the analytic reflection material.
  const arcLut = new DataTexture(buildArcLut(table), 1024, 1, RGFormat, UnsignedByteType);
  arcLut.minFilter = NearestFilter;
  arcLut.magFilter = NearestFilter;
  arcLut.needsUpdate = true;
  const startAngle = thetaAtClockwiseArc(table, 0);
  const commonRefl = {
    sky,
    media,
    arcLut,
    center: [cx, cz] as [number, number],
    axes: [HALL_A, HALL_B] as [number, number],
    perimeter: table.perimeter,
    panoStart: startAngle,
    bandBottom: BAND_BOTTOM,
    bandTop: BAND_TOP,
  };
  const floorMat = createReflectiveMaterial({ ...commonRefl, planeY: 0, normalSign: 1, gloss: 0.75, base: [0.03, 0.026, 0.022] });
  const ceilMat = createReflectiveMaterial({ ...commonRefl, planeY: HALL_CEILING, normalSign: -1, gloss: 0.3, base: [0.012, 0.011, 0.01] });
  const ellipseShape = new Shape(new EllipseCurve(0, 0, HALL_A, HALL_B, 0, Math.PI * 2, false, 0).getPoints(128));
  const floor = new Mesh(new ShapeGeometry(ellipseShape, 8), floorMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(cx, 0, cz);
  floor.name = 'FLOOR';
  root.add(floor);
  const ceiling = new Mesh(new ShapeGeometry(ellipseShape, 8), ceilMat);
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(cx, HALL_CEILING, cz);
  ceiling.name = 'CEILING';
  root.add(ceiling);
  // Bridge floor under the door so the corridor tiles meet the hall disc.
  // It must not be COPLANAR with either neighbour: the corridor floor (top y=0, z∈[−L,0])
  // and the hall disc (y=0) both reach this threshold, and three surfaces sharing y=0
  // produced the flickering black/tile stripes reported 2026-09-11. So the bridge now
  // (a) starts exactly at the door line instead of overlapping the corridor slab and
  // (b) sits 1 cm lower, letting the hall disc win wherever they overlap.
  const BRIDGE_DEPTH = 1.6;
  const BRIDGE_DROP = 0.01;
  addBox(
    DOOR_HALF_WIDTH * 2 + 1.6, 0.3, BRIDGE_DEPTH,
    0, -0.15 - BRIDGE_DROP, hallZ0 - BRIDGE_DEPTH / 2,
    corrFloorMat,
  );

  // Viewing benches — low, centred, never between the viewer and the wall.
  for (const [bx, bz] of [[-5.5, cz + 1.5], [5.5, cz + 1.5], [0, cz - 3]] as Array<[number, number]>) {
    addBox(4.2, 0.42, 0.9, bx, 0.21, bz, benchMat, true);
  }

  // ---------------- Lighting ----------------
  root.add(new AmbientLight(0x241a12, 0.55));
  const hallGlow = new SpotLight(0x40281a, 1.2, 40, Math.PI / 2.6, 0.6, 1.1);
  hallGlow.position.set(0, HALL_CEILING - 0.5, cz);
  hallGlow.target.position.set(0, 0, cz);
  root.add(hallGlow, hallGlow.target);
  const spillLights: PointLight[] = [];
  for (const x of [-HALL_A * 0.5, 0, HALL_A * 0.5]) {
    const l = new PointLight(0xff8844, 0, 45, 1.5);
    l.position.set(x, 3.5, cz - HALL_B * 0.55);
    spillLights.push(l);
    root.add(l);
  }

  // ---------------- Audio anchors on the wall ----------------
  const anchorAt = (theta: number, y = 2.5): Object3D => {
    const o = new Object3D();
    o.position.set(cx + HALL_A * 0.92 * Math.cos(theta), y, cz + HALL_B * 0.92 * Math.sin(theta));
    root.add(o);
    return o;
  };
  const audioAnchors: AudioAnchors = {
    front: anchorAt((3 * Math.PI) / 2),
    right: anchorAt(0),
    left: anchorAt(Math.PI),
    backRight: anchorAt(Math.PI / 2 - 0.95),
    backLeft: anchorAt(Math.PI / 2 + 0.95),
  };

  // ---------------- Dust motes inside the ellipse ----------------
  const DUST = 500;
  const positions = new Float32Array(DUST * 3);
  const speeds = new Float32Array(DUST);
  for (let i = 0; i < DUST; i++) {
    let x = 0;
    let z = 0;
    do {
      x = (Math.random() - 0.5) * 2 * HALL_A * 0.9;
      z = (Math.random() - 0.5) * 2 * HALL_B * 0.9;
    } while (!insideEllipse(x, z, 0, 0, HALL_A * 0.9, HALL_B * 0.9));
    positions[i * 3] = cx + x;
    positions[i * 3 + 1] = Math.random() * HALL_CEILING * 0.9;
    positions[i * 3 + 2] = cz + z;
    speeds[i] = 0.05 + Math.random() * 0.12;
  }
  const dustGeo = new BufferGeometry();
  dustGeo.setAttribute('position', new Float32BufferAttribute(positions, 3));
  const dustMat = new PointsMaterial({
    color: 0xffcf9a,
    map: makeSoftSprite(),
    size: 0.09,
    transparent: true,
    opacity: 0.3,
    blending: AdditiveBlending,
    depthWrite: false,
    sizeAttenuation: true,
  });
  root.add(new Points(dustGeo, dustMat));

  scene.add(root);

  // ---------------- Anchors & movement regions ----------------
  const margin = 0.5;
  const corridorRegion: WalkRegion = {
    contains: (x, z) => x >= -cw + margin && x <= cw - margin && z >= -CORRIDOR_LENGTH - 1.2 && z <= -margin,
  };
  const doorRegion: WalkRegion = {
    contains: (x, z) => Math.abs(x) <= DOOR_HALF_WIDTH - 0.45 && z >= hallZ0 - 2.5 && z <= hallZ0 + 1.5,
  };
  const hallRegion: WalkRegion = {
    contains: (x, z) => insideEllipse(x, z, cx, cz, HALL_A, HALL_B, 0.7),
  };
  const boundsViewing = new Box3(
    new Vector3(cx - HALL_A, 0, cz - HALL_B),
    new Vector3(cx + HALL_A, 3, cz + HALL_B),
  );
  const anchors: WorldAnchors = {
    spawnCorridor: new Vector3(0, EYE_HEIGHT, -2),
    spawnHall: new Vector3(0, EYE_HEIGHT, hallZ0 - 3.5),
    // The arrival trigger must sit INSIDE `boundsViewing`. It used to reach 0.5m short of
    // the door line while boundsViewing starts at it, so every on-foot arrival tripped the
    // "you are not in the hall" relocation and jumped the viewer 4m forward (2026-09-11).
    triggerHallEntry: new Box3(
      new Vector3(-DOOR_HALF_WIDTH, 0, hallZ0 - 2.5),
      new Vector3(DOOR_HALF_WIDTH, 3, hallZ0 - 0.3),
    ),
    boundsViewing,
    viewingMaxDistance: HALL_A * 2,
  };

  let bgLevel = 0.6;
  let dustTime = 0;
  const dustColor = new Color();

  return {
    root,
    anchors,
    walkRegions: [corridorRegion, doorRegion, hallRegion],
    obstacles,
    screenMesh,
    screenSurfaces,
    panorama: {
      panoLen, sunArc, bandBottom: BAND_BOTTOM, bandHeight: bandH,
      frontArcLen: FRONT_ARC_LEN, perimeter: table.perimeter,
      center: [cx, cz],
      // Bearing (not the parametric angle) of the door's right edge seen from the centre —
      // the angular mapping's zero. For x = A·cosθ, z = B·sinθ the two differ on an ellipse.
      startBearing: Math.atan2(HALL_B * Math.sin(startAngle), HALL_A * Math.cos(startAngle)),
      nearWallDistance: Math.min(HALL_A, HALL_B),
    },
    spillLights,
    audioAnchors,
    reflectiveMaterials: [floorMat, ceilMat],
    setBgAnimation(level: number): void {
      bgLevel = level;
      hallGlow.intensity = 0.9 + level * 0.8;
      dustMat.opacity = 0.1 + level * 0.4;
    },
    setBreath(centerX: number, centerZ: number, amount: number): void {
      floorMat.uniforms.uBreath!.value = amount;
      floorMat.uniforms.uBreathCenter!.value = [centerX, centerZ];
    },
    setDustColor(r: number, g: number, b: number): void {
      dustColor.setRGB(Math.min(1, r * 0.7), Math.min(1, g * 0.7), Math.min(1, b * 0.7));
      dustMat.color.copy(dustColor);
    },
    setReflectionQuality(taps: number, ceilingOn: boolean): void {
      floorMat.uniforms.uTaps!.value = taps;
      floorMat.uniforms.uDetail!.value = taps > 1.5 ? 1 : 0;
      ceilMat.uniforms.uTaps!.value = 1;
      ceilMat.uniforms.uDetail!.value = 0;
      ceiling.visible = ceilingOn;
    },
    update(dt: number): void {
      dustTime += dt;
      const arr = dustGeo.getAttribute('position');
      const speedScale = 0.4 + bgLevel * 0.8;
      for (let i = 0; i < DUST; i++) {
        let y = arr.getY(i) + speeds[i]! * dt * speedScale;
        const sway = Math.sin(dustTime * 0.3 + i) * 0.02 * dt;
        if (y > HALL_CEILING * 0.92) y = 0.2;
        arr.setY(i, y);
        arr.setX(i, arr.getX(i) + sway);
      }
      arr.needsUpdate = true;
    },
  };
}
