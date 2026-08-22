// scene/screen — sunset video pipeline (SRS-VID-1~7).
// Dual <video> A/B swap with shader crossfade; rVFC-gated texture updates (with fallback);
// cascading rendition fallback; procedural sunset shader when no media is available.

import {
  LinearFilter,
  Mesh,
  NoColorSpace,
  PointLight,
  ShaderMaterial,
  VideoTexture,
} from 'three';
import type { Rendition } from '../types';
import { store } from '../core/store';
import { stepDown } from './renditionSelect';

const SWAP_TRIGGER_S = 0.5; // remaining time that arms the swap (SRS-VID-3 v1.1)
const SWAP_RAMP_S = 0.25; // uMix ramp — 60% of trigger margin
const WATCHDOG_S = 1.0;
const STALL_TIMEOUT_MS = 5000;
const AVG_COLOR_INTERVAL_MS = 250;

// Manual sRGB decode in-shader: textures are tagged NoColorSpace and decoded here so the
// single end-of-pipeline tone mapping stays correct (SRS-SCN-11 / V8).
const FRAG = /* glsl */ `
  uniform sampler2D texA;
  uniform sampler2D texB;
  uniform float uMix;
  uniform float uProcedural;
  uniform float uTime;
  varying vec2 vUv;

  vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

  // Procedural sunset fallback: calm vertical gradient + slow sun glow, loop-safe by design.
  vec3 proceduralSunset(vec2 uv, float t) {
    float cycle = 0.5 + 0.5 * sin(t * 0.02);          // very slow breathing, no flashing
    vec3 skyTop = mix(vec3(0.10, 0.12, 0.25), vec3(0.06, 0.08, 0.20), cycle);
    vec3 horizon = mix(vec3(0.95, 0.45, 0.15), vec3(0.85, 0.35, 0.20), cycle);
    vec3 col = mix(horizon, skyTop, smoothstep(0.18, 0.85, uv.y));
    vec2 sun = vec2(0.5, 0.16);
    float d = distance(uv * vec2(1.78, 1.0), sun * vec2(1.78, 1.0));
    col += vec3(1.0, 0.75, 0.45) * smoothstep(0.20, 0.0, d) * 0.9;
    float sea = smoothstep(0.16, 0.15, uv.y);
    col = mix(col, col * vec3(0.35, 0.4, 0.55) + vec3(0.18, 0.10, 0.06), sea);
    return col;
  }

  void main() {
    vec3 color;
    if (uProcedural > 0.5) {
      color = proceduralSunset(vUv, uTime);
    } else {
      vec3 a = srgbToLinear(texture2D(texA, vUv).rgb);
      vec3 b = srgbToLinear(texture2D(texB, vUv).rgb);
      color = mix(a, b, uMix);
    }
    gl_FragColor = vec4(color * 1.6, 1.0); // emissive lift so bloom threshold catches it
  }
`;

