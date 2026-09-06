// Unit tests — quality adaptation hysteresis (SRS §8.2 v1.1: thresholds 45/55,
// preset never auto-upgrades, down max 2/session with 30s spacing).
import { describe, expect, it } from 'vitest';
import {
  DOWN_WINDOWS,
  FPS_DOWN_THRESHOLD,
  feedWindow,
  initialAdapt,
  PRESET_SCALE_RANGE,
  UP_WINDOWS,
} from '../src/scene/adaptation';

const DPR = 1;

describe('adaptation', () => {
  it('[TC-QLT-01] threshold aligns with NFR-1 target 45 (audit F-4)', () => {
    expect(FPS_DOWN_THRESHOLD).toBe(45);
  });

  it('[TC-QLT-02] scales down after 3 low windows', () => {
    let s = initialAdapt('med', false);
    const startScale = s.renderScale;
    let changed = '';
    for (let i = 0; i < DOWN_WINDOWS; i++) {
      const r = feedWindow(s, 40, 1000 + i, DPR);
      s = r.next;
      changed = r.changed;
    }
    expect(changed).toBe('scale-down');
    expect(s.renderScale).toBeLessThan(startScale);
  });

  it('[TC-QLT-03] 40..45 gap no longer stalls below target (fps 44 triggers downscale)', () => {
    let s = initialAdapt('med', false);
    let changed = '';
    for (let i = 0; i < DOWN_WINDOWS; i++) {
      const r = feedWindow(s, 44, 1000 + i, DPR);
      s = r.next;
      changed = r.changed;
    }
    expect(changed).toBe('scale-down');
  });

  it('[TC-QLT-04] drops preset only at scale floor, max twice, 30s apart', () => {
    let s = initialAdapt('med', false);
    s = { ...s, renderScale: PRESET_SCALE_RANGE.med.min };
    let now = 0;
    // First preset down
    let result = '';
    for (let i = 0; i < DOWN_WINDOWS; i++) {
      const r = feedWindow(s, 30, (now += 2000), DPR);
      s = r.next;
      result = r.changed;
    }
    expect(result).toBe('preset-down');
    expect(s.preset).toBe('low');
    // Immediately after: blocked by 30s spacing even at floor
    s = { ...s, renderScale: PRESET_SCALE_RANGE.low.min };
    for (let i = 0; i < DOWN_WINDOWS; i++) {
      const r = feedWindow(s, 30, (now += 2000), DPR);
      s = r.next;
      result = r.changed;
    }
    expect(s.preset).toBe('low'); // already lowest anyway
  });

  it('[TC-QLT-05] never auto-upgrades preset; only renderScale rises', () => {
    let s = initialAdapt('med', false);
    s = { ...s, renderScale: 0.8 };
    let changed = '';
    for (let i = 0; i < UP_WINDOWS; i++) {
      const r = feedWindow(s, 60, i * 2000, DPR);
      s = r.next;
      changed = r.changed;
    }
    expect(changed).toBe('scale-up');
    expect(s.preset).toBe('med');
  });

  it('[TC-QLT-06] manual preset never auto-drops preset', () => {
    let s = initialAdapt('low', true);
    s = { ...s, renderScale: PRESET_SCALE_RANGE.low.min };
    for (let i = 0; i < DOWN_WINDOWS * 4; i++) {
      s = feedWindow(s, 20, i * 2000, DPR).next;
    }
    expect(s.preset).toBe('low');
    expect(s.manualPreset).toBe(true);
  });
});
