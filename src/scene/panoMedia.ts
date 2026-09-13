// scene/panoMedia — 360° equirectangular media mapped onto the wrap-around wall (SRS-VID-10).
// Added 2026-09-11 after 조사 L: the hall IS a 360° wrap, so the format that fits it is an
// equirectangular panorama, not a flat 16:9 clip. The mapping is the same one a cylindrical
// panorama theatre uses:
//   horizontal — the BEARING of the wall point from the hall centre. An equirect stores one
//                image column per unit of longitude, so a viewer in the middle only sees the
//                world undistorted if equal angles get equal image. Our hall is an ELLIPSE,
//                where equal arc length is NOT equal angle: mapping by arc (the rule the
//                procedural sky uses, SRS-SCN-25) squeezes the image ~15% at the near apexes
//                and stretches it ~16% at the far ones. Photographs show that; procedural
//                noise does not, which is why the two mappings differ. `uMediaAngular=0`
//                restores arc mapping for comparison.
//   vertical   — the elevation angle from eye height to the wall point, using that point's
//                ACTUAL distance from the centre, so the horizon lands on the viewer's eye
//                line all the way around and the vertical scale stays honest on both axes.
// These uniforms are SHARED IUniform objects, exactly like the sky set: the wall ribbons and
// the analytic floor/ceiling reflection read the same ones, so wall and reflection can never
// disagree (SRS-SCN-26).

import type { IUniform, Texture } from 'three';

export type MediaUniforms = Record<string, IUniform>;

export const MEDIA_UNIFORM_DECL = /* glsl */ `
  uniform sampler2D uMediaTex;
  uniform sampler2D uMediaTexB; // loop partner, crossfaded by uMediaSwap (SRS-VID-2)
  uniform float uMediaMix;     // 0 = procedural sky only, 1 = media only
  uniform float uMediaSwap;    // 0 = A, 1 = B
  uniform float uMediaPerim;   // ellipse perimeter (m) — arc-mapping denominator
  uniform float uMediaEyeY;    // eye height the horizon is aligned to (m)
  uniform float uMediaDist;    // fallback wall distance (m) when a point sits at the centre
  uniform vec2 uMediaCenter;   // hall centre in world xz
  uniform float uMediaStart;   // bearing of the panorama start (door's right edge), radians
  uniform float uMediaAngular; // 1 = bearing mapping (correct for photos), 0 = arc mapping
  uniform vec2 uMediaVRange;   // equirect rows the FILE actually covers: (0,1) = full 180 deg
  uniform float uMediaGain;    // per-source exposure trim: real footage varies a lot
  uniform float uMediaFlow;    // water animation amount on a STILL panorama (0 = off)
  uniform float uMediaTime;    // seconds, for uMediaFlow
  uniform float uMediaVFov;    // 1 = geometrically true; >1 squeezes more sky/sea into the band
  uniform float uMediaBandV;   // 1 = source is a BAND image: map its height straight to the wall
  uniform float uMediaBandBottom;
  uniform float uMediaBandH;
`;

export const MEDIA_FUNCTIONS = /* glsl */ `
  vec3 mediaSrgbToLinear(vec3 c) { return pow(c, vec3(2.2)); }

  // Equirect texcoord for a wall point: arc = its panorama arc (m), P = its world position.
  vec2 panoMediaUv(float arc, vec3 P) {
    vec2 rel = P.xz - uMediaCenter;
    float u = fract(arc / uMediaPerim);
    if (uMediaAngular > 0.5) {
      u = fract((uMediaStart - atan(rel.y, rel.x)) / 6.28318530718);
    }
    // Band-image mode: the source was authored for THIS wall (9.68:1, the 국중박 pipeline),
    // so its height maps straight onto the band — nothing is cropped and every pixel is used.
    if (uMediaBandV > 0.5) {
      // vb runs 0 at the wall's bottom edge. With flipY, texture v=0 is the image's BOTTOM
      // row — which is exactly the row that belongs at the wall's bottom. No inversion here
      // (unlike the equirect branch, whose v counts down from the zenith).
      float vb = (P.y - uMediaBandBottom) / uMediaBandH;
      return vec2(u, clamp(vb, 0.0, 1.0));
    }
    float dist = max(0.5, length(rel)); // true distance to THIS wall point
    if (uMediaAngular < 0.5) dist = uMediaDist;
    float elev = atan((P.y - uMediaEyeY) / dist); // radians, + is up
    // The band only spans ~38 deg of the sphere, so a geometrically true mapping shows a
    // thin slice around the horizon and crops the dramatic sky. uMediaVFov > 1 pulls more
    // of the panorama into the same band — no longer true-to-life, but a deliberate
    // panoramic-theatre squeeze rather than a bug.
    elev *= uMediaVFov;
    float v = 0.5 - elev / 3.14159265359; // equirect: v=0 is zenith, 1 is nadir

    // Living water on a still panorama. In an equirect the horizon is exactly the equator
    // (v = 0.5), so everything below it is ground/sea — the only part of a photograph that
    // may be moved without giving the trick away. Two slow crossing swells displace the
    // lookup; amplitude grows with depth below the horizon because the same displacement
    // covers far more ground near the horizon than at the viewer's feet.
    if (uMediaFlow > 0.0001) {
      float below = smoothstep(0.5, 0.515, v);
      // Broad, slow swells — a few cycles around the whole hall, not a high-frequency
      // ripple: tight frequencies read as a glitch in the surf line, not as water.
      float amp = uMediaFlow * below * 0.0011;
      float t = uMediaTime;
      v += sin(u * 24.0 + t * 0.42) * amp;
      v += sin(u * 11.0 - t * 0.26) * amp * 0.7;
      u += sin(v * 60.0 - t * 0.33) * amp * 0.5;
    }

    // A band-cropped master stores only part of that range; remap into the file's own rows
    // so pre-cropping (the delivery optimisation in 조사 L §4.1) needs no shader change.
    v = (v - uMediaVRange.x) / max(1e-5, uMediaVRange.y - uMediaVRange.x);

    // Everything above is in EQUIRECT space (v=0 is the image's top row). three uploads
    // textures with flipY, so texture v=0 is the image's BOTTOM row — flip once, here, at
    // the very end. Every media source must therefore use the same flipY convention;
    // ImageBitmap is created with imageOrientation:'flipY' for exactly this reason.
    return vec2(u, 1.0 - clamp(v, 0.0, 1.0));
  }

  // Reflection sampler: slot A only. During the 0.25s loop crossfade the floor lags the
  // wall by one slot — invisible in a dim, blurred secondary image, and it keeps the
  // 3-tap roughness blur at 3 texture reads instead of 6.
  vec3 panoMedia(float arc, vec3 P) {
    return mediaSrgbToLinear(texture2D(uMediaTex, panoMediaUv(arc, P)).rgb) * uMediaGain;
  }

  // Wall sampler: crossfades the loop partners so the seam never hard-cuts (SRS-SCN-23).
  vec3 panoMediaWall(float arc, vec3 P) {
    vec2 uv = panoMediaUv(arc, P);
    vec3 a = texture2D(uMediaTex, uv).rgb;
    vec3 b = texture2D(uMediaTexB, uv).rgb;
    return mediaSrgbToLinear(mix(a, b, uMediaSwap)) * uMediaGain;
  }
`;

