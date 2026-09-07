// audio/ambience — layered short loops that follow the sky (SRS-AUD-3, SRS-AUD-9).
// DEV NOTE (DEVLOG "사용자 확인 항목"): real CC0/CC-BY sources are a licensing decision.
// Until then, layers are SYNTHESIZED at runtime (filtered noise / sine pads) — zero assets,
// sample-accurate AudioBufferSourceNode loops, differing lengths so repetition stays unnoticed.
// v5: five layers. Golden hour = waves + wind + warm pad; night = quieter waves, a faint
// high "night air" shimmer and a low drone. Per-layer gains ramp with the sun (phaseMix).

import type { AudioGraph } from './graph';
import { DAY_GAINS, type LayerGains, type LayerName } from './phaseMix';
import { fadeTo } from './scheduler';

interface Layer {
  name: LayerName;
  seconds: number;
  build: (data: Float32Array, sampleRate: number) => void;
}

/** Slow ocean-like swell: lowpassed noise with an LFO envelope. */
function buildWaves(data: Float32Array, sr: number): void {
  let lp = 0;
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const swell = 0.55 + 0.45 * Math.sin((2 * Math.PI * t) / 11.3);
    const noise = Math.random() * 2 - 1;
    lp += 0.02 * (noise - lp);
    data[i] = lp * swell * 2.2;
  }
  loopBlend(data, sr, 1.5);
}

/** Soft wind: band-limited noise, slower amplitude drift. */
function buildWind(data: Float32Array, sr: number): void {
  let lp = 0;
  let lp2 = 0;
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const drift = 0.6 + 0.4 * Math.sin((2 * Math.PI * t) / 17.7 + 1.3);
    const noise = Math.random() * 2 - 1;
    lp += 0.06 * (noise - lp);
    lp2 += 0.06 * (lp - lp2);
    data[i] = (lp - lp2) * drift * 3.0;
  }
  loopBlend(data, sr, 1.5);
}

/** Sparse warm shimmer: slow detuned sine pad, very quiet. */
function buildPad(data: Float32Array, sr: number): void {
  const n = data.length;
  const loopSec = n / sr;
  const f1 = Math.round(110 * loopSec) / loopSec;
  const f2 = Math.round(110.7 * loopSec) / loopSec;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / loopSec - Math.PI / 2);
    data[i] = (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t)) * 0.06 * env;
  }
}

/** Night air: a faint high band (≈1.5–2.7 kHz) of noise breathing very slowly. */
function buildNightAir(data: Float32Array, sr: number): void {
  let lp = 0;
  let lp2 = 0;
  const n = data.length;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const drift = 0.5 + 0.5 * Math.sin((2 * Math.PI * t) / 19.1 + 0.4);
    const noise = Math.random() * 2 - 1;
    lp += 0.35 * (noise - lp);
    lp2 += 0.2 * (lp - lp2);
    data[i] = (lp - lp2) * drift * 1.2;
  }
  loopBlend(data, sr, 2.0);
}

/** Low drone: two consonant sines (55 Hz + fifth) with a slow swell — the night floor. */
function buildDrone(data: Float32Array, sr: number): void {
  const n = data.length;
  const loopSec = n / sr;
  const f1 = Math.round(55 * loopSec) / loopSec;
  const f2 = Math.round(82.5 * loopSec) / loopSec;
  for (let i = 0; i < n; i++) {
    const t = i / sr;
    const env = 0.6 + 0.4 * Math.sin((2 * Math.PI * t) / loopSec - Math.PI / 2);
    data[i] = (Math.sin(2 * Math.PI * f1 * t) * 0.7 + Math.sin(2 * Math.PI * f2 * t) * 0.4) * 0.12 * env;
  }
}

/** Crossfade tail into head so noise-based loops have no seam. */
function loopBlend(data: Float32Array, sr: number, seconds: number): void {
  const n = data.length;
  const m = Math.min(Math.floor(seconds * sr), Math.floor(n / 4));
  for (let i = 0; i < m; i++) {
    const w = i / m;
    const head = data[i] ?? 0;
    const tail = data[n - m + i] ?? 0;
    data[i] = head * w + tail * (1 - w);
  }
  data.fill(0, n - 8, n);
}

const LAYERS: Layer[] = [
  { name: 'waves', seconds: 37, build: buildWaves },
  { name: 'wind', seconds: 53, build: buildWind },
  { name: 'pad', seconds: 71, build: buildPad },
  { name: 'nightAir', seconds: 43, build: buildNightAir },
  { name: 'drone', seconds: 61, build: buildDrone },
];

export class Ambience {
  private graph: AudioGraph;
  private sources: AudioBufferSourceNode[] = [];
  private gains = new Map<LayerName, GainNode>();
  private ready = false;

  constructor(graph: AudioGraph) {
    this.graph = graph;
  }

  /** Buffers are built synchronously in JS (~ a few MB mono each) — counts as audio-base. */
  prepare(): void {
    if (this.ready) return;
    const ctx = this.graph.ctx;
    for (const layer of LAYERS) {
      const frames = Math.floor(layer.seconds * ctx.sampleRate);
      const buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      const data = buf.getChannelData(0);
      layer.build(data as unknown as Float32Array, ctx.sampleRate);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      const g = ctx.createGain();
      g.gain.value = DAY_GAINS[layer.name];
      src.connect(g);
      g.connect(this.graph.ambienceBus);
      this.sources.push(src);
      this.gains.set(layer.name, g);
    }
    this.ready = true;
  }

  start(): void {
    this.prepare();
    const t = this.graph.ctx.currentTime + 0.05;
    let offset = 0;
    for (const src of this.sources) {
      try {
        src.start(t, offset);
      } catch {
        /* already started */
      }
      offset += 7.3; // differing start offsets (SRS-AUD-3)
    }
  }

  /** Ramp every layer toward the phase mix — ctx-clock scheduled (SRS-AUD-2). */
  setGains(target: LayerGains, seconds = 2.0): void {
    if (!this.ready) return;
    for (const [name, g] of this.gains) fadeTo(this.graph.ctx, g, target[name], seconds);
  }
}
