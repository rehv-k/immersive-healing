// core/settings — schema v1, per-field validation/clamp, debounced persistence (SRS-COR-2x).
// Pure functions are exported for unit tests; storage I/O is injected for testability.

import type { ComfortProfile, Settings } from '../types';

export const STORAGE_KEY = 'ih:settings:v1';
export const SAVE_DEBOUNCE_MS = 300;

export function defaultSettings(prefersReducedMotion = false): Settings {
  return {
    schemaVersion: 1,
    fov: 90,
    moveSpeed: 'normal',
    sensitivityX: 1.0,
    sensitivityY: 1.0,
    invertY: false,
    headBob: 0,
    cameraExtras: false,
    motionBlur: false,
    mouseSmoothing: false,
    bgAnimation: prefersReducedMotion ? 0.3 : 0.6,
    quality: 'auto',
    masterVolume: 0.8,
    muted: false,
    keyLayout: 'wasd',
    comfortProfile: prefersReducedMotion ? 'sensitive' : 'normal',
    comfortTouchedByUser: false,
    visited: false,
  };
}

const num = (v: unknown, min: number, max: number, dflt: number): number => {
  const n = typeof v === 'number' ? v : NaN;
  if (!Number.isFinite(n)) return dflt;
  return Math.min(max, Math.max(min, n));
};
const bool = (v: unknown, dflt: boolean): boolean => (typeof v === 'boolean' ? v : dflt);
const oneOf = <T extends string>(v: unknown, allowed: readonly T[], dflt: T): T =>
  typeof v === 'string' && (allowed as readonly string[]).includes(v) ? (v as T) : dflt;

/** Field-level validation: a corrupt field falls back alone, never the whole object (SRS-COR-21). */
export function sanitizeSettings(raw: unknown, prefersReducedMotion = false): Settings {
  const d = defaultSettings(prefersReducedMotion);
  if (typeof raw !== 'object' || raw === null) return d;
  const r = raw as Record<string, unknown>;
  return {
    schemaVersion: 1,
    fov: num(r.fov, 60, 100, d.fov),
    moveSpeed: oneOf(r.moveSpeed, ['slow', 'normal', 'fast'] as const, d.moveSpeed),
    sensitivityX: num(r.sensitivityX, 0.1, 3.0, d.sensitivityX),
    sensitivityY: num(r.sensitivityY, 0.1, 3.0, d.sensitivityY),
    invertY: bool(r.invertY, d.invertY),
    headBob: num(r.headBob, 0, 1, d.headBob),
    cameraExtras: bool(r.cameraExtras, d.cameraExtras),
    motionBlur: bool(r.motionBlur, d.motionBlur),
    mouseSmoothing: bool(r.mouseSmoothing, d.mouseSmoothing),
    bgAnimation: num(r.bgAnimation, 0, 1, d.bgAnimation),
    quality: oneOf(r.quality, ['auto', 'low', 'med', 'high'] as const, d.quality),
    masterVolume: num(r.masterVolume, 0, 1, d.masterVolume),
    muted: bool(r.muted, d.muted),
    keyLayout: oneOf(r.keyLayout, ['wasd', 'arrows'] as const, d.keyLayout),
    comfortProfile: oneOf(r.comfortProfile, ['sensitive', 'normal', 'custom'] as const, d.comfortProfile),
    comfortTouchedByUser: bool(r.comfortTouchedByUser, d.comfortTouchedByUser),
    visited: bool(r.visited, d.visited),
  };
}

/** Sensitive profile forces the comfort set (SRS-COR-23). */
export function applyComfortProfile(s: Settings, profile: Exclude<ComfortProfile, 'custom'>): Settings {
  if (profile === 'sensitive') {
    return {
      ...s,
      comfortProfile: 'sensitive',
      headBob: 0,
      cameraExtras: false,
      motionBlur: false,
      mouseSmoothing: false,
      bgAnimation: Math.min(s.bgAnimation, 0.3),
    };
  }
  return { ...s, comfortProfile: 'normal' };
}

/** After a user edit, detect whether the sensitive profile has been broken -> 'custom'. */
export function resolveComfortProfile(s: Settings): ComfortProfile {
  if (s.comfortProfile !== 'sensitive') return s.comfortProfile;
  const intact =
    s.headBob === 0 && !s.cameraExtras && !s.motionBlur && !s.mouseSmoothing && s.bgAnimation <= 0.3;
  return intact ? 'sensitive' : 'custom';
}

export const MOVE_SPEED_MPS: Record<Settings['moveSpeed'], number> = {
  slow: 1.0,
  normal: 1.6,
  fast: 2.4,
};
/** 1.0 sensitivity = 0.002 rad/px (SRS-COR-21 mapping). */
export const LOOK_RAD_PER_PX = 0.002;

// ---------------------------------------------------------------------------
// Persistence (browser side). In-memory fallback when storage is unavailable.
// ---------------------------------------------------------------------------

export interface SettingsStore {
  load(): Settings;
  /** Debounced save; `immediate` bypasses debounce (visited flag, pagehide flush). */
  save(s: Settings, immediate?: boolean): void;
  flush(): void;
}

export function createSettingsStore(prefersReducedMotion: boolean): SettingsStore {
  let memory: Settings | null = null;
  let pending: Settings | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const write = (s: Settings): void => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
    } catch {
      memory = s; // storage blocked — session-only fallback (ERR-6: silent)
    }
  };

  return {
    load(): Settings {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw !== null) return sanitizeSettings(JSON.parse(raw), prefersReducedMotion);
      } catch {
        /* fall through */
      }
      return memory ?? defaultSettings(prefersReducedMotion);
    },
    save(s: Settings, immediate = false): void {
      pending = s;
      if (immediate) {
        this.flush();
        return;
      }
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => this.flush(), SAVE_DEBOUNCE_MS);
    },
    flush(): void {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      if (pending !== null) {
        write(pending);
        pending = null;
      }
    },
  };
}
