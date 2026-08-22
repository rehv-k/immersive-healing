// scene/screen — surrounding wall-screen panorama + sunset pipeline (SRS-VID, v4).
// The hall's walls (minus the entrance) are all screen surfaces; the procedural sunset
// is computed in WORLD space along the wall-path, so sky, clouds and sea continue
// seamlessly across the corners (사용자 결정: 직교 벽면 랩어라운드, 원통 아님).
// Video mode (?video): the front wall plays the file; side walls stay procedural.

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

const SWAP_TRIGGER_S = 0.5;
const SWAP_RAMP_S = 0.25;
const WATCHDOG_S = 1.0;
const STALL_TIMEOUT_MS = 5000;
const AVG_COLOR_INTERVAL_MS = 250;

const VERT = /* glsl */ `
  varying vec2 vUv;
  varying vec3 vWorldPos;
  void main() {
    vUv = uv;
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

// World-space panorama sunset. px runs along the wall path in band-height units;
// py runs 0..1 over the screen band. All motion slow and flash-free.
const FRAG = /* glsl */ `
  uniform sampler2D texA;
  uniform sampler2D texB;
  uniform float uMix;
  uniform float uProcedural;
  uniform float uTime;
  uniform vec2 uDir;
  uniform float uBase;
  uniform float uBandBottom;
  uniform float uBandH;
  uniform float uSunDist;
  varying vec2 vUv;
  varying vec3 vWorldPos;

  vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.55;
    for (int i = 0; i < 4; i++) { v += a * noise(p); p = p * 2.1 + 17.3; a *= 0.5; }
    return v;
  }

  vec3 panoramaSunset(float px, float py, float t) {
    float seaLine = 0.26;
    float breathe = 0.5 + 0.5 * sin(t * 0.05);
    float sunPx = uSunDist / uBandH;

    vec3 zenith  = mix(vec3(0.07, 0.10, 0.24), vec3(0.05, 0.07, 0.19), breathe);
    vec3 mid     = vec3(0.55, 0.26, 0.22);
    vec3 horizon = mix(vec3(1.05, 0.52, 0.18), vec3(0.98, 0.42, 0.16), breathe);
    // warmth falls off away from the sun along the panorama — sides go dusky
    float away = clamp(abs(px - sunPx) / (uSunDist / uBandH), 0.0, 1.0);
    horizon = mix(horizon, vec3(0.55, 0.25, 0.22), away * 0.55);
    mid = mix(mid, vec3(0.30, 0.16, 0.20), away * 0.4);

    float h = smoothstep(seaLine, 1.0, py);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.45, h));
    col = mix(col, zenith, smoothstep(0.35, 1.0, h));

    // sun disc + glow (only meaningful near the front wall)
    vec2 d2 = vec2(px - sunPx, py - (seaLine + 0.10));
    float d = length(d2);
    float shimmer = 1.0 + 0.03 * sin(t * 0.7);
    col += vec3(1.0, 0.72, 0.38) * 0.85 * smoothstep(1.1, 0.0, d);
    col += vec3(1.25, 0.85, 0.5) * smoothstep(0.13 * shimmer, 0.085, d);

    // drifting clouds — px is continuous across wall corners
    float drift1 = fbm(vec2(px * 1.2 - t * 0.014, py * 9.0));
    float band1 = smoothstep(0.5, 0.72, drift1) * smoothstep(0.85, 0.55, py) * smoothstep(seaLine + 0.05, seaLine + 0.22, py);
    vec3 cloudLit = mix(vec3(0.85, 0.42, 0.28), vec3(0.30, 0.16, 0.20), smoothstep(seaLine, 0.8, py));
    cloudLit = mix(cloudLit, cloudLit * 0.55, away);
    col = mix(col, cloudLit, band1 * 0.75);
    float drift2 = fbm(vec2(px * 2.2 + t * 0.02, py * 14.0 + 5.0));
    float band2 = smoothstep(0.55, 0.8, drift2) * smoothstep(0.95, 0.6, py) * smoothstep(seaLine + 0.15, seaLine + 0.4, py);
    col = mix(col, cloudLit * 0.7, band2 * 0.5);

    // sea
    if (py < seaLine) {
      float depth = (seaLine - py) / seaLine;
      vec3 seaNear = mix(vec3(0.62, 0.30, 0.16), vec3(0.34, 0.20, 0.18), away);
      vec3 sea = mix(seaNear, vec3(0.06, 0.07, 0.12), smoothstep(0.0, 0.7, depth));
      float swell = noise(vec2(px * 7.5, py * 60.0 + t * 0.35));
      sea *= 0.92 + 0.16 * swell;
      float pathW = mix(0.1, 0.5, depth);
      float path = smoothstep(pathW, 0.0, abs(px - sunPx));
      float sparkle = noise(vec2(px * 40.0, py * 220.0 - t * 1.1));
      sparkle = smoothstep(0.72, 0.95, sparkle);
      sea += vec3(1.1, 0.72, 0.4) * path * (0.25 + 0.75 * sparkle) * (1.0 - depth * 0.7);
      col = sea;
    }

    // vertical edge softening only (horizontal vignette would seam the corners)
    float vig = smoothstep(0.0, 0.1, py) * smoothstep(1.0, 0.92, py);
    return col * mix(0.8, 1.0, vig);
  }

  void main() {
    vec3 color;
    if (uProcedural > 0.5) {
      float pd = dot(vWorldPos.xz, uDir) + uBase;
      float px = pd / uBandH;
      float py = clamp((vWorldPos.y - uBandBottom) / uBandH, 0.0, 1.0);
      color = panoramaSunset(px, py, uTime);
    } else {
      vec3 a = srgbToLinear(texture2D(texA, vUv).rgb);
      vec3 b = srgbToLinear(texture2D(texB, vUv).rgb);
      color = mix(a, b, uMix);
    }
    gl_FragColor = vec4(color * 1.6, 1.0);
  }
`;

interface VideoSlot {
  el: HTMLVideoElement;
  tex: VideoTexture;
  rvfcId: number | null;
}

interface Pano {
  totalLen: number;
  sunDist: number;
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
  private time = 0;
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
          texA: { value: null },
          texB: { value: null },
          uMix: { value: 0 },
          uProcedural: { value: 1 },
          uTime: { value: 0 },
          uDir: { value: s.dir },
          uBase: { value: s.base },
          uBandBottom: { value: pano.bandBottom },
          uBandH: { value: pano.bandHeight },
          uSunDist: { value: pano.sunDist },
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

  /** Video applies to the FRONT wall only; side walls always run the panorama. */
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

  update(dt: number): void {
    this.time += dt;
    for (const m of this.materials) m.uniforms.uTime!.value = this.time;

    if (this.procedural) {
      this.updateSpillProcedural();
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

  private updateSpillProcedural(): void {
    const cycle = 0.5 + 0.5 * Math.sin(this.time * 0.05);
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
