// audio/graph — AudioContext ownership + 3-stage bus mixer (SRS-AUD-1).
//   sources -> ambienceBus/spatialBus/uiBus -> userVolumeBus -> duckBus -> muteBus -> destination
// Boot order is normative: create ctx -> THREE.AudioContext.setContext(ctx) -> (later) AudioListener.

import { AudioContext as ThreeAudioContext } from 'three';
import { store } from '../core/store';
import { fadeTo } from './scheduler';

export const PAUSE_DUCK = 0.35; // -9 dB equivalent (SRS-AUD-5, user decision)
const DUCK_SECONDS = 1.0;
const MUTE_SECONDS = 0.15;

export class AudioGraph {
  readonly ctx: AudioContext;
  readonly ambienceBus: GainNode;
  readonly spatialBus: GainNode;
  readonly uiBus: GainNode;
  readonly userVolumeBus: GainNode;
  readonly duckBus: GainNode;
  readonly muteBus: GainNode;
  /** Tab-visibility mute (user decision 2026-08-22: sound only while viewing). */
  readonly visibilityBus: GainNode;

  constructor() {
    this.ctx = new AudioContext();
    // Must run BEFORE any THREE.AudioListener is constructed (SRS-AUD-1 boot order).
    ThreeAudioContext.setContext(this.ctx);

    this.ambienceBus = this.ctx.createGain();
    this.spatialBus = this.ctx.createGain();
    this.uiBus = this.ctx.createGain();
    this.userVolumeBus = this.ctx.createGain();
    this.duckBus = this.ctx.createGain();
    this.muteBus = this.ctx.createGain();
    this.visibilityBus = this.ctx.createGain();

    this.ambienceBus.connect(this.userVolumeBus);
    this.spatialBus.connect(this.userVolumeBus);
    this.uiBus.connect(this.userVolumeBus);
    this.userVolumeBus.connect(this.duckBus);
    this.duckBus.connect(this.muteBus);
    this.muteBus.connect(this.visibilityBus);
    this.visibilityBus.connect(this.ctx.destination);

    this.ambienceBus.gain.value = 0; // faded in on corridor enter
    this.spatialBus.gain.value = 1;
    this.uiBus.gain.value = 1;
    this.userVolumeBus.gain.value = 0.8;
    this.duckBus.gain.value = 1;
    this.muteBus.gain.value = 1;

    this.ctx.onstatechange = () => {
      store.publishSys({ audioState: this.ctx.state });
      // 'closed' (device change etc.) requires full graph rebuild — surfaced as notice;
      // rebuild is coordinated by main (ERR-3 split, SRS-AUD-7).
      if ((this.ctx.state as string) === 'closed') {
        store.pushNotice({
          id: 'audio-closed',
          kind: 'audio-resume',
          severity: 'toast',
          retryable: true,
          at: Date.now(),
          message: '오디오 장치가 변경되었어요. 화면을 클릭하면 소리를 복구합니다.',
        });
      }
    };
    store.publishSys({ audioState: this.ctx.state });
  }

  /** Call from a user gesture (gate click). */
  async resume(): Promise<boolean> {
    try {
      await this.ctx.resume();
    } catch {
      /* judged by state below */
    }
    store.publishSys({ audioState: this.ctx.state });
    return this.ctx.state === 'running';
  }

  // Each volume source ramps ONLY its own bus (SRS-AUD-1 — no combination conflicts).
  setUserVolume(v: number): void {
    fadeTo(this.ctx, this.userVolumeBus, Math.min(1, Math.max(0, v)), 0.05);
  }
  setDucked(ducked: boolean): void {
    fadeTo(this.ctx, this.duckBus, ducked ? PAUSE_DUCK : 1, DUCK_SECONDS);
  }
  setMuted(muted: boolean): void {
    fadeTo(this.ctx, this.muteBus, muted ? 0 : 1, MUTE_SECONDS);
  }
  /** Sound only while the tab is visible (user decision — replaces the old
   *  background-playback requirement; context stays running, only gain drops). */
  setHidden(hidden: boolean): void {
    fadeTo(this.ctx, this.visibilityBus, hidden ? 0 : 1, hidden ? 0.25 : 0.6);
  }
  fadeAmbience(target: number, seconds: number): void {
    fadeTo(this.ctx, this.ambienceBus, target, seconds);
  }
}
