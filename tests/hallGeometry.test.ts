// Unit tests — elliptical hall geometry (SRS-SCN-25): arc-length panorama coordinate,
// entrance gap, inverse mapping, walkable inset, ribbon/LUT continuity.
import { describe, expect, it } from 'vitest';
import {
  HALL_A,
  HALL_B,
  buildArcLut,
  buildArcTable,
  buildRibbon,
  clockwiseArc,
  insideEllipse,
  panoramaLength,
  sunArc,
  thetaAtClockwiseArc,
} from '../src/scene/hallGeometry';

const table = buildArcTable(HALL_A, HALL_B);

describe('hall ellipse', () => {
  it('[TC-SCN-08] perimeter matches Ramanujan within 0.2% (≈82m, 국중박 60m 참조 초과)', () => {
    const a = HALL_A;
    const b = HALL_B;
    const ramanujan = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
    expect(Math.abs(table.perimeter - ramanujan) / ramanujan).toBeLessThan(0.002);
    expect(table.perimeter).toBeGreaterThan(60);
  });

  it('[TC-SCN-09] panorama arc is monotone clockwise and the sun sits at its midpoint', () => {
    const start = Math.PI / 2 - Math.asin(2.4 / HALL_A);
    let prev = -1;
    for (let i = 0; i <= 360; i++) {
      const theta = start - (i / 360) * (2 * Math.PI - 2 * (Math.PI / 2 - start)) ;
      const s = clockwiseArc(table, theta);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-9);
      prev = s;
    }
    const len = panoramaLength(table);
    expect(Math.abs(sunArc(table) - len / 2)).toBeLessThan(0.02);
    expect(len).toBeLessThan(table.perimeter);
  });

  it('[TC-SCN-10] thetaAtClockwiseArc inverts clockwiseArc to <1e-3 rad', () => {
    for (let s = 0; s < table.perimeter; s += 3.7) {
      const theta = thetaAtClockwiseArc(table, s);
      expect(Math.abs(clockwiseArc(table, theta) - s)).toBeLessThan(1e-3 * table.perimeter);
    }
  });

  it('[TC-SCN-11] insideEllipse honours the wall-clearance margin', () => {
    expect(insideEllipse(HALL_A - 0.1, 0, 0, 0, HALL_A, HALL_B)).toBe(true);
    expect(insideEllipse(HALL_A - 0.1, 0, 0, 0, HALL_A, HALL_B, 0.7)).toBe(false);
    expect(insideEllipse(0, 0, 0, 0, HALL_A, HALL_B, 0.7)).toBe(true);
    expect(insideEllipse(HALL_A + 0.01, 0, 0, 0, HALL_A, HALL_B)).toBe(false);
  });

  it('[TC-SCN-11] ribbon arcs are continuous and the LUT is monotone', () => {
    const len = panoramaLength(table);
    const r = buildRibbon(table, 10, 34, 0, 0, 0.25, 6.25);
    expect(r.arcs[0]).toBeCloseTo(10, 6);
    expect(r.arcs[r.arcs.length - 1]).toBeCloseTo(34, 6);
    for (let i = 2; i < r.arcs.length; i += 2) expect(r.arcs[i]!).toBeGreaterThan(r.arcs[i - 2]!);
    const lut = buildArcLut(table, 256);
    let prev = -1;
    for (let i = 0; i < 256; i++) {
      const v = lut[i * 2]! * 256 + lut[i * 2 + 1]!;
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
    expect(prev).toBe(65535);
    expect(len / (6.25 - 0.25)).toBeGreaterThan(10); // ≥ 10:1 band ratio (실감1관 12:1 급)
  });
});
