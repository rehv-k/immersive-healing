// scene/gifTexture — animated GIF as a wall-screen source (SRS-VID-9).
// Added 2026-09-11 on the user's request: before committing to a real video rendition set,
// the hall should be checkable with "화질 좋은 GIF 정도"의 소재.
//
// A GIF cannot go through <video>/VideoTexture, so frames are pulled with WebCodecs
// `ImageDecoder` and blitted onto a 2D canvas that backs a CanvasTexture. Two rules from
// SRS-VID carry over unchanged:
//   * the loop belongs to THIS class, never to a media element attribute (SRS-VID-2);
//   * the texture is uploaded ONLY on a real frame change (SRS-VID-3 gating), so a slow or
//     single-frame GIF costs one upload per decoded frame, not one per rAF tick.
// Frames are decoded lazily one at a time: a high-quality GIF can hold hundreds of full
// frames, and holding them all as ImageBitmaps would dwarf the whole app's memory budget.

import { CanvasTexture, LinearFilter, SRGBColorSpace } from 'three';

/** Minimal WebCodecs surface we rely on (not in lib.dom for this TS target). */
interface DecodedFrame {
  image: CanvasImageSource & { close(): void; displayWidth: number; displayHeight: number; duration: number | null };
}
interface DecoderTrack {
  frameCount: number;
  animated: boolean;
  repetitionCount: number;
}
interface Decoder {
  tracks: { ready: Promise<void>; selectedTrack: DecoderTrack | null };
  completed: Promise<void>;
  decode(init: { frameIndex: number }): Promise<DecodedFrame>;
  close(): void;
}
type DecoderCtor = new (init: { data: ArrayBuffer | Uint8Array; type: string }) => Decoder;

const DEFAULT_FRAME_S = 0.1; // GIF's own fallback when a frame carries no duration

export class GifSource {
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private g: CanvasRenderingContext2D;
  private decoder: Decoder;
  private frameCount: number;
  private index = -1;
  private hold = 0; // seconds left on the frame currently shown
  private pending = false;
  private playing = false;
  private disposed = false;

  static isSupported(): boolean {
    return typeof (globalThis as { ImageDecoder?: unknown }).ImageDecoder !== 'undefined';
  }

  /** Fetch + open the GIF. Rejects if unsupported, missing, or not actually animated media. */
  static async create(url: string, signal?: AbortSignal, anisotropy = 1): Promise<GifSource> {
    if (!GifSource.isSupported()) throw new Error('ImageDecoder unavailable');
    const res = await fetch(url, { signal, credentials: 'omit' });
    if (!res.ok) throw new Error(`gif ${res.status}`);
    const data = await res.arrayBuffer();
    const Ctor = (globalThis as unknown as { ImageDecoder: DecoderCtor }).ImageDecoder;
    const decoder = new Ctor({ data, type: 'image/gif' });
    await decoder.tracks.ready;
    await decoder.completed; // the buffer is complete, so frameCount is final here
    const track = decoder.tracks.selectedTrack;
    if (!track || track.frameCount < 1) {
      decoder.close();
      throw new Error('gif has no frames');
    }
    const first = await decoder.decode({ frameIndex: 0 });
    const src = new GifSource(decoder, track.frameCount, first, anisotropy);
    return src;
  }

  private constructor(decoder: Decoder, frameCount: number, first: DecodedFrame, anisotropy = 1) {
    this.decoder = decoder;
    this.frameCount = frameCount;
    this.canvas = document.createElement('canvas');
    this.canvas.width = first.image.displayWidth;
    this.canvas.height = first.image.displayHeight;
    const g = this.canvas.getContext('2d', { alpha: false, willReadFrequently: true });
    if (!g) throw new Error('2d context unavailable');
    this.g = g;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    this.texture.generateMipmaps = false;
    this.texture.anisotropy = anisotropy;
    this.present(0, first);
  }

  get width(): number {
    return this.canvas.width;
  }
  get height(): number {
    return this.canvas.height;
  }
  get frames(): number {
    return this.frameCount;
  }
  /** Average colour source for the spill lights — the same canvas the texture reads. */
  get sampleSource(): CanvasImageSource {
    return this.canvas;
  }

  play(): void {
    this.playing = true;
  }
  pause(): void {
    this.playing = false;
  }

  /**
   * Advance by `dt` seconds. The upload is gated inside `present()`: `needsUpdate` flips
   * once per DECODED frame, never once per rAF tick (SRS-VID-3).
   */
  update(dt: number): void {
    if (!this.playing || this.disposed || this.frameCount < 2) return;
    this.hold -= dt;
    if (this.hold > 0 || this.pending) return;
    this.pending = true;
    const next = (this.index + 1) % this.frameCount;
    void this.decoder
      .decode({ frameIndex: next })
      .then((frame) => {
        if (this.disposed) {
          frame.image.close();
          return;
        }
        this.present(next, frame);
      })
      .catch(() => {
        /* a bad frame must not stall the wall — hold the last image */
        this.hold = DEFAULT_FRAME_S;
      })
      .finally(() => {
        this.pending = false;
      });
  }

  private present(index: number, frame: DecodedFrame): void {
    this.g.drawImage(frame.image, 0, 0, this.canvas.width, this.canvas.height);
    const micros = frame.image.duration;
    frame.image.close();
    this.index = index;
    // A long stall (tab hidden, slow decode) must not fast-forward the animation, so the
    // hold is set, never accumulated.
    this.hold = micros && micros > 0 ? micros / 1e6 : DEFAULT_FRAME_S;
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.playing = false;
    this.texture.dispose();
    try {
      this.decoder.close();
    } catch {
      /* already closed */
    }
  }
}
