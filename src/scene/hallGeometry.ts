// scene/hallGeometry — elliptical immersive hall math (SRS-SCN-25, pure — unit tested).
// The hall is an ellipse in plan (semi-axes A along x, B along z). The wall screen is one
// continuous ribbon around the ellipse, broken only by the entrance gap at the +z apex.
// The panorama coordinate is TRUE ARC LENGTH measured clockwise (viewer's right first)
// from the door's right edge, so content is not stretched on the long walls.
// Reference: 국립중앙박물관 실감1관 파노라마 60m×5m(12:1) — 조사 K.

export const HALL_A = 15; // semi-axis along x (m)
export const HALL_B = 11; // semi-axis along z (m)
export const HALL_CEILING = 8.0;
export const DOOR_HALF_WIDTH = 2.4; // entrance gap half-width at the +z apex
export const BAND_BOTTOM = 0.25; // screen band (m) — floor-to-ceiling feel, 6m tall ≈ 13:1
export const BAND_TOP = 6.25;

const TABLE_N = 1440; // arc-length samples over a full turn (0.25° steps)

export interface EllipseArcTable {
  a: number;
  b: number;
  /** cumulative arc length A(θ) for θ = i·2π/N, i ∈ [0, N] (A(0)=0, A(2π)=perimeter) */
  cumulative: Float64Array;
  perimeter: number;
}

export function buildArcTable(a = HALL_A, b = HALL_B, n = TABLE_N): EllipseArcTable {
  const cumulative = new Float64Array(n + 1);
  const step = (2 * Math.PI) / n;
  let acc = 0;
  let prev = speed(a, b, 0);
  for (let i = 1; i <= n; i++) {
    const cur = speed(a, b, i * step);
    acc += ((prev + cur) / 2) * step; // trapezoid
    cumulative[i] = acc;
    prev = cur;
  }
  return { a, b, cumulative, perimeter: acc };
}

/** |d(x,z)/dθ| for x = a·cosθ, z = b·sinθ. */
function speed(a: number, b: number, theta: number): number {
  const s = Math.sin(theta);
  const c = Math.cos(theta);
  return Math.sqrt(a * a * s * s + b * b * c * c);
}

const TAU = Math.PI * 2;
export function wrapAngle(theta: number): number {
  const t = theta % TAU;
  return t < 0 ? t + TAU : t;
}

/** Cumulative arc A(θ) extended periodically to any real θ. */
export function arcAt(table: EllipseArcTable, theta: number): number {
  const turns = Math.floor(theta / TAU);
  const t = theta - turns * TAU;
  const n = table.cumulative.length - 1;
  const f = (t / TAU) * n;
  const i = Math.min(n - 1, Math.floor(f));
  const frac = f - i;
  const v = table.cumulative[i]! * (1 - frac) + table.cumulative[i + 1]! * frac;
  return v + turns * table.perimeter;
}

/** Door angular half-span at the +z apex (θ = π/2): x = a·cosθ = ±doorHalf. */
export function doorHalfAngle(a = HALL_A, doorHalf = DOOR_HALF_WIDTH): number {
  return Math.asin(Math.min(1, doorHalf / a));
}

/** Panorama start angle = door's right edge (viewer facing −z: right = +x). */
export function panoStartAngle(a = HALL_A, doorHalf = DOOR_HALF_WIDTH): number {
  return Math.PI / 2 - doorHalfAngle(a, doorHalf);
}

/** Clockwise (decreasing θ) arc length from the panorama start to θ, in [0, perimeter). */
export function clockwiseArc(table: EllipseArcTable, theta: number, start = panoStartAngle(table.a)): number {
  const u = wrapAngle(start - theta);
  return arcAt(table, start) - arcAt(table, start - u);
}

/** Total usable panorama length (perimeter minus the door gap). */
export function panoramaLength(table: EllipseArcTable, doorHalf = DOOR_HALF_WIDTH): number {
  const d = doorHalfAngle(table.a, doorHalf);
  const gap = arcAt(table, Math.PI / 2 + d) - arcAt(table, Math.PI / 2 - d);
  return table.perimeter - gap;
}

/** Arc position of the front apex (θ = 3π/2, straight ahead from the door) — the sun. */
export function sunArc(table: EllipseArcTable): number {
  return clockwiseArc(table, (3 * Math.PI) / 2);
}

