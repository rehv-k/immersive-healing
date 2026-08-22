// scene/adaptation — pure quality adaptation logic (SRS §8.2, v1.1 thresholds 45/55).
// Downscale renderScale first, then preset (max 2/session, 30s apart). Preset never auto-upgrades.

import type { Preset } from '../types';

export const FPS_DOWN_THRESHOLD = 45; // aligned with NFR-1 target (audit F-4 fix)
export const FPS_UP_THRESHOLD = 55;
export const DOWN_WINDOWS = 3; // 2s windows
export const UP_WINDOWS = 10;
export const SCALE_STEP = 0.05;
export const PRESET_DOWN_MAX = 2;
export const PRESET_DOWN_MIN_INTERVAL_MS = 30_000;

export const PRESET_SCALE_RANGE: Record<Preset, { min: number; max: number }> = {
  low: { min: 0.6, max: 0.85 },
  med: { min: 0.75, max: 1.0 },
  high: { min: 0.85, max: 1.5 },
};
export const PRESET_DPR_CAP: Record<Preset, number> = { low: 1.0, med: 1.25, high: 1.5 };
/** Combined cap: min(DPR, cap) × renderScale must not exceed this (SRS §8.1 v1.1). */
export const PRESET_COMBINED_CAP: Record<Preset, number> = { low: 0.85, med: 1.25, high: 1.5 };

export interface AdaptState {
  preset: Preset;
  renderScale: number;
  lowStreak: number;
  highStreak: number;
  presetDownCount: number;
  lastPresetDownAt: number; // ms epoch (performance.now domain)
  manualPreset: boolean; // manual preset: only renderScale adapts
}

export interface AdaptResult {
  next: AdaptState;
  changed: 'none' | 'scale-down' | 'scale-up' | 'preset-down';
}

export function initialAdapt(preset: Preset, manualPreset: boolean): AdaptState {
  const range = PRESET_SCALE_RANGE[preset];
  return {
    preset,
    renderScale: Math.min(range.max, Math.max(range.min, 1)),
    lowStreak: 0,
    highStreak: 0,
    presetDownCount: 0,
    lastPresetDownAt: -Infinity,
    manualPreset,
  };
}

export function clampScale(preset: Preset, scale: number, dpr: number): number {
  const range = PRESET_SCALE_RANGE[preset];
  const combined = PRESET_COMBINED_CAP[preset] / Math.min(dpr, PRESET_DPR_CAP[preset]);
  return Math.min(range.max, combined, Math.max(range.min, scale));
}

const PRESET_ORDER: Preset[] = ['low', 'med', 'high'];

export function presetDown(p: Preset): Preset | null {
  const i = PRESET_ORDER.indexOf(p);
  return i > 0 ? (PRESET_ORDER[i - 1] as Preset) : null;
}

/** Feed one completed 2s fps window. Windows are only collected in hall/!paused/visible. */
export function feedWindow(state: AdaptState, fps: number, nowMs: number, dpr: number): AdaptResult {
  const s: AdaptState = { ...state };
  if (fps < FPS_DOWN_THRESHOLD) {
    s.lowStreak += 1;
    s.highStreak = 0;
  } else if (fps > FPS_UP_THRESHOLD) {
    s.highStreak += 1;
    s.lowStreak = 0;
  } else {
    s.lowStreak = 0;
    s.highStreak = 0;
  }

  if (s.lowStreak >= DOWN_WINDOWS) {
    s.lowStreak = 0;
    const range = PRESET_SCALE_RANGE[s.preset];
    const lowered = clampScale(s.preset, s.renderScale - SCALE_STEP, dpr);
    if (lowered < s.renderScale - 1e-6) {
      s.renderScale = lowered;
      return { next: s, changed: 'scale-down' };
    }
    if (s.renderScale <= range.min + 1e-6 && !s.manualPreset) {
      const canDown =
        s.presetDownCount < PRESET_DOWN_MAX &&
        nowMs - s.lastPresetDownAt >= PRESET_DOWN_MIN_INTERVAL_MS;
      const nextPreset = presetDown(s.preset);
      if (canDown && nextPreset) {
        s.preset = nextPreset;
        s.presetDownCount += 1;
        s.lastPresetDownAt = nowMs;
        s.renderScale = clampScale(nextPreset, s.renderScale, dpr);
        return { next: s, changed: 'preset-down' };
      }
    }
    return { next: s, changed: 'none' };
  }

  if (s.highStreak >= UP_WINDOWS) {
    s.highStreak = 0;
    const raised = clampScale(s.preset, s.renderScale + SCALE_STEP, dpr);
    if (raised > s.renderScale + 1e-6) {
      s.renderScale = raised;
      return { next: s, changed: 'scale-up' };
    }
    return { next: s, changed: 'none' };
  }

  return { next: s, changed: 'none' };
}
