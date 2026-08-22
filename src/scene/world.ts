// scene/world — procedural corridor + hall (placeholder art within SRS-SCN-2x constraints).
// DEV NOTE: real art arrives at M1 as GLB with the SRS-SCN-24 naming convention
// (SPAWN_corridor / SPAWN_hall / TRIGGER_hallEntry / BOUNDS_viewing). This module builds the
// same logical anchors procedurally so the rest of the app already consumes the contract.

import {
  AmbientLight,
  BoxGeometry,
  Box3,
  Group,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
  SpotLight,
  Vector3,
} from 'three';

export const CORRIDOR_LENGTH = 40; // m — within SCN-24's 32~64m at normal speed
export const CORRIDOR_WIDTH = 4;
export const CORRIDOR_HEIGHT = 6;
export const HALL_WIDTH = 44;
export const HALL_DEPTH = 30;
export const HALL_HEIGHT = 18;
export const SCREEN_WIDTH = 30;
export const SCREEN_HEIGHT = 12.5;
export const EYE_HEIGHT = 1.65;

export interface WorldAnchors {
  spawnCorridor: Vector3;
  spawnHall: Vector3;
  triggerHallEntry: Box3;
  boundsViewing: Box3;
  /** Max reachable distance inside viewing bounds — positional maxDistance basis (×1.5). */
  viewingMaxDistance: number;
}

export interface World {
  root: Group;
  anchors: WorldAnchors;
  /** Axis-aligned walkable volumes; player position must stay inside their union. */
  walkables: Box3[];
  screenMesh: Mesh;
  /** Point lights driven by the video average color (SRS-SCN-13 spill approximation). */
  spillLights: PointLight[];
  setBgAnimation(level: number): void;
}

