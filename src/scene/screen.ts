// scene/screen — continuous wall-screen panorama + sunset pipeline (SRS-VID, v5).
// Every wall ribbon carries the panorama arc as a vertex attribute (`aArc`), so the sky,
// clouds and sea are one continuous image around the ellipse. The sky itself comes from
// the shared uniforms fed by skyCycle (SRS-VID-8) — the floor/ceiling reflections sample
// the same uniforms, so wall and reflection can never disagree.
// Video mode (?video) and GIF mode (?gif, SRS-VID-9): the front ribbon plays the media;
// the rest of the wall stays procedural. Either way the media is COVER-fitted to the
// ribbon (uUvScale/uUvOffset) so a 16:9 source is not stretched across a 24m x 8m band.

import {
  LinearFilter,
  LinearMipmapLinearFilter,
  Mesh,
  NoColorSpace,
  PointLight,
  ShaderMaterial,
  SRGBColorSpace,
  Texture,
  VideoTexture,
} from 'three';
import type { Rendition } from '../types';
import type { ScreenSurface } from './world';
import { store } from '../core/store';
import { stepDown } from './renditionSelect';
import { SKY_FUNCTIONS, SKY_UNIFORM_DECL, type SkyUniforms } from './skyShader';
import {
  MEDIA_FUNCTIONS,
  MEDIA_UNIFORM_DECL,
  rampMediaMix,
  setMediaTexture,
  type MediaUniforms,
} from './panoMedia';
import { GifSource } from './gifTexture';

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
  ${MEDIA_UNIFORM_DECL}
  uniform sampler2D texA;
  uniform sampler2D texB;
  uniform float uMix;
  uniform float uProcedural;
  uniform float uBandBottom;
  uniform vec2 uUvScale;   // cover fit: media aspect -> ribbon aspect (no stretching)
  uniform vec2 uUvOffset;
  varying vec2 vUv;
  varying vec3 vWorldPos;
  varying float vArc;

  ${SKY_FUNCTIONS}
  ${MEDIA_FUNCTIONS}

  vec3 srgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

  void main() {
    vec3 color;
    if (uProcedural > 0.5) {
      float px = vArc / uBandH;
      float py = clamp((vWorldPos.y - uBandBottom) / uBandH, 0.0, 1.0);
      color = panorama(px, py, 1.0);
      // Wrap mode (SRS-VID-10): the 360 media covers the WHOLE wall, so it blends over the
      // procedural sky here rather than replacing one ribbon's texture.
      if (uMediaMix > 0.001) color = mix(color, panoMediaWall(vArc, vWorldPos), uMediaMix);
    } else {
      vec2 uvFit = vUv * uUvScale + uUvOffset;
      vec3 a = srgbToLinear(texture2D(texA, uvFit).rgb);
      vec3 b = srgbToLinear(texture2D(texB, uvFit).rgb);
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
  /** Arc length of the media-capable front ribbon (m) — the cover-fit denominator. */
  frontArcLen: number;
  perimeter: number;
  center: [number, number];
  startBearing: number;
  nearWallDistance: number;
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
  private gifUrl: string | null;
  /** `?video=<url>`: one explicit file instead of the rendition set (no cascade). */
  private videoUrl: string | null;
  private maxAnisotropy: number;
  private imgUrl: string | null;
  private still: Texture | null = null;
  private gif: GifSource | null = null;
  private surfaceAspect: number;
  private media: MediaUniforms;
  /** Wrap mode: media is a 360 equirect covering the whole wall, not one ribbon (SRS-VID-10). */
  private wrap: boolean;

  constructor(
    surfaces: ScreenSurface[],
    pano: Pano,
    spillLights: PointLight[],
    sky: SkyUniforms,
    media: MediaUniforms,
    rendition: Rendition,
    opts: {
      mediaBase?: string;
      preferVideo?: boolean;
      gifUrl?: string | null;
      imgUrl?: string | null;
      videoUrl?: string | null;
      /** renderer.capabilities.getMaxAnisotropy() — the wall is seen at grazing angles. */
      maxAnisotropy?: number;
      wrap?: boolean;
    } = {},
  ) {
    this.media = media;
    this.wrap = opts.wrap ?? false;
    this.spillLights = spillLights;
    this.rendition = rendition;
    this.mediaBase = opts.mediaBase ?? '/media';
    this.preferVideo = opts.preferVideo ?? false;
    this.gifUrl = opts.gifUrl ?? null;
    this.videoUrl = opts.videoUrl ?? null;
    this.maxAnisotropy = Math.max(1, opts.maxAnisotropy ?? 1);
    this.imgUrl = opts.imgUrl ?? null;
    this.surfaceAspect = pano.frontArcLen / pano.bandHeight;

    let front: ShaderMaterial | null = null;
    for (const s of surfaces) {
      const mat = new ShaderMaterial({
        uniforms: {
          ...sky, // shared IUniform objects (skyCycle → every sky material at once)
          ...media, // ditto for the 360 media set (wall + floor/ceiling reflection)
          texA: { value: null },
          texB: { value: null },
          uMix: { value: 0 },
          uProcedural: { value: 1 },
          uBandBottom: { value: pano.bandBottom },
          uUvScale: { value: [1, 1] },
          uUvOffset: { value: [0, 0] },
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
  /** '영상'(video) / 'GIF' / '실시간 생성'(procedural) — what the wall is actually showing. */
  get sourceKind(): 'video' | 'gif' | 'still' | 'procedural' {
    if (this.mediaLive) return this.still ? 'still' : this.gif ? 'gif' : 'video';
    if (!this.procedural && this.gif) return 'gif';
    if (!this.procedural) return 'video';
    return 'procedural';
  }
  /** True once a source is bound to the shared 360 media uniforms. */
  private get mediaLive(): boolean {
    return this.wrap && this.media.uMediaTex!.value !== null;
  }
  get isWrap(): boolean {
    return this.wrap;
  }

  /** Wrap mode binds the source to the SHARED uniforms instead of one ribbon's texture. */
  private bindWrap(a: Texture, b: Texture | null = null): void {
    setMediaTexture(this.media, a, b);
    this.procedural = false;
  }

  /**
   * Cover fit: show the media at its own aspect, cropping the overflowing axis, so a 16:9
   * source is never stretched across the 24m x 8m front ribbon.
   */
  private fitMedia(width: number, height: number): void {
    const u = this.frontMaterial.uniforms;
    if (width <= 0 || height <= 0) {
      u.uUvScale!.value = [1, 1];
      u.uUvOffset!.value = [0, 0];
      return;
    }
    const media = width / height;
    if (media > this.surfaceAspect) {
      const sx = this.surfaceAspect / media; // crop left/right
      u.uUvScale!.value = [sx, 1];
      u.uUvOffset!.value = [(1 - sx) / 2, 0];
    } else {
      const sy = media / this.surfaceAspect; // crop top/bottom
      u.uUvScale!.value = [1, sy];
      u.uUvOffset!.value = [0, (1 - sy) / 2];
    }
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
    // No mipmaps for video: regenerating them every frame costs more than the aliasing
    // they save. Anisotropy still helps on the oblique side walls.
    tex.generateMipmaps = false;
    tex.anisotropy = this.maxAnisotropy;
    return { el, tex, rvfcId: null };
  }

  /** Media applies to the FRONT ribbon only; the rest of the wall always runs the panorama. */
  async load(): Promise<boolean> {
    if (this.imgUrl) return this.loadStill(this.imgUrl);
    if (this.gifUrl) return this.loadGif(this.gifUrl);
    if (!this.preferVideo) {
      this.enableProcedural();
      return true;
    }
    this.disposeSlots();
    const a = this.makeSlot();
    const b = this.makeSlot();
    this.slots = [a, b];
    const src = this.videoUrl ?? this.url(this.rendition);
    a.el.src = src;
    b.el.src = src;

    const ok = await new Promise<boolean>((resolve) => {
      const timeout = setTimeout(() => resolve(false), 15000);
      a.el.addEventListener('canplay', () => { clearTimeout(timeout); resolve(true); }, { once: true });
      a.el.addEventListener('error', () => { clearTimeout(timeout); resolve(false); }, { once: true });
      a.el.load();
      b.el.load();
    });

    // An explicit file has no smaller sibling to fall back to — go straight to procedural.
    if (!ok) return this.videoUrl ? this.cascadeGiveUp() : this.cascade();

    if (this.wrap) {
      this.bindWrap(a.tex, b.tex);
    } else {
      const u = this.frontMaterial.uniforms;
      u.texA!.value = a.tex;
      u.texB!.value = b.tex;
      u.uProcedural!.value = 0;
      this.fitMedia(a.el.videoWidth, a.el.videoHeight);
    }
    this.procedural = false;
    this.active = 0;
    this.mix = 0;
    this.setSwap(0);
    this.attachRvfc(0);
    this.attachRvfc(1);
    this.watchStall(a.el);
    store.publishSys({ rendition: this.rendition });
    return true;
  }

  /**
   * Still panorama (SRS-VID-10): one equirectangular photo on the whole wall. No decode
   * loop, no loop seam — the cheapest honest way to see how real photography reads in the
   * hall before committing to a video rendition set.
   */
  private async loadStill(url: string): Promise<boolean> {
    this.disposeSlots();
    this.disposeGif();
    try {
      const res = await fetch(url, { credentials: 'omit' });
      if (!res.ok) throw new Error(`still ${res.status}`);
      // flipY so a still matches the VideoTexture/CanvasTexture upload convention that
      // panoMediaUv assumes; without it stills and videos map upside down relative to
      // each other (caught 2026-09-13 on the first real 360 clip).
      const bmp = await createImageBitmap(await res.blob(), { imageOrientation: 'flipY' });
      const tex = new Texture(bmp as unknown as HTMLImageElement);
      tex.colorSpace = SRGBColorSpace; // the shader owns the single sRGB->linear step
      // A still is uploaded once, so mipmaps + anisotropy are nearly free here and remove
      // the shimmer on the far (15m) side walls and in the floor reflection.
      tex.minFilter = LinearMipmapLinearFilter;
      tex.magFilter = LinearFilter;
      tex.generateMipmaps = true;
      tex.anisotropy = this.maxAnisotropy;
      tex.needsUpdate = true;
      this.still = tex;
      if (this.wrap) this.bindWrap(tex);
      else {
        const u = this.frontMaterial.uniforms;
        u.texA!.value = tex;
        u.texB!.value = tex;
        u.uProcedural!.value = 0;
        this.fitMedia(bmp.width, bmp.height);
      }
      this.procedural = false;
      this.setSwap(0);
      if (import.meta.env.DEV) {
        console.info(`[screen] still ${url} — ${bmp.width}x${bmp.height} (${(bmp.width / bmp.height).toFixed(3)}:1)`);
      }
      return true;
    } catch {
      this.enableProcedural();
      store.pushNotice({
        id: 'video-play',
        kind: 'video-play',
        severity: 'toast',
        retryable: false,
        at: Date.now(),
        message: '파노라마 이미지를 불러오지 못해 대체 화면으로 상영 중이에요.',
      });
      return false;
    }
  }

  private disposeStill(): void {
    this.still?.dispose();
    this.still = null;
  }

  /**
   * GIF mode (SRS-VID-9). No rendition cascade: there is one file, and a failure falls
   * straight back to the procedural sky rather than hunting for smaller variants.
   */
  private async loadGif(url: string): Promise<boolean> {
    this.disposeSlots();
    this.disposeGif();
    try {
      const gif = await GifSource.create(url, undefined, this.maxAnisotropy);
      this.gif = gif;
      if (this.wrap) {
        this.bindWrap(gif.texture); // one source: the GIF loops on its own frame cycle
      } else {
        const u = this.frontMaterial.uniforms;
        u.texA!.value = gif.texture;
        u.texB!.value = gif.texture; // one source: the A/B swap has nothing to cross-fade
        u.uMix!.value = 0;
        u.uProcedural!.value = 0;
        this.fitMedia(gif.width, gif.height);
      }
      this.mix = 0;
      this.setSwap(0);
      this.procedural = false;
      if (this.playing) gif.play();
      if (import.meta.env.DEV) {
        console.info(`[screen] GIF ${url} — ${gif.width}x${gif.height}, ${gif.frames} frames`);
      }
      return true;
    } catch {
      this.enableProcedural();
      store.pushNotice({
        id: 'video-play',
        kind: 'video-play',
        severity: 'toast',
        retryable: false,
        at: Date.now(),
        message: 'GIF을 불러오지 못해 대체 화면으로 상영 중이에요.',
      });
      return false;
    }
  }

  private disposeGif(): void {
    this.gif?.dispose();
    this.gif = null;
  }

  private cascadeGiveUp(): boolean {
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
    this.disposeGif();
    this.disposeStill();
    setMediaTexture(this.media, null);
    this.procedural = true;
    this.frontMaterial.uniforms.uProcedural!.value = 1;
  }

  /** Loop crossfade position. Wrap mode drives the shared uniform; front mode drives uMix. */
  private setSwap(v: number): void {
    this.mix = v;
    if (this.wrap) this.media.uMediaSwap!.value = v;
    else this.frontMaterial.uniforms.uMix!.value = v;
  }

  /** Manual quality change → rendition reload with position carry-over (SRS §6.5). */
  async changeRendition(r: Rendition): Promise<boolean> {
    if (this.procedural || this.gif || this.still) return false; // single-source modes
    if (r === this.rendition || this.blacklist.has(r)) return false;
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
    if (this.still) return; // nothing to advance
    if (this.gif) {
      this.gif.play();
      return;
    }
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
    if (this.still) return;
    if (this.gif) {
      this.gif.pause();
      return;
    }
    if (this.procedural || !this.slots) return;
    for (const s of this.slots) s.el.pause();
  }

  onVisible(userPaused: boolean): void {
    if (this.still) return;
    if (this.gif) {
      if (this.playing && !userPaused) this.gif.play();
      return;
    }
    if (this.procedural || !this.slots) return;
    const a = this.slots[this.active]!;
    if (a.el.ended || a.el.currentTime >= (a.el.duration || Infinity) - 0.05) {
      a.el.currentTime = 0;
      this.setSwap(this.active === 1 ? 1 : 0);
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
    if (this.wrap) rampMediaMix(this.media, this.mediaLive ? 1 : 0, dt);
    if (this.procedural) {
      this.applySpill(skyAverage[0], skyAverage[1], skyAverage[2]);
      return;
    }
    if (this.still) {
      this.applySpill(skyAverage[0], skyAverage[1], skyAverage[2]);
      return;
    }
    if (this.gif) {
      this.gif.update(dt); // texture upload is gated inside GifSource (SRS-VID-3)
      this.sampleAverageColor();
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
      this.setSwap(Math.min(1, Math.max(0, this.mix + (dt / SWAP_RAMP_S) * dir)));
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
      this.setSwap(this.active === 0 ? 1 : 0);
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
    if (now - this.lastAvgAt < AVG_COLOR_INTERVAL_MS) return;
    let source: CanvasImageSource | null = null;
    if (this.gif) {
      source = this.gif.sampleSource;
    } else if (this.slots) {
      const el = this.slots[this.active]!.el;
      if (el.readyState < 2) return;
      source = el;
    }
    if (!source) return;
    this.lastAvgAt = now;
    try {
      const g = this.avgCanvas.getContext('2d', { willReadFrequently: true });
      if (!g) return;
      g.drawImage(source, 0, 0, 2, 2);
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
