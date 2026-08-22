// core/store — tiny pub/sub state tree (SRS-COR-1x).
// Writer rules: ui dispatches actions (handled in core), scene/audio publish sys.* only.
// Re-entrant writes are queued as microtasks (depth cap 8) — SRS-COR-10.

import type { Action, AppState, Notice, SysSlice } from '../types';
import { defaultSettings } from './settings';

type Selector<T> = (s: AppState) => T;
type Listener<T> = (value: T, state: AppState) => void;

interface Subscription {
  selector: Selector<unknown>;
  cb: Listener<unknown>;
  last: unknown;
}

const MAX_FLUSH_DEPTH = 8;

export type ActionHandler = (action: Action) => void;

class Store {
  private state: AppState;
  private subs = new Set<Subscription>();
  private notifying = false;
  private queue: Array<() => void> = [];
  private flushScheduled = false;
  private flushDepth = 0;
  private actionHandler: ActionHandler | null = null;

  constructor() {
    this.state = {
      scene: { state: 'boot', paused: false, pausedFrom: null, transitioning: false },
      ui: { settingsOpen: false, creditsOpen: false },
      settings: defaultSettings(),
      sys: {
        loadProgress: 0,
        hallProgress: 0,
        corridorReady: false,
        hallLqReady: false,
        hallHqReady: false,
        fpsDisplay: 0,
        fpsWindow: 0,
        renderScale: 1,
        preset: 'low',
        rendition: '1080p',
        audioState: 'uninitialized',
        pointerLocked: false,
        backgroundUnlocked: false,
        notices: [],
      },
    };
  }

  get(): AppState {
    return this.state;
  }

  /** core-internal write. Not exported to ui/scene/audio (check-arch enforces). */
  coreSet(mutate: (draft: AppState) => void): void {
    if (this.notifying) {
      this.enqueue(() => this.coreSet(mutate));
      return;
    }
    mutate(this.state);
    this.notify();
  }

  /** scene/audio: publish observed values into sys.* only (SRS-COR-11). */
  publishSys(patch: Partial<SysSlice>): void {
    this.coreSet((s) => {
      Object.assign(s.sys, patch);
    });
  }

  pushNotice(n: Notice): void {
    this.coreSet((s) => {
      if (!s.sys.notices.some((x) => x.id === n.id)) s.sys.notices = [...s.sys.notices, n];
    });
  }

  removeNotice(id: string): void {
    this.coreSet((s) => {
      s.sys.notices = s.sys.notices.filter((x) => x.id !== id);
    });
  }

  /** ui entry point. The single action handler lives in core/sceneState. */
  dispatch(action: Action): void {
    if (!this.actionHandler) {
      if (import.meta.env.DEV) console.warn('[store] dispatch before handler ready', action);
      return;
    }
    if (this.notifying) {
      this.enqueue(() => this.dispatch(action));
      return;
    }
    this.actionHandler(action);
  }

  setActionHandler(h: ActionHandler): void {
    this.actionHandler = h;
  }

  /** immediate=true (default): callback runs synchronously with current value (SRS-COR-10). */
  subscribe<T>(selector: Selector<T>, cb: Listener<T>, opts?: { immediate?: boolean }): () => void {
    const sub: Subscription = {
      selector: selector as Selector<unknown>,
      cb: cb as Listener<unknown>,
      last: selector(this.state),
    };
    this.subs.add(sub);
    if (opts?.immediate !== false) cb(selector(this.state), this.state);
    return () => this.subs.delete(sub);
  }

  private notify(): void {
    this.notifying = true;
    try {
      for (const sub of this.subs) {
        const next = sub.selector(this.state);
        if (!shallowEq(next, sub.last)) {
          sub.last = next;
          sub.cb(next, this.state);
        }
      }
    } finally {
      this.notifying = false;
    }
  }

  private enqueue(fn: () => void): void {
    this.queue.push(fn);
    if (!this.flushScheduled) {
      this.flushScheduled = true;
      queueMicrotask(() => this.flush());
    }
  }

  private flush(): void {
    this.flushScheduled = false;
    this.flushDepth++;
    if (this.flushDepth > MAX_FLUSH_DEPTH) {
      this.flushDepth = 0;
      const msg = '[store] re-entrant flush depth exceeded';
      if (import.meta.env.DEV) throw new Error(msg);
      console.error(msg);
      this.queue.length = 0;
      return;
    }
    const batch = this.queue.splice(0, this.queue.length);
    for (const fn of batch) fn();
    this.flushDepth = 0;
  }
}

function shallowEq(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  const ka = Object.keys(a as object);
  const kb = Object.keys(b as object);
  if (ka.length !== kb.length) return false;
  for (const k of ka) {
    if (!Object.is((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k])) return false;
  }
  return true;
}

export const store = new Store();
