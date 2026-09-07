// scene/skyCycle — the 10-minute sunset→blue hour→starry night→dawn cycle (SRS-VID-8).
// Pure: time → sun elevation → palette. Everything is continuous and slow so the wall,
// floor reflection and spill lights never flash (SRS-SCN-23). Twilight bands follow the
// photographic convention (golden 0..+6°, civil 0..−6°, blue hour −4..−8°, nautical to −12°,
// astronomical to −18°) — 조사 K. The short 2-minute "breathing" micro-cycle that gives a
// brief visit closure (PRD FR-37) lives in the shader; this module is the slow macro arc.

export const CYCLE_SECONDS = 600;

export type SkyPhase = 'golden' | 'sunset' | 'blue' | 'night' | 'dawn';

export interface SkyParams {
  /** seconds into the cycle, [0, CYCLE_SECONDS) */
  t: number;
  phase: SkyPhase;
  /** sun elevation in degrees (+ above horizon) */
  sunElev: number;
  zenith: [number, number, number];
  mid: [number, number, number];
  horizon: [number, number, number];
  sun: [number, number, number];
  /** broad glow strength around the sun position 0..1 */
  sunGlow: number;
  cloudLit: [number, number, number];
  seaNear: [number, number, number];
  seaDeep: [number, number, number];
  /** star field visibility 0..1 (0 until the sun is well below the horizon) */
  star: number;
  moon: number;
  /** moon position along the panorama (fraction 0..1) and height (0..1 of band) */
  moonArcFrac: number;
  moonHeight: number;
  /** average emitted colour — drives the spill lights */
  average: [number, number, number];
}

type RGB = [number, number, number];

// (t seconds, sun elevation °) — first and last keys coincide so the loop is seamless.
const ELEV_KEYS: Array<[number, number]> = [
  [0, 6],
  [110, 1.5],
  [150, 0],
  [200, -2],
  [270, -6],
  [340, -9],
  [420, -14],
  [470, -16],
  [520, -10],
  [560, -2],
  [600, 6],
];

interface PaletteKey {
  elev: number;
  zenith: RGB;
  mid: RGB;
  horizon: RGB;
  sun: RGB;
  sunGlow: number;
  cloudLit: RGB;
  seaNear: RGB;
  seaDeep: RGB;
  star: number;
  moon: number;
}

// Palette keyed by elevation (descending). Values are linear-ish and get the shader's
// ×1.6 exposure like the original sunset.
const PALETTE: PaletteKey[] = [
  { elev: 6, zenith: [0.08, 0.14, 0.34], mid: [0.7, 0.36, 0.2], horizon: [1.12, 0.6, 0.18], sun: [1.3, 0.9, 0.55], sunGlow: 0.85, cloudLit: [0.95, 0.55, 0.3], seaNear: [0.6, 0.36, 0.18], seaDeep: [0.06, 0.09, 0.14], star: 0, moon: 0 },
  { elev: 0, zenith: [0.06, 0.09, 0.24], mid: [0.62, 0.24, 0.2], horizon: [1.08, 0.42, 0.12], sun: [1.3, 0.72, 0.38], sunGlow: 0.9, cloudLit: [0.9, 0.4, 0.26], seaNear: [0.66, 0.3, 0.14], seaDeep: [0.06, 0.07, 0.12], star: 0, moon: 0 },
  { elev: -3, zenith: [0.06, 0.08, 0.22], mid: [0.42, 0.2, 0.28], horizon: [0.92, 0.38, 0.22], sun: [1.1, 0.6, 0.4], sunGlow: 0.55, cloudLit: [0.6, 0.28, 0.3], seaNear: [0.36, 0.2, 0.2], seaDeep: [0.04, 0.05, 0.1], star: 0, moon: 0.1 },
  { elev: -7, zenith: [0.03, 0.05, 0.16], mid: [0.1, 0.14, 0.32], horizon: [0.32, 0.22, 0.3], sun: [0.6, 0.4, 0.4], sunGlow: 0.25, cloudLit: [0.12, 0.12, 0.22], seaNear: [0.1, 0.12, 0.2], seaDeep: [0.02, 0.03, 0.07], star: 0.35, moon: 0.45 },
  { elev: -12, zenith: [0.015, 0.02, 0.07], mid: [0.03, 0.05, 0.13], horizon: [0.08, 0.08, 0.15], sun: [0.3, 0.25, 0.3], sunGlow: 0.08, cloudLit: [0.05, 0.05, 0.09], seaNear: [0.04, 0.05, 0.09], seaDeep: [0.01, 0.015, 0.035], star: 0.85, moon: 0.8 },
  { elev: -16, zenith: [0.008, 0.012, 0.045], mid: [0.015, 0.025, 0.08], horizon: [0.04, 0.045, 0.09], sun: [0.2, 0.2, 0.25], sunGlow: 0.03, cloudLit: [0.03, 0.03, 0.06], seaNear: [0.025, 0.03, 0.06], seaDeep: [0.006, 0.01, 0.025], star: 1, moon: 1 },
];

