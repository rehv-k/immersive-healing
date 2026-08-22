// scene/quality — initial GPU-tier preset + runtime adaptation driver (SRS §8.2).
// fps windows are only collected in hall / !paused / visible; unknown GPU starts Low.

import { getGPUTier } from 'detect-gpu';
import type { AppState, Preset } from '../types';
import { store } from '../core/store';
import { feedWindow, initialAdapt, type AdaptState } from './adaptation';

const WINDOW_S = 2;
const WARMUP_FRAMES = 30;

export class QualityController {
  private adapt: AdaptState;
  private frames = 0;
  private windowTime = 0;
  private warmup = WARMUP_FRAMES;
  private displayFrames = 0;
  private displayTime = 0;
  private frameTimes: number[] = [];
  private onChange: (preset: Preset, scale: number) => void;

  constructor(onChange: (preset: Preset, scale: number) => void) {
    this.adapt = initialAdapt('low', false);
    this.onChange = onChange;
    this.publish();
    // Apply the safe Low preset immediately so the renderer is sized before (and
    // regardless of) async GPU detection — detect-gpu fetches benchmark data over
    // the network and may hang offline (unknown GPU → start Low, SRS §8.2).
    queueMicrotask(() => this.onChange(this.adapt.preset, this.adapt.renderScale));
  }

  /** Unknown tier → Low then runtime upscale (SRS §8.2). Detection is time-boxed. */
  async detect(manual: Preset | 'auto'): Promise<void> {
    if (manual !== 'auto') {
      this.adapt = initialAdapt(manual, true);
      this.publish();
      this.onChange(this.adapt.preset, this.adapt.renderScale);
      return;
    }
    let preset: Preset = 'low';
    try {
      const tier = await Promise.race([
        getGPUTier(),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('detect timeout')), 4000)),
      ]);
      preset = tier.tier >= 3 ? 'high' : tier.tier === 2 ? 'med' : 'low';
    } catch {
      preset = 'low';
    }
    this.adapt = initialAdapt(preset, false);
    this.publish();
    this.onChange(this.adapt.preset, this.adapt.renderScale);
  }

  setManual(preset: Preset | 'auto'): void {
    void this.detect(preset);
  }

  get preset(): Preset {
    return this.adapt.preset;
  }
  get renderScale(): number {
    return this.adapt.renderScale;
  }

  /** 1%-low estimate over recent frames (debug overlay / measurement export). */
  get onePercentLow(): number {
    if (this.frameTimes.length < 20) return 0;
    const sorted = [...this.frameTimes].sort((a, b) => b - a);
    const worst = sorted.slice(0, Math.max(1, Math.floor(sorted.length / 100)));
    const avg = worst.reduce((a, b) => a + b, 0) / worst.length;
    return avg > 0 ? 1000 / avg : 0;
  }

  tick(dt: number, app: AppState): void {
    // Display fps (1s moving) — always collected.
    this.displayFrames++;
    this.displayTime += dt;
    if (this.displayTime >= 1) {
      store.publishSys({ fpsDisplay: Math.round(this.displayFrames / this.displayTime) });
      this.displayFrames = 0;
      this.displayTime = 0;
    }
    this.frameTimes.push(dt * 1000);
    if (this.frameTimes.length > 600) this.frameTimes.shift();

    // Adaptation window — gated (SRS §8.2 collection condition).
    const collecting =
      app.scene.state === 'hall' && !app.scene.paused && document.visibilityState === 'visible';
    if (!collecting) {
      this.frames = 0;
      this.windowTime = 0;
      this.warmup = WARMUP_FRAMES;
      return;
    }
    if (this.warmup > 0) {
      this.warmup--;
      return;
    }
    this.frames++;
    this.windowTime += dt;
    if (this.windowTime >= WINDOW_S) {
      const fps = this.frames / this.windowTime;
      this.frames = 0;
      this.windowTime = 0;
      store.publishSys({ fpsWindow: Math.round(fps) });
      const res = feedWindow(this.adapt, fps, performance.now(), window.devicePixelRatio || 1);
      this.adapt = res.next;
      if (res.changed !== 'none') {
        this.publish();
        this.onChange(this.adapt.preset, this.adapt.renderScale);
      }
    }
  }

  private publish(): void {
    store.publishSys({ preset: this.adapt.preset, renderScale: this.adapt.renderScale });
  }
}