// Layout (z axis): corridor runs from z=0 (spawn) to z=-CORRIDOR_LENGTH (hall entry),
// hall extends further to z = -CORRIDOR_LENGTH - HALL_DEPTH. Screen on the far hall wall.
export function buildWorld(scene: Scene): World {
  const root = new Group();
  root.name = 'world';

  const wallMat = new MeshStandardMaterial({ color: 0x14120f, roughness: 0.95, metalness: 0 });
  const floorMat = new MeshStandardMaterial({ color: 0x0b0a09, roughness: 0.85, metalness: 0.05 });
  const darkMat = new MeshStandardMaterial({ color: 0x080808, roughness: 1 });

  const addBox = (
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: MeshStandardMaterial,
  ): Mesh => {
    const m = new Mesh(new BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    root.add(m);
    return m;
  };

  const hallZ0 = -CORRIDOR_LENGTH; // hall near edge
  const hallZc = hallZ0 - HALL_DEPTH / 2;

  // --- Corridor shell (interior-facing boxes) ---
  const cw = CORRIDOR_WIDTH / 2;
  addBox(0.3, CORRIDOR_HEIGHT, CORRIDOR_LENGTH, -cw - 0.15, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2, wallMat);
  addBox(0.3, CORRIDOR_HEIGHT, CORRIDOR_LENGTH, cw + 0.15, CORRIDOR_HEIGHT / 2, -CORRIDOR_LENGTH / 2, wallMat);
  addBox(CORRIDOR_WIDTH + 0.6, 0.3, CORRIDOR_LENGTH, 0, CORRIDOR_HEIGHT + 0.15, -CORRIDOR_LENGTH / 2, darkMat);
  addBox(CORRIDOR_WIDTH + 0.6, 0.3, CORRIDOR_LENGTH, 0, -0.15, -CORRIDOR_LENGTH / 2, floorMat);
  addBox(CORRIDOR_WIDTH + 0.6, CORRIDOR_HEIGHT, 0.3, 0, CORRIDOR_HEIGHT / 2, 0.15, wallMat); // back wall

  // Dim guide strips along the corridor (very low intensity — sensory safety, no flashing).
  for (let i = 1; i <= 5; i++) {
    const z = (-CORRIDOR_LENGTH * i) / 6;
    const strip = new PointLight(0xffb37a, 0.6, 9, 2);
    strip.position.set(0, 0.4, z);
    root.add(strip);
  }

  // --- Hall shell ---
  const hw = HALL_WIDTH / 2;
  addBox(0.4, HALL_HEIGHT, HALL_DEPTH, -hw - 0.2, HALL_HEIGHT / 2, hallZc, wallMat);
  addBox(0.4, HALL_HEIGHT, HALL_DEPTH, hw + 0.2, HALL_HEIGHT / 2, hallZc, wallMat);
  addBox(HALL_WIDTH + 0.8, 0.4, HALL_DEPTH, 0, HALL_HEIGHT + 0.2, hallZc, darkMat);
  addBox(HALL_WIDTH + 0.8, 0.4, HALL_DEPTH, 0, -0.2, hallZc, floorMat);
  // Far wall (screen wall)
  addBox(HALL_WIDTH + 0.8, HALL_HEIGHT, 0.4, 0, HALL_HEIGHT / 2, hallZ0 - HALL_DEPTH - 0.2, wallMat);
  // Near wall segments around the corridor doorway
  const doorHalf = CORRIDOR_WIDTH / 2 + 0.2;
  const segW = (HALL_WIDTH - CORRIDOR_WIDTH) / 2;
  addBox(segW, HALL_HEIGHT, 0.4, -(doorHalf + segW / 2), HALL_HEIGHT / 2, hallZ0 + 0.2, wallMat);
  addBox(segW, HALL_HEIGHT, 0.4, doorHalf + segW / 2, HALL_HEIGHT / 2, hallZ0 + 0.2, wallMat);
  // Lintel above the doorway
  addBox(CORRIDOR_WIDTH + 0.4, HALL_HEIGHT - CORRIDOR_HEIGHT, 0.4, 0, CORRIDOR_HEIGHT + (HALL_HEIGHT - CORRIDOR_HEIGHT) / 2, hallZ0 + 0.2, wallMat);

  // --- Screen (unlit; material is swapped in by the screen module) ---
  const screenMesh = new Mesh(
    new PlaneGeometry(SCREEN_WIDTH, SCREEN_HEIGHT),
    new MeshStandardMaterial({ color: 0x000000, roughness: 1 }),
  );
  screenMesh.name = 'SCREEN';
  screenMesh.position.set(0, SCREEN_HEIGHT / 2 + 2.2, hallZ0 - HALL_DEPTH + 0.35);
  root.add(screenMesh);

  // Subtle screen frame
  const frame = new Mesh(
    new BoxGeometry(SCREEN_WIDTH + 1.2, SCREEN_HEIGHT + 1.2, 0.2),
    darkMat,
  );
  frame.position.set(0, SCREEN_HEIGHT / 2 + 2.2, hallZ0 - HALL_DEPTH + 0.2);
  root.add(frame);

  // --- Lighting ---
  root.add(new AmbientLight(0x1a1610, 0.5));
  const hallGlow = new SpotLight(0x332211, 2.0, 60, Math.PI / 3, 0.5, 1.2);
  hallGlow.position.set(0, HALL_HEIGHT - 2, hallZc);
  hallGlow.target.position.set(0, 0, hallZc);
  root.add(hallGlow, hallGlow.target);

  // Video-driven spill lights (SRS-SCN-13): color/intensity set from video average color.
  const spillLights: PointLight[] = [];
  for (const x of [-HALL_WIDTH / 4, 0, HALL_WIDTH / 4]) {
    const l = new PointLight(0xff8844, 0, 55, 1.6);
    l.position.set(x, HALL_HEIGHT / 2, hallZ0 - HALL_DEPTH + 6);
    spillLights.push(l);
    root.add(l);
  }

  scene.add(root);

  // --- Anchors (SRS-SCN-24 contract) ---
  const margin = 0.5;
  const walkCorridor = new Box3(
    new Vector3(-cw + margin, 0, -CORRIDOR_LENGTH - 1),
    new Vector3(cw - margin, 3, -margin),
  );
  const walkHall = new Box3(
    new Vector3(-hw + margin, 0, hallZ0 - HALL_DEPTH + 2.5), // 2.5m standoff from screen
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
  return {
    root,
    anchors,
    walkables: [walkCorridor, walkHall],
    screenMesh,
    spillLights,
    setBgAnimation(level: number): void {
      bgLevel = level;
      // Placeholder world has no particles yet; level modulates hall glow subtly.
      hallGlow.intensity = 1.2 + bgLevel * 1.2;
    },
  };
}