function smooth(u: number): number {
  return u * u * (3 - 2 * u);
}

function lerp(a: number, b: number, u: number): number {
  return a + (b - a) * u;
}
function lerp3(a: RGB, b: RGB, u: number): RGB {
  return [lerp(a[0], b[0], u), lerp(a[1], b[1], u), lerp(a[2], b[2], u)];
}

export function wrapCycle(t: number): number {
  const w = t % CYCLE_SECONDS;
  return w < 0 ? w + CYCLE_SECONDS : w;
}

/** Sun elevation (°) at cycle time t — smoothstep between keys (C1-ish, no kinks). */
export function sunElevation(t: number): number {
  const w = wrapCycle(t);
  for (let i = 0; i < ELEV_KEYS.length - 1; i++) {
    const [t0, e0] = ELEV_KEYS[i]!;
    const [t1, e1] = ELEV_KEYS[i + 1]!;
    if (w >= t0 && w <= t1) return lerp(e0, e1, smooth((w - t0) / (t1 - t0)));
  }
  return ELEV_KEYS[0]![1];
}

export function phaseAt(t: number): SkyPhase {
  const w = wrapCycle(t);
  if (w < 150) return 'golden';
  if (w < 270) return 'sunset';
  if (w < 360) return 'blue';
  if (w < 500) return 'night';
  return 'dawn';
}

/** Palette at a sun elevation — piecewise linear over PALETTE (descending elev). */
export function paletteAt(elev: number): Omit<SkyParams, 't' | 'phase' | 'sunElev' | 'moonArcFrac' | 'moonHeight' | 'average'> {
  const first = PALETTE[0]!;
  const last = PALETTE[PALETTE.length - 1]!;
  let a = first;
  let b = first;
  let u = 0;
  if (elev >= first.elev) {
    a = b = first;
  } else if (elev <= last.elev) {
    a = b = last;
  } else {
    for (let i = 0; i < PALETTE.length - 1; i++) {
      const k0 = PALETTE[i]!;
      const k1 = PALETTE[i + 1]!;
      if (elev <= k0.elev && elev >= k1.elev) {
        a = k0;
        b = k1;
        u = (k0.elev - elev) / (k0.elev - k1.elev);
        break;
      }
    }
  }
  return {
    zenith: lerp3(a.zenith, b.zenith, u),
    mid: lerp3(a.mid, b.mid, u),
    horizon: lerp3(a.horizon, b.horizon, u),
    sun: lerp3(a.sun, b.sun, u),
    sunGlow: lerp(a.sunGlow, b.sunGlow, u),
    cloudLit: lerp3(a.cloudLit, b.cloudLit, u),
    seaNear: lerp3(a.seaNear, b.seaNear, u),
    seaDeep: lerp3(a.seaDeep, b.seaDeep, u),
    star: lerp(a.star, b.star, u),
    moon: lerp(a.moon, b.moon, u),
  };
}

export function skyParams(t: number): SkyParams {
  const w = wrapCycle(t);
  const sunElev = sunElevation(w);
  const p = paletteAt(sunElev);
  // The moon drifts slowly along the right half of the panorama (arc 0.14→0.34) and arcs upward.
  const moonArcFrac = 0.14 + 0.2 * (w / CYCLE_SECONDS);
  const moonHeight = 0.35 + 0.35 * Math.sin((Math.PI * w) / CYCLE_SECONDS);
  const glowW = 0.35 * p.sunGlow;
  const average: RGB = [
    p.horizon[0] * 0.45 + p.mid[0] * 0.35 + p.sun[0] * glowW,
    p.horizon[1] * 0.45 + p.mid[1] * 0.35 + p.sun[1] * glowW,
    p.horizon[2] * 0.45 + p.mid[2] * 0.35 + p.sun[2] * glowW,
  ];
  return { t: w, phase: phaseAt(w), sunElev, ...p, moonArcFrac, moonHeight, average };
}
