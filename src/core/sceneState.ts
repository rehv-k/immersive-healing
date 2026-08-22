// core/sceneState — the state machine and the single action handler (SRS-COR-3x, §4.2).
// All scene.state / paused / settings writes happen here (writer rule §2.1-3).

import type { Action, AppState, SceneState, Settings } from '../types';
import { store } from './store';
import {
  applyComfortProfile,
  createSettingsStore,
  resolveComfortProfile,
  type SettingsStore,
} from './settings';
import { track } from '../analytics/track';

export const TRANSITIONS: Record<SceneState, SceneState[]> = {
  boot: ['gate', 'unsupported'],
  unsupported: [],
  gate: ['corridor', 'hall'],
  corridor: ['hall', 'exiting'],
  hall: ['exiting'],
  exiting: ['gate'],
};

export function canTransition(from: SceneState, to: SceneState): boolean {
  return TRANSITIONS[from].includes(to);
}

export function canPauseIn(state: SceneState): boolean {
  return state === 'corridor' || state === 'hall';
}

type Hook = (from: SceneState, to: SceneState) => void;

class SceneStateMachine {
  private enterHooks = new Map<SceneState, Hook[]>();
  private exitHooks = new Map<SceneState, Hook[]>();
  private settingsStore: SettingsStore | null = null;
  private enteredAt = 0;
  private hallReachedAt = 0;

  init(settingsStore: SettingsStore): void {
    this.settingsStore = settingsStore;
    store.coreSet((s) => {
      s.settings = settingsStore.load();
    });
    store.setActionHandler((a) => this.handle(a));

    // Flush pending settings writes when the page goes away (SRS-COR-22).
    addEventListener('pagehide', () => settingsStore.flush());
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') settingsStore.flush();
    });
  }

  onEnter(state: SceneState, hook: Hook): void {
    const list = this.enterHooks.get(state) ?? [];
    list.push(hook);
    this.enterHooks.set(state, list);
  }

  onExit(state: SceneState, hook: Hook): void {
    const list = this.exitHooks.get(state) ?? [];
    list.push(hook);
    this.exitHooks.set(state, list);
  }

  /** Transition with guard; ignored (dev-warn) when not allowed (SRS-COR-30). */
  transition(to: SceneState): boolean {
    const s = store.get().scene;
    if (s.transitioning) return false; // requests during a transition are dropped, not queued
    if (!canTransition(s.state, to)) {
      if (import.meta.env.DEV) console.warn(`[scene] blocked transition ${s.state} -> ${to}`);
      return false;
    }
    const from = s.state;
    store.coreSet((st) => {
      st.scene.state = to;
      st.scene.paused = false;
      st.scene.pausedFrom = null;
    });
    for (const h of this.exitHooks.get(from) ?? []) h(from, to);
    for (const h of this.enterHooks.get(to) ?? []) h(from, to);
    this.onStateEntered(from, to);
    return true;
  }

  setTransitioning(v: boolean): void {
    store.coreSet((s) => {
      s.scene.transitioning = v;
    });
  }

  /** Pause entry — called by inputSession on visible pointer-unlock only (SRS-COR-32). */
  enterPaused(): void {
    const s = store.get().scene;
    if (s.paused || !canPauseIn(s.state)) return;
    store.coreSet((st) => {
      st.scene.paused = true;
      st.scene.pausedFrom = st.scene.state;
    });
  }

  exitPaused(): void {
    if (!store.get().scene.paused) return;
    store.coreSet((st) => {
      st.scene.paused = false;
      st.scene.pausedFrom = null;
    });
  }

  markHallReached(): void {
    this.hallReachedAt = performance.now();
    // visited: recorded synchronously on first hall arrival, bypassing debounce (SRS-COR-21).
    const cur = store.get().settings;
    if (!cur.visited) {
      const next: Settings = { ...cur, visited: true };
      store.coreSet((s) => {
        s.settings = next;
      });
      this.settingsStore?.save(next, true);
    }
    track('hall_reached', { secondsFromEnter: (performance.now() - this.enteredAt) / 1000 });
  }

  private onStateEntered(from: SceneState, to: SceneState): void {
    if (to === 'corridor' || (to === 'hall' && from === 'gate')) {
      this.enteredAt = performance.now();
    }
    if (to === 'exiting') {
      track('exit', {
        from,
        totalSeconds: this.enteredAt ? (performance.now() - this.enteredAt) / 1000 : 0,
      });
    }
  }

  private handle(a: Action): void {
    const state = store.get();
    switch (a.type) {
      case 'enterRequested':
        // inputSession performs resume+lock; on success it calls back into enterGranted().
        // Handled in main via wiring; here we only validate state.
        break;
      case 'skipCorridor':
        if (state.scene.state === 'corridor') this.transition('hall');
        break;
      case 'pauseResume':
        // resume path: inputSession re-requests pointer lock; exitPaused on lock success.
        break;
      case 'exitRequested':
        if (state.scene.state === 'corridor' || state.scene.state === 'hall') {
          this.exitPaused();
          this.transition('exiting');
        }
        break;
      case 'reenterRequested':
        if (state.scene.state === 'exiting') this.transition('gate');
        break;
      case 'settingsChanged': {
        const merged: Settings = { ...state.settings, ...a.patch, schemaVersion: 1 };
        const touched =
          state.settings.comfortTouchedByUser ||
          Object.keys(a.patch).some((k) => k !== 'visited');
        let next: Settings = { ...merged, comfortTouchedByUser: touched };
        if ('comfortProfile' in a.patch && a.patch.comfortProfile !== 'custom') {
          next = applyComfortProfile(next, a.patch.comfortProfile as 'sensitive' | 'normal');
        } else {
          next = { ...next, comfortProfile: resolveComfortProfile(next) };
        }
        store.coreSet((s) => {
          s.settings = next;
        });
        this.settingsStore?.save(next);
        break;
      }
      case 'muteToggled': {
        const next: Settings = { ...state.settings, muted: !state.settings.muted };
        store.coreSet((s) => {
          s.settings = next;
        });
        this.settingsStore?.save(next);
        break;
      }
      case 'openSettings':
        store.coreSet((s) => {
          s.ui.settingsOpen = true;
        });
        break;
      case 'closeSettings':
        store.coreSet((s) => {
          s.ui.settingsOpen = false;
        });
        break;
      case 'openCredits':
        store.coreSet((s) => {
          s.ui.creditsOpen = true;
        });
        break;
      case 'closeCredits':
        store.coreSet((s) => {
          s.ui.creditsOpen = false;
        });
        break;
      case 'noticeDismissed':
        store.removeNotice(a.id);
        break;
      case 'noticeRetried':
        // Retry semantics are owned by the module that pushed the notice; it subscribes
        // to notices removal + retry channel. We simply remove here; retry callbacks
        // are registered via onNoticeRetry.
        for (const cb of this.retryCallbacks.get(a.id) ?? []) cb();
        store.removeNotice(a.id);
        break;
    }
  }

  private retryCallbacks = new Map<string, Array<() => void>>();
  onNoticeRetry(id: string, cb: () => void): void {
    const list = this.retryCallbacks.get(id) ?? [];
    list.push(cb);
    this.retryCallbacks.set(id, list);
  }
}

export const sceneMachine = new SceneStateMachine();

export function initCore(prefersReducedMotion: boolean): SettingsStore {
  const s = createSettingsStore(prefersReducedMotion);
  sceneMachine.init(s);
  return s;
}