/** Inside test with an inset margin (player radius / wall clearance). */
export function insideEllipse(x: number, z: number, cx: number, cz: number, a: number, b: number, margin = 0): boolean {
  const ea = a - margin;
  const eb = b - margin;
  if (ea <= 0 || eb <= 0) return false;
  const dx = (x - cx) / ea;
  const dz = (z - cz) / eb;
  return dx * dx + dz * dz <= 1;
}

export interface RibbonData {
  positions: Float32Array; // world-space xyz (centre supplied)
  uvs: Float32Array; // u along this ribbon 0..1, v 0..1 bottom→top
  arcs: Float32Array; // panorama arc (m) per vertex — continuous across ribbons
  indices: Uint16Array;
  arcStart: number;
  arcEnd: number;
}

/**
 * Wall ribbon between two clockwise arc positions [arcStart, arcEnd] (m), sampled every
 * ~`segmentLen` metres. Vertices face inward (winding chosen so the front face looks to
 * the hall centre).
 */
export function buildRibbon(
  table: EllipseArcTable,
  arcStart: number,
  arcEnd: number,
  cx: number,
  cz: number,
  yBottom: number,
  yTop: number,
  segmentLen = 0.75,
): RibbonData {
  const start = panoStartAngle(table.a);
  const len = arcEnd - arcStart;
  const segs = Math.max(2, Math.ceil(len / segmentLen));
  const positions = new Float32Array((segs + 1) * 2 * 3);
  const uvs = new Float32Array((segs + 1) * 2 * 2);
  const arcs = new Float32Array((segs + 1) * 2);
  const indices = new Uint16Array(segs * 6);
  for (let i = 0; i <= segs; i++) {
    const s = arcStart + (len * i) / segs;
    const theta = thetaAtClockwiseArc(table, s, start);
    const x = cx + table.a * Math.cos(theta);
    const z = cz + table.b * Math.sin(theta);
    for (let k = 0; k < 2; k++) {
      const vi = i * 2 + k;
      positions[vi * 3] = x;
      positions[vi * 3 + 1] = k === 0 ? yBottom : yTop;
      positions[vi * 3 + 2] = z;
      uvs[vi * 2] = i / segs;
      uvs[vi * 2 + 1] = k;
      arcs[vi] = s;
    }
    if (i < segs) {
      const o = i * 6;
      const b0 = i * 2;
      // clockwise ribbon seen from inside: (b0, b0+2, b0+1), (b0+1, b0+2, b0+3)
      indices[o] = b0;
      indices[o + 1] = b0 + 1;
      indices[o + 2] = b0 + 2;
      indices[o + 3] = b0 + 1;
      indices[o + 4] = b0 + 3;
      indices[o + 5] = b0 + 2;
    }
  }
  return { positions, uvs, arcs, indices, arcStart, arcEnd };
}

/** Inverse of clockwiseArc by bisection on the monotone clockwise parameter u. */
export function thetaAtClockwiseArc(table: EllipseArcTable, s: number, start = panoStartAngle(table.a)): number {
  let lo = 0;
  let hi = TAU;
  const target = Math.min(Math.max(s, 0), table.perimeter);
  for (let i = 0; i < 40; i++) {
    const mid = (lo + hi) / 2;
    const arc = arcAt(table, start) - arcAt(table, start - mid);
    if (arc < target) lo = mid;
    else hi = mid;
  }
  return start - (lo + hi) / 2;
}

/**
 * 16-bit LUT of clockwise arc (normalised by perimeter) indexed by u = (start−θ)/2π.
 * The floor/ceiling reflection shader turns a hit angle into a panorama coordinate with it.
 */
export function buildArcLut(table: EllipseArcTable, n = 1024): Uint8Array {
  const start = panoStartAngle(table.a);
  const out = new Uint8Array(n * 2);
  for (let i = 0; i < n; i++) {
    const u = (i / (n - 1)) * TAU;
    const arc = (arcAt(table, start) - arcAt(table, start - u)) / table.perimeter;
    const q = Math.round(Math.min(1, Math.max(0, arc)) * 65535);
    out[i * 2] = q >> 8;
    out[i * 2 + 1] = q & 255;
  }
  return out;
}