export interface MediaOptions {
  perimeter: number;
  eyeY: number;
  wallDistance: number;
  center: [number, number];
  /** Bearing (rad) of the panorama start — the door's right edge seen from the centre. */
  startBearing: number;
  /** true (default) = bearing mapping, correct for photographic 360; false = arc mapping. */
  angular?: boolean;
  /** Equirect v range the source file covers; omit for a full 2:1 equirect. */
  vRange?: [number, number];
  /** Exposure trim for this source (1 = as encoded). Tonemapped HDR masters run dark. */
  gain?: number;
  /** Water animation amount for a STILL panorama; 0 (default) for real footage. */
  flow?: number;
  /** Vertical squeeze: 1 = true to life, >1 fits more of the panorama into the band. */
  vfov?: number;
  /** Source is a band image authored at the wall's own aspect, not a 2:1 equirect. */
  bandImage?: boolean;
  bandBottom?: number;
  bandHeight?: number;
}

export function createMediaUniforms(o: MediaOptions): MediaUniforms {
  return {
    uMediaTex: { value: null },
    uMediaTexB: { value: null },
    uMediaMix: { value: 0 },
    uMediaSwap: { value: 0 },
    uMediaPerim: { value: o.perimeter },
    uMediaEyeY: { value: o.eyeY },
    uMediaDist: { value: o.wallDistance },
    uMediaCenter: { value: o.center },
    uMediaStart: { value: o.startBearing },
    uMediaAngular: { value: o.angular === false ? 0 : 1 },
    uMediaVRange: { value: o.vRange ?? [0, 1] },
    uMediaGain: { value: o.gain ?? 1 },
    uMediaFlow: { value: o.flow ?? 0 },
    uMediaTime: { value: 0 },
    uMediaVFov: { value: o.vfov ?? 1 },
    uMediaBandV: { value: o.bandImage ? 1 : 0 },
    uMediaBandBottom: { value: o.bandBottom ?? 0 },
    uMediaBandH: { value: o.bandHeight ?? 1 },
  };
}

/**
 * Equirect rows the wall band actually needs, as fractions of a FULL equirect height.
 * Encode a band-cropped master to exactly this range and pass it as `vRange`.
 */
export function bandVRange(o: MediaOptions & { bandBottom: number; bandTop: number }): [number, number] {
  // Use the NEAREST wall distance: that point sees the widest vertical angle, so a crop
  // covering it covers every other point too.
  const v = (y: number): number => 0.5 - Math.atan((y - o.eyeY) / o.wallDistance) / Math.PI;
  return [v(o.bandTop), v(o.bandBottom)]; // top of the band is the SMALLER v
}

export function setMediaTexture(u: MediaUniforms, a: Texture | null, b: Texture | null = a): void {
  u.uMediaTex!.value = a;
  u.uMediaTexB!.value = b ?? a;
  if (a === null) u.uMediaMix!.value = 0;
}

/**
 * Ease the media in/out. Never a hard cut: brightness changes must fade over >=0.5s
 * (SRS-SCN-23 photosensitivity rule), and a wall that snaps from sky to footage is exactly
 * the kind of jump that rule exists to prevent.
 */
export const MEDIA_FADE_S = 0.9;

export function rampMediaMix(u: MediaUniforms, target: number, dt: number): void {
  const cur = u.uMediaMix!.value as number;
  if (cur === target) return;
  const step = dt / MEDIA_FADE_S;
  u.uMediaMix!.value = cur < target ? Math.min(target, cur + step) : Math.max(target, cur - step);
}
