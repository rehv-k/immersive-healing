// scene/screen — continuous wall-screen panorama + sunset pipeline (SRS-VID, v5).
// Every wall ribbon carries the panorama arc as a vertex attribute (`aArc`), so the sky,
// clouds and sea are one continuous image around the ellipse. The sky itself comes from
// the shared uniforms fed by skyCycle (SRS-VID-8) — the floor/ceiling reflections sample
// the same uniforms, so wall and reflection can never disagree.
// Video mode (?video): the front ribbon plays the file; the rest stays procedural.

import {
  LinearFilter,
  Mesh,
  NoColorSpace,
  PointLight,
  ShaderMaterial,
  VideoTexture,
} from 'three';
import type { Rendition } from '../types';
import type { ScreenSurface } from './world';
import { store } from '../core/store';
import { stepDown } from './renditionSelect';
import { SKY_FUNCTIONS, SKY_UNIFORM_DECL, type SkyUniforms } from './skyShader';

const SWAP_TRIGGER_S = 0.5;
const SWAP_RAMP_S = 0.25;
const WATCHDOG_S = 1.0;
const STALL_TIMEOUT_MS = 5000;
const AVG_COLOR_INTERVAL_MS = 250;

const VERT = /* glsl */ `
  attribute float aArc;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vArc;
  void main() {
    vUv = uv;
    vArc = aArc;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  ${SKY_UNIFORM_DECL}
  uniform sampler2D texA;
  uniform sampler2D texB;
  uniform float uMix;
  uniform float uProcedural;
  uniform float uBandBottom;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vArc;

  ${SKY_FUNCTIONS}

  vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

  void main() {
    vec3 color;
    if (uProcedural > 0.5) {
      float px = vArc / uBandH;
      float py = clamp((vWorldPos.y - uBandBottom) / uBandH, 0.0, 1.0);
      color = panorama(px, py, 1.0);
    } else {
      vec3 a = srgbToLinear(texture2D(texA, vUv).rgb);
      vec3 b = srgbToLinear(texture2D(texB, vUv).rgb);
      color = mix(a, b, uMix);
    }
    gl_FragColor = vec4(color * 1.15, 1.0); // exposure (v5: 1.6 → 1.15, floor/ceiling add light)
  }
`;

interface VideoSlot {
  el: HTMLVideoElement;
  tex: VideoTexture;
  rvfcId: number | null;
}

interface Pano {
  panoLen: number;
  sunArc: number;
  bandBottom: number;
  bandHeight: number;
}

export class ScreenPlayer {
  private materials: ShaderMaterial[] = [];
  private frontMaterial: ShaderMaterial;
  private spillLights: PointLight[];
  private slots: [VideoSlot, VideoSlot] | null = null;
  private active = 0;
  private mix = 0;
  private swapping = false;
  private lastRvfcAt = 0;
  private rendition: Rendition;
  private blacklist = new Set<Rendition>();
  private playing = false;
  private procedural = false;
  private avgCanvas: HTMLCanvasElement;
  private lastAvgAt = 0;
  private rvfcSupported = 'requestVideoFrameCallback' in HTMLVideoElement.prototype;
  private stallTimer: ReturnType<typeof setTimeout> | null = null;
  private mediaBase: string;
  private preferVideo: boolean;

  constructor(
    surfaces: ScreenSurface[],
    pano: Pano,
    spillLights: PointLight[],
    sky: SkyUniforms,
    rendition: Rendition,
    opts: { mediaBase?: string; preferVideo?: boolean } = {},
  ) {
    this.spillLights = spillLights;
    this.rendition = rendition;
    this.mediaBase = opts.mediaBase ?? '/media';
    this.preferVideo = opts.preferVideo ?? false;

    let front: ShaderMaterial | null = null;
    for (const s of surfaces) {
      const mat = new ShaderMaterial({
        uniforms: {
          ...sky, // shared IUniform objects (skyCycle → every sky material at once)
          texA: { value: null },
          texB: { value: null },
          uMix: { value: 0 },
          uProcedural: { value: 1 },
          uBandBottom: { value: pano.bandBottom },
        },
        vertexShader: VERT,
        fragmentShader: FRAG,
      });
      (s.mesh as Mesh).material = mat;
      this.materials.push(mat);
      if (s.isFront) front = mat;
    }
    if (!front) throw new Error('screen: no front surface');
    this.frontMaterial = front;
    this.procedural = true;

    this.avgCanvas = document.createElement('canvas');
    this.avgCanvas.width = 2;
    this.avgCanvas.height = 2;
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
    tex.colorSpace = NoColorSpace;
    tex.minFilter = LinearFilter;
    tex.magFilter = LinearFilter;
    tex.generateMipmaps = false;
    return { el, tex, rvfcId: null };
  }