const VERT = /* glsl */ `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

interface VideoSlot {
  el: HTMLVideoElement;
  tex: VideoTexture;
  rvfcId: number | null;
}

export class ScreenPlayer {
  private mesh: Mesh;
  private material: ShaderMaterial;
  private spillLights: PointLight[];
  private slots: [VideoSlot, VideoSlot] | null = null;
  private active = 0; // index into slots
  private mix = 0;
  private swapping = false;
  private lastRvfcAt = 0;
  private rendition: Rendition;
  private blacklist = new Set<Rendition>();
  private playing = false;
  private procedural = false;
  private time = 0;
  private avgCanvas: HTMLCanvasElement;
  private lastAvgAt = 0;
  private rvfcSupported = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaBase: string;

  constructor(mesh: Mesh, spillLights: PointLight[], rendition: Rendition, mediaBase = '/media') {
    this.mesh = mesh;
    this.spillLights = spillLights;
    this.rendition = rendition;
    this.mediaBase = mediaBase;
    this.material = new ShaderMaterial({
      uniforms: {
        texA: { value: null },
        texB: { value: null },
        uMix: { value: 0 },
        uProcedural: { value: 0 },
        uTime: { value: 0 },
      },
      vertexShader: VERT,
      fragmentShader: FRAG,
    });
    mesh.material = this.material;
    this.avgCanvas = document.createElement('canvas');
    this.avgCanvas.width = 2;
    this.avgCanvas.height = 2;

    if (!this.rvfcSupported) {
      // rVFC fallback: rAF currentTime polling + one preset step down (SRS-VID-4).
      if (import.meta.env.DEV) console.warn('[screen] rVFC unsupported — fallback gating');
    }
  }

  get currentRendition(): Rendition {
    return this.rendition;
  }
  get isProcedural(): boolean {
    return this.procedural;
  }

  private url(r: Rendition): string {
    return `${this.mediaBase}/sunset_${r}.mp4`;
  }

  private makeSlot(): VideoSlot {
    const el = document.createElement('video');
    el.muted = true;
    el.playsInline = true;
    el.preload = 'auto';
    el.crossOrigin = 'anonymous';
    el.loop = false; // loop is owned by the swap logic (SRS-VID-2)
    const tex = new VideoTexture(el);
    tex.colorSpace = NoColorSpace; // decoded manually in shader
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    return { el, tex, rvfcId: null };
  }

  /** Prepare both slots for the chosen rendition. Resolves once A can play. */
  async load(): Promise<boolean> {
    this.disposeSlots();
    const a = this.makeSlot();
    const b = this.makeSlot();
    this.slots = [a, b];
    const src = this.url(this.rendition);
    a.el.src = src;
    b.el.src = src;

    const ok = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      a.el.addEventListener(
        'canplay',
        () => {
          clearTimeout(timeout);
          resolve(true);
        },
        { once: true },
      );
      a.el.addEventListener(
        'error',
        () => {
          clearTimeout(timeout);
          resolve(false);
        },
        { once: true },
      );
      a.el.load();
      b.el.load();
    });

    if (!ok) return this.cascade();

    this.material.uniforms.texA!.value = a.tex;
    this.material.uniforms.texB!.value = b.tex;
    this.material.uniforms.uProcedural!.value = 0;
    this.procedural = false;
    this.active = 0;
    this.mix = 0;
    this.material.uniforms.uMix!.value = 0;
    this.attachRvfc(0);
    this.attachRvfc(1);
    this.watchStall(a.el);
    store.publishSys({ rendition: this.rendition });
    return true;
  }

  /** Cascading fallback, max down to 720p, then procedural mode (SRS-VID-6 + ERR-5). */
  private async cascade(): Promise<boolean> {
    this.blacklist.add(this.rendition);
    let next: Rendition | null = this.rendition;
    do {
      next = stepDown(next);
    } while (next && this.blacklist.has(next));
    if (next) {
      this.rendition = next;
      return this.load();
    }
    this.enableProcedural();
    store.pushNotice({
      id: 'video-play',
      kind: 'video-play',
      severity: 'toast',
      retryable: false,
      at: Date.now(),
      message: '영상을 불러오지 못해 대체 화면으로 상영 중이에요.',
    });
    return false;
  }

  enableProcedural(): void {
    this.procedural = true;
    this.material.uniforms.uProcedural!.value = 1;
  }

  /** Manual quality change → rendition reload with position carry-over (SRS §6.5). */
  async changeRendition(r: Rendition): Promise<boolean> {
    if (this.procedural || r === this.rendition || this.blacklist.has(r)) return false;
    const prevTime = this.slots?.[this.active]?.el.currentTime ?? 0;
    const wasPlaying = this.playing;
    this.pause();
    this.rendition = r;
    const ok = await this.load();
    if (ok && this.slots) {
      const a = this.slots[this.active]!;
      const dur = a.el.duration || 0;
      if (dur > 0) a.el.currentTime = prevTime % dur;
      if (wasPlaying) await this.play();
    }
    return ok;
  }

  async play(): Promise<void> {
    this.playing = true;
    if (this.procedural || !this.slots) return;
    const a = this.slots[this.active]!;
    try {
      await a.el.play();
    } catch {
      /* stall watchdog handles */
    }
    // Warm up B (SRS-VID-3): decode a first frame then hold.
    const b = this.slots[1 - this.active]!;
    try {
      await b.el.play();
      b.el.pause();
      b.el.currentTime = 0;
    } catch {
      /* non-fatal */
    }
  }

  pause(): void {
    this.playing = false;
    if (this.procedural || !this.slots) return;
    for (const s of this.slots) s.el.pause();
  }

  /** Tab-return recovery (SRS-VID-7): reset ended element, resume if user hasn't paused. */
  onVisible(userPaused: boolean): void {
    if (this.procedural || !this.slots) return;
    const a = this.slots[this.active]!;
    if (a.el.ended || a.el.currentTime >= (a.el.duration || Infinity) - 0.05) {
      a.el.currentTime = 0;
      this.mix = this.active === 1 ? 1 : 0;
      this.material.uniforms.uMix!.value = this.active === 1 ? 1 : 0;
      this.swapping = false;
    }
    if (this.playing && !userPaused && a.el.paused) void a.el.play();
  }

  private attachRvfc(i: number): void {
    if (!this.slots) return;
    const slot = this.slots[i]!;
    if (!this.rvfcSupported) return;
    const el = slot.el as HTMLVideoElement & {
      requestVideoFrameCallback(cb: (now: number, meta: { mediaTime: number }) => void): number;
    };
    const cb = (_now: number, meta: { mediaTime: number }): void => {
      slot.tex.needsUpdate = true; // set only — upload merges into next render (SRS §3.2-6)
      this.lastRvfcAt = performance.now();
      if (i === this.active && this.playing && !this.swapping) {
        const remaining = (slot.el.duration || 0) - meta.mediaTime;
        if (remaining > 0 && remaining < SWAP_TRIGGER_S) this.beginSwap();
      }
      slot.rvfcId = el.requestVideoFrameCallback(cb);
    };
    slot.rvfcId = el.requestVideoFrameCallback(cb);
  }

  private beginSwap(): void {
    if (!this.slots || this.swapping) return;
    const b = this.slots[1 - this.active]!;
    if (b.el.readyState < 2) {
      // B not ready — hard-cut fallback once via 'ended' (SRS-VID-7, no loop attribute).
      const a = this.slots[this.active]!;
      a.el.addEventListener(
        'ended',
        () => {
          a.el.currentTime = 0;
          void a.el.play();
          if (import.meta.env.DEV) console.warn('[screen] hard-cut loop fallback');
        },
        { once: true },
      );
      return;
    }
    this.swapping = true;
    b.el.currentTime = 0;
    void b.el.play();
  }

  /** Per-frame update from the main loop (visual ramp + fallback gating + spill color). */
  update(dt: number): void {
    this.time += dt;
    if (this.procedural) {
      this.material.uniforms.uTime!.value = this.time;
      this.updateSpillProcedural();
      return;
    }
    if (!this.slots) return;

    // rVFC fallback gating (SRS-VID-4)
    if (!this.rvfcSupported && this.playing) {
      const a = this.slots[this.active]!;
      a.tex.needsUpdate = true;
      const remaining = (a.el.duration || 0) - a.el.currentTime;
      if (!this.swapping && remaining > 0 && remaining < SWAP_TRIGGER_S) this.beginSwap();
      if (this.swapping) this.slots[1 - this.active]!.tex.needsUpdate = true;
    }

    if (this.swapping) {
      const dir = this.active === 0 ? 1 : -1;
      this.mix = Math.min(1, Math.max(0, this.mix + (dt / SWAP_RAMP_S) * dir));
      this.material.uniforms.uMix!.value = this.mix;
      const done = this.active === 0 ? this.mix >= 1 : this.mix <= 0;
      if (done) this.completeSwap();
    }

    // Watchdog: rVFC silent >1s while playing & visible → reset swap state (SRS-VID-7).
    if (
      this.rvfcSupported &&
      this.playing &&
      document.visibilityState === 'visible' &&
      this.lastRvfcAt > 0 &&
      performance.now() - this.lastRvfcAt > WATCHDOG_S * 1000
    ) {
      this.swapping = false;
      const a = this.slots[this.active]!;
      if (a.el.paused && this.playing) void a.el.play();
      this.lastRvfcAt = performance.now();
    }

    this.sampleAverageColor();
  }

  /** Pause entry during ramp: complete instantly, then pause (SRS-VID-7a). */
  onPause(): void {
    if (this.swapping) {
      this.mix = this.active === 0 ? 1 : 0;
      this.material.uniforms.uMix!.value = this.mix;
      this.completeSwap();
    }
    this.pause();
  }

  private completeSwap(): void {
    if (!this.slots) return;
    const old = this.slots[this.active]!;
    old.el.pause();
    this.active = 1 - this.active;
    this.swapping = false;
  }

  private watchStall(el: HTMLVideoElement): void {
    const arm = (): void => {
      if (this.stallTimer) clearTimeout(this.stallTimer);
      this.stallTimer = setTimeout(() => {
        if (this.playing && !this.procedural) void this.cascade();
      }, STALL_TIMEOUT_MS);
    };
    el.addEventListener('stalled', arm);
    el.addEventListener('error', arm);
    el.addEventListener('playing', () => {
      if (this.stallTimer) clearTimeout(this.stallTimer);
    });
  }

  // --- Spill light drive (SRS-SCN-13; CPU 2x2 sample every 250ms) ---
  private sampleAverageColor(): void {
    const now = performance.now();
    if (now - this.lastAvgAt < AVG_COLOR_INTERVAL_MS || !this.slots) return;
    this.lastAvgAt = now;
    const el = this.slots[this.active]!.el;
    if (el.readyState < 2) return;
    try {
      const g = this.avgCanvas.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      g.drawImage(el, 0, 0, 2, 2);
      const d = g.getImageData(0, 0, 2, 2).data;
      let r = 0;
      let gr = 0;
      let b = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i]!;
        gr += d[i + 1]!;
        b += d[i + 2]!;
      }
      const n = d.length / 4;
      this.applySpill(r / n / 255, gr / n / 255, b / n / 255);
    } catch {
      // Tainted canvas => CORS misconfiguration (ERR-10 path)
      store.pushNotice({
        id: 'video-cors',
        kind: 'video-cors',
        severity: 'toast',
        retryable: false,
        at: Date.now(),
        message: '미디어 서버 설정 문제로 일부 조명 효과가 제한돼요.',
      });
      this.lastAvgAt = Number.MAX_SAFE_INTEGER; // stop retrying
    }
  }

  private updateSpillProcedural(): void {
    const cycle = 0.5 + 0.5 * Math.sin(this.time * 0.02);
    this.applySpill(0.9 - 0.1 * cycle, 0.45 - 0.08 * cycle, 0.2);
  }

  private applySpill(r: number, g: number, b: number): void {
    const intensity = Math.min(2.2, (r + g + b) * 1.1 + 0.2);
    for (const light of this.spillLights) {
      light.color.setRGB(Math.max(0.05, r), Math.max(0.04, g), Math.max(0.03, b));
      light.intensity = intensity;
    }
  }

  private disposeSlots(): void {
    if (!this.slots) return;
    for (const s of this.slots) {
      s.el.pause();
      s.el.removeAttribute('src');
      s.el.load();
      s.tex.dispose();
    }
    this.slots = null;
  }
}
