// audio/phaseMix — ambience layer gains per sky phase (SRS-AUD-9, pure — unit tested).
// The soundscape follows the light: the wind and shimmer of golden hour give way to a
// deeper, quieter night bed with a low drone; dawn lifts it again. Gains are bounded so the
// mix never gets louder than the tuned daytime bed (user: "소리가 너무 커" — 2026-08-22).

export type LayerName = 'waves' | 'wind' | 'pad' | 'nightAir' | 'drone';

export type LayerGains = Record<LayerName, number>;

/** Tuned daytime bed (matches the pre-v5 levels). */
export const DAY_GAINS: LayerGains = { waves: 0.3, wind: 0.18, pad: 0.22, nightAir: 0, drone: 0 };
export const NIGHT_GAINS: LayerGains = { waves: 0.24, wind: 0.07, pad: 0.12, nightAir: 0.1, drone: 0.14 };

/** Hard ceiling per layer — a phase can never exceed it (mix headroom guarantee). */
export const GAIN_CEILING: LayerGains = { waves: 0.3, wind: 0.18, pad: 0.22, nightAir: 0.12, drone: 0.16 };

function clamp01(v: number): number {
  return Math.min(1, Math.max(0, v));
}

/**
 * Night weight from sun elevation: 0 while the sun is up, rising through civil twilight,
 * 1 from nautical twilight (−12°) on. Continuous so gain ramps stay smooth.
 */
export function nightWeight(sunElev: number): number {
  return clamp01((-sunElev - 1) / 11);
}

export function gainsForElevation(sunElev: number): LayerGains {
  const w = nightWeight(sunElev);
  const out = {} as LayerGains;
  for (const k of Object.keys(DAY_GAINS) as LayerName[]) {
    const v = DAY_GAINS[k] + (NIGHT_GAINS[k] - DAY_GAINS[k]) * w;
    out[k] = Math.min(GAIN_CEILING[k], Math.max(0, v));
  }
  return out;
}

/** Total energy proxy — must stay ≤ the daytime bed (no phase may be louder). */
export function totalGain(g: LayerGains): number {
  return (Object.keys(g) as LayerName[]).reduce((a, k) => a + g[k], 0);
}
