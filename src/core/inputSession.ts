// core/inputSession — sole owner of Pointer Lock / Fullscreen / visibility APIs (SRS-COR-5x).
// ui dispatches actions; scene reads sys.pointerLocked. Nobody else touches these APIs.

import { store } from './store';
import { sceneMachine, canPauseIn } from './sceneState';

const RESUME_COOLDOWN_MS = 1500; // browser re-lock cooldown absorbed in UX (SRS-COR-32)

export class InputSession {
  private canvas: HTMLCanvasElement;
  private appInitiatedUnlock = false;
  private lastPauseAt = 0;
  private fullscreenWanted = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    document.addEventListener('pointerlockchange', () => this.onLockChange());
    document.addEventListener('pointerlockerror', () => this.onLockError());
    document.addEventListener('fullscreenchange', () => this.onFullscreenChange());
    document.addEventListener('visibilitychange', () => this.onVisibilityChange());
  }

  static isSupported(): boolean {
    return 'requestPointerLock' in Element.prototype;
  }

  setFullscreenWanted(v: boolean): void {
    this.fullscreenWanted = v;
  }

  /** Must be called inside a user-gesture handler. 2-step fallback (SRS-COR-51). */
  async requestLock(): Promise<boolean> {
    try {
      // Newer engines return a Promise and accept options; older ones throw on options.
      const el = this.canvas as HTMLCanvasElement & {
        requestPointerLock(options?: { unadjustedMovement?: boolean }): Promise<void> | void;
      };
      try {
        await Promise.resolve(el.requestPointerLock({ unadjustedMovement: true }));
      } catch {
        await Promise.resolve(el.requestPointerLock());
      }
    } catch {
      // Result is judged via pointerlockchange/pointerlockerror events regardless.
    }
    // Success is determined by the event (browser variance) — poll one macrotask.
    await new Promise((r) => setTimeout(r, 50));
    return document.pointerLockElement === this.canvas;
  }

  /** Fullscreen is optional enhancement; failures are harmless (SRS-COR-52). */
  async requestFullscreenIfWanted(): Promise<void> {
    if (!this.fullscreenWanted) return;
    try {
      await document.documentElement.requestFullscreen();
    } catch {
      /* non-essential */
    }
  }

  msUntilResumeAllowed(): number {
    return Math.max(0, RESUME_COOLDOWN_MS - (performance.now() - this.lastPauseAt));
  }

  releaseLock(): void {
    if (document.pointerLockElement) {
      this.appInitiatedUnlock = true;
      document.exitPointerLock();
    }
  }

  clearBackgroundUnlocked(): void {
    store.publishSys({ backgroundUnlocked: false });
  }

  private onLockChange(): void {
    const locked = document.pointerLockElement === this.canvas;
    store.publishSys({ pointerLocked: locked });
    if (locked) {
      store.publishSys({ backgroundUnlocked: false });
      sceneMachine.exitPaused();
      return;
    }
    // Unlocked.
    const scene = store.get().scene;
    if (document.visibilityState === 'hidden') {
      // Tab switch: NOT a pause — audio keeps playing at full volume (SRS-COR-32 / audit B2).
      store.publishSys({ backgroundUnlocked: true });
      return;
    }
    if (this.appInitiatedUnlock) {
      this.appInitiatedUnlock = false;
      if (canPauseIn(scene.state)) {
        sceneMachine.enterPaused(); // app-driven normalization — no cooldown penalty
      }
      return;
    }
    if (canPauseIn(scene.state) && !scene.paused) {
      this.lastPauseAt = performance.now();
      sceneMachine.enterPaused();
    }
  }

  private onLockError(): void {
    store.pushNotice({
      id: 'pointer-lock',
      kind: 'pointer-lock',
      severity: 'toast',
      retryable: true,
      at: Date.now(),
      message: '시점 잠금에 실패했어요. 화면을 다시 클릭해 주세요.',
    });
  }

  private onFullscreenChange(): void {
    // Fullscreen dropped but lock survived -> normalize to paused via app-driven unlock
    // (some browsers only exit fullscreen on Esc). SRS-COR-32.
    if (!document.fullscreenElement && document.pointerLockElement === this.canvas) {
      const scene = store.get().scene;
      if (canPauseIn(scene.state)) this.releaseLock();
    }
  }

  private onVisibilityChange(): void {
    // Deliberately no audio suspend here (SRS-AUD-7). Video recovery handled by screen module.
  }
}
