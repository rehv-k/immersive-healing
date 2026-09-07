// Unit tests — ambience phase mix (SRS-AUD-9): bounded gains, night never louder than day,
// continuous night weight.
import { describe, expect, it } from 'vitest';
import { DAY_GAINS, GAIN_CEILING, gainsForElevation, nightWeight, totalGain, type LayerName } from '../src/audio/phaseMix';

describe('phase mix', () => {
  it('[TC-AUD-09] every layer stays under its ceiling and no phase is louder than day', () => {
    const day = totalGain(DAY_GAINS);
    for (let e = 8; e >= -20; e -= 0.5) {
      const g = gainsForElevation(e);
      for (const k of Object.keys(g) as LayerName[]) {
        expect(g[k]).toBeGreaterThanOrEqual(0);
        expect(g[k]).toBeLessThanOrEqual(GAIN_CEILING[k] + 1e-9);
      }
      expect(totalGain(g)).toBeLessThanOrEqual(day + 1e-9);
    }
  });

  it('[TC-AUD-10] night weight is continuous, monotone and reaches both ends', () => {
    expect(nightWeight(6)).toBe(0);
    expect(nightWeight(-1)).toBe(0);
    expect(nightWeight(-12)).toBe(1);
    let prev = nightWeight(6);
    for (let e = 6; e >= -16; e -= 0.25) {
      const w = nightWeight(e);
      expect(w).toBeGreaterThanOrEqual(prev - 1e-9);
      expect(Math.abs(w - prev)).toBeLessThan(0.05);
      prev = w;
    }
    expect(gainsForElevation(6)).toEqual(DAY_GAINS);
    expect(gainsForElevation(-16).drone).toBeGreaterThan(0.1);
    expect(gainsForElevation(-16).wind).toBeLessThan(DAY_GAINS.wind);
  });
});
