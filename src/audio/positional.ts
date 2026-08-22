// audio/positional — HRTF positional sources (SRS-AUD-4).
// three.js PositionalAudio already defaults panningModel to 'HRTF' (verified in source).
// We must: force distanceModel='linear', rewire gain into spatialBus, keep sources playing
// and silence via their own GainNode (HRTF convolver create/destroy cost avoidance).

import { PositionalAudio, type AudioListener, type Object3D } from 'three';
import type { AudioGraph } from './graph';
import { fadeTo } from './scheduler';

export const MAX_POSITIONAL = 8;

export interface PositionalHandle {
  node: PositionalAudio;
  level: GainNode;
  setLevel(target: number, seconds?: number): void;
}

export class PositionalPool {
  private graph: AudioGraph;
  private listener: AudioListener;
  private handles: PositionalHandle[] = [];

  constructor(graph: AudioGraph, listener: AudioListener) {
    this.graph = graph;
    this.listener = listener;
  }

  /**
   * Create a looping mono positional source attached to `parent`.
   * `maxDistance` is per-scene (viewing bounds vs corridor guide — SRS-AUD-4).
   */
  create(
    parent: Object3D,
    buffer: AudioBuffer,
    opts: { refDistance?: number; maxDistance: number; level?: number },
  ): PositionalHandle | null {
    if (this.handles.length >= MAX_POSITIONAL) {
      if (import.meta.env.DEV) console.warn('[audio] positional budget (8) exceeded — skipped');
      return null;
    }
    const ctx = this.graph.ctx;
    const node = new PositionalAudio(this.listener);

    // Normative wiring (SRS-AUD-1): detach from listener input, route through our bus.
    node.gain.disconnect();
    const level = ctx.createGain();
    level.gain.value = opts.level ?? 1;
    node.gain.connect(level);
    level.connect(this.graph.spatialBus);

    node.panner.distanceModel = 'linear'; // default 'inverse' never reaches 0 — audit/J
    node.panner.refDistance = opts.refDistance ?? 6;
    node.panner.maxDistance = opts.maxDistance;
    node.panner.rolloffFactor = 1;

    node.setBuffer(buffer);
    node.setLoop(true);
    parent.add(node);
    node.play();

    const handle: PositionalHandle = {
      node,
      level,
      setLevel: (target, seconds = 0.5) => fadeTo(ctx, level, target, seconds),
    };
    this.handles.push(handle);
    return handle;
  }

  get count(): number {
    return this.handles.length;
  }
}

/** Synthesized mono loop for positional sources (placeholder until real sources adopted). */
export function makeGuideBuffer(ctx: AudioContext, seconds = 23): AudioBuffer {
  const frames = Math.floor(seconds * ctx.sampleRate);
  const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
  const data = buf.getChannelData(0);
  let lp = 0;
  for (let i = 0; i < frames; i++) {
    const t = i / ctx.sampleRate;
    const swell = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / seconds - Math.PI / 2);
    const noise = Math.random() * 2 - 1;
    lp += 0.035 * (noise - lp);
    data[i] = lp * swell * 2.0;
  }
  return buf;
}
