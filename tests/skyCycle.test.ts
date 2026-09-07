// Unit tests — sky cycle (SRS-VID-8): seamless loop, flash-free continuity (SRS-SCN-23),
// twilight gating of stars/moon, phase order.
import { describe, expect, it } from 'vitest';
import { CYCLE_SECONDS, paletteAt, phaseAt, skyParams, sunElevation } from '../src/scene/skyCycle';

const channels = (p: ReturnType<typeof skyParams>): number[] => [
  ...p.zenith, ...p.mid, ...p.horizon, ...p.sun, p.sunGlow, ...p.cloudLit, ...p.seaNear, ...p.seaDeep, p.star, p.moon,
];

describe('sky cycle', () => {
  it('[TC-SCN-12] loops seamlessly: t=0 and t=CYCLE agree', () => {
    const a = skyParams(0);
    const b = skyParams(CYCLE_SECONDS - 1e-6);
    expect(Math.abs(a.sunElev - b.sunElev)).toBeLessThan(1e-3);
    const ca = channels(a);
    const cb = channels(b);
    for (let i = 0; i < ca.length; i++) expect(Math.abs(ca[i]! - cb[i]!)).toBeLessThan(0.01);
  });

  it('[TC-SCN-13] is flash-free: per-second change stays tiny over the whole cycle', () => {
    let prev = channels(skyParams(0));
    let prevElev = sunElevation(0);
    let maxDelta = 0;
    let maxElevDelta = 0;
    for (let t = 1; t <= CYCLE_SECONDS; t++) {
      const cur = channels(skyParams(t));
      for (let i = 0; i < cur.length; i++) maxDelta = Math.max(maxDelta, Math.abs(cur[i]! - prev[i]!));
      const e = sunElevation(t);
      maxElevDelta = Math.max(maxElevDelta, Math.abs(e - prevElev));
      prev = cur;
      prevElev = e;
    }
    // ≤5 %/s per channel: a full swing takes ≥20 s — 40× slower than the 0.5 s fade floor,
    // nowhere near a luminance reversal (SRS-SCN-23). Dawn (t≈520–600) is the fastest ramp.
    expect(maxDelta).toBeLessThan(0.05);
    expect(maxElevDelta).toBeLessThan(0.35); // degrees per second
  });

  it('[TC-SCN-14] stars and moon only after civil twilight; phases run in order', () => {
    expect(paletteAt(6).star).toBe(0);
    expect(paletteAt(0).star).toBe(0);
    expect(paletteAt(-3).star).toBe(0);
    expect(paletteAt(-7).star).toBeGreaterThan(0.2);
    expect(paletteAt(-16).star).toBe(1);
    expect(paletteAt(-16).moon).toBe(1);
    const order = ['golden', 'sunset', 'blue', 'night', 'dawn'];
    const seen: string[] = [];
    for (let t = 0; t < CYCLE_SECONDS; t += 5) {
      const ph = phaseAt(t);
      if (seen[seen.length - 1] !== ph) seen.push(ph);
    }
    expect(seen).toEqual(order);
    expect(sunElevation(0)).toBe(6);
    expect(sunElevation(470)).toBe(-16);
  });
});