  /** Video applies to the FRONT ribbon only; the rest of the wall always runs the panorama. */
  async load(): Promise<boolean> {
    if (!this.preferVideo) {
      this.enableProcedural();
      return true;
    }
    this.disposeSlots();
    const a = this.makeSlot();
    const b = this.makeSlot();
    this.slots = [a, b];
    const src = this.url(this.rendition);
    a.el.src = src;
    b.el.src = src;

    const ok = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      a.el.addEventListener('canplay', () => { clearTimeout(timeout); resolve(true); }, { once: true });
      a.el.addEventListener('error', () => { clearTimeout(timeout); resolve(false); }, { once: true });
      a.el.load();
      b.el.load();
    });

    if (!ok) return this.cascade();

    const u = this.frontMaterial.uniforms;
    u.texA!.value = a.tex;
    u.texB!.value = b.tex;
    u.uProcedural!.value = 0;
    this.procedural = false;
    this.active = 0;
    this.mix = 0;
    u.uMix!.value = 0;
    this.attachRvfc(0);
    this.attachRvfc(1);
    this.watchStall(a.el);
    store.publishSys({ rendition: this.rendition });
    return true;
  }

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
    this.frontMaterial.uniforms.uProcedural!.value = 1;
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
    } catch { /* stall watchdog handles */ }
    const b = this.slots[1 - this.active]!;
    try {
      await b.el.play();
      b.el.pause();
      b.el.currentTime = 0;
    } catch { /* non-fatal */ }
  }

  pause(): void {
    this.playing = false;
    if (this.procedural || !this.slots) return;
    for (const s of this.slots) s.el.pause();
  }

  onVisible(userPaused: boolean): void {
    if (this.procedural || !this.slots) return;
    const a = this.slots[this.active]!;
    if (a.el.ended || a.el.currentTime >= (a.el.duration || Infinity) - 0.05) {
      a.el.currentTime = 0;
      this.mix = this.active === 1 ? 1 : 0;
      this.frontMaterial.uniforms.uMix!.value = this.mix;
      this.swapping = false;
    }
    if (this.playing && !userPaused && a.el.paused) void a.el.play();
  }

  private attachRvfc(i: number): void {
    if (!this.slots || !this.rvfcSupported) return;
    const slot = this.slots[i]!;
    const el = slot.el as HTMLVideoElement & {
      requestVideoFrameCallback(cb: (now: number, meta: { mediaTime: number }) => void): number;
    };
    const cb = (_now: number, meta: { mediaTime: number }): void => {
      slot.tex.needsUpdate = true;
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

  /**
   * Per-frame: video ramp/gating + spill lights. `skyAverage` is the sky cycle's mean
   * emitted colour (procedural mode); video mode samples the frame instead.
   */
  update(dt: number, skyAverage: [number, number, number]): void {
    if (this.procedural) {
      this.applySpill(skyAverage[0], skyAverage[1], skyAverage[2]);
      return;
    }
    if (!this.slots) return;

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
      this.frontMaterial.uniforms.uMix!.value = this.mix;
      const done = this.active === 0 ? this.mix >= 1 : this.mix <= 0;
      if (done) this.completeSwap();
    }

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

  onPause(): void {
    if (this.swapping) {
      this.mix = this.active === 0 ? 1 : 0;
      this.frontMaterial.uniforms.uMix!.value = this.mix;
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
      store.pushNotice({
        id: 'video-cors',
        kind: 'video-cors',
        severity: 'toast',
        retryable: false,
        at: Date.now(),
        message: '미디어 서버 설정 문제로 일부 조명 효과가 제한돼요.',
      });
      this.lastAvgAt = Number.MAX_SAFE_INTEGER;
    }
  }

  private applySpill(r: number, g: number, b: number): void {
    const intensity = Math.min(2.2, (r + g + b) * 1.1 + 0.15);
    for (const light of this.spillLights) {
      light.color.setRGB(Math.max(0.03, Math.min(1, r)), Math.max(0.02, Math.min(1, g)), Math.max(0.02, Math.min(1, b)));
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
