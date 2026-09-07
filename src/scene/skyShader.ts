// scene/skyShader — the shared GLSL panorama (wall screen + floor/ceiling reflection).
// One function `panorama(px, py, detail)` renders the sunset/night cycle for a panorama
// coordinate: px = arc length / band height, py = 0..1 over the band. All parameters
// arrive as uniforms from skyCycle (JS), so the same sky is sampled consistently by the
// wall and by the analytic reflection on the floor (SRS-SCN-26, no extra render pass).

import type { IUniform } from 'three';
import type { SkyParams } from './skyCycle';

export const SKY_UNIFORM_DECL = /* glsl */ `
  uniform float uTime;
  uniform float uBandH;
  uniform float uSunArc;
  uniform float uPanoLen;
  uniform float uSunElev;
  uniform vec3 uZenith;
  uniform vec3 uMid;
  uniform vec3 uHorizon;
  uniform vec3 uSun;
  uniform float uSunGlow;
  uniform vec3 uCloudLit;
  uniform vec3 uSeaNear;
  uniform vec3 uSeaDeep;
  uniform float uStar;
  uniform float uMoon;
  uniform float uMoonArcFrac;
  uniform float uMoonHeight;
`;

export const SKY_FUNCTIONS = /* glsl */ `
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
  float fbm2(vec2 p) {
    float v = 0.0; float a = 0.6;
    for (int i = 0; i < 2; i++) { v += a * noise(p); p = p * 2.1 + 17.3; a *= 0.5; }
    return v;
  }

  // detail: 1 = full (wall), 0 = cheap (reflections: fewer octaves, no glitter)
  vec3 panorama(float px, float py, float detail) {
    float seaLine = 0.26;
    float t = uTime; // motion-scaled time is accumulated in JS (scaling here would jump)
    float breathe = 0.5 + 0.5 * sin(t * 0.05);   // 2-minute micro-cycle (PRD FR-37)
    float sunPx = uSunArc / uBandH;
    float halfLen = 0.5 * uPanoLen / uBandH;

    // warmth falls off away from the sun along the panorama — sides go dusky
    float away = clamp(abs(px - sunPx) / halfLen, 0.0, 1.0);
    vec3 horizon = mix(uHorizon, uMid * 0.9, away * 0.55) * (0.96 + 0.04 * breathe);
    vec3 mid = mix(uMid, uZenith * 1.6, away * 0.4);

    float h = smoothstep(seaLine, 1.0, py);
    vec3 col = mix(horizon, mid, smoothstep(0.0, 0.45, h));
    col = mix(col, uZenith, smoothstep(0.35, 1.0, h));

    // sun: disc sits at the horizon line + elevation; below −2° only the glow remains
    float sunY = seaLine + 0.12 + uSunElev * 0.025;
    vec2 d2 = vec2(px - sunPx, py - sunY);
    float d = length(d2);
    // the low sun looks large (artistic licence — 실감1관 급 스케일); two-lobe glow
    float disc = smoothstep(0.17, 0.115, d) * smoothstep(-2.5, 0.5, uSunElev);
    float g1 = smoothstep(0.55, 0.0, d);
    float g2 = smoothstep(1.7, 0.0, d);
    col += uSun * uSunGlow * (0.55 * g1 * g1 + 0.28 * g2 * g2);
    col += uSun * 0.95 * disc * (1.0 + 0.03 * sin(t * 0.7));

    // stars — fixed grid hash, very slow gentle twinkle (flash-free)
    if (uStar > 0.001 && py > seaLine) {
      vec2 sp = vec2(px * 26.0, py * 36.0);
      vec2 cell = floor(sp);
      float r = hash(cell);
      vec2 jitter = vec2(hash(cell + 7.1), hash(cell + 3.3));
      float sd = length(fract(sp) - jitter);
      float twinkle = 0.75 + 0.25 * sin(t * 0.8 + r * 40.0);
      float star = smoothstep(0.08, 0.0, sd) * step(0.86, r) * twinkle;
      col += vec3(0.85, 0.9, 1.0) * star * uStar * smoothstep(seaLine + 0.05, seaLine + 0.3, py);
    }

    // moon — drifts along the right half (arc 0.14→0.34) over the cycle
    if (uMoon > 0.001) {
      float moonPx = (uMoonArcFrac * uPanoLen) / uBandH;
      float moonPy = seaLine + 0.55 * uMoonHeight + 0.05;
      float md = length(vec2(px - moonPx, py - moonPy));
      col += vec3(0.82, 0.86, 0.95) * uMoon * (smoothstep(0.05, 0.035, md) + 0.35 * smoothstep(0.5, 0.0, md));
    }

    // drifting clouds — px is continuous around the hall
    float drift1 = detail > 0.5 ? fbm(vec2(px * 1.2 - t * 0.014, py * 9.0)) : fbm2(vec2(px * 1.2 - t * 0.014, py * 9.0));
    float band1 = smoothstep(0.5, 0.72, drift1) * smoothstep(0.85, 0.55, py) * smoothstep(seaLine + 0.05, seaLine + 0.22, py);
    vec3 cloudLit = mix(uCloudLit, uZenith * 1.5, smoothstep(seaLine, 0.8, py));
    cloudLit = mix(cloudLit, cloudLit * 0.55, away);
    col = mix(col, cloudLit, band1 * 0.75);
    if (detail > 0.5) {
      float drift2 = fbm(vec2(px * 2.2 + t * 0.02, py * 14.0 + 5.0));
      float band2 = smoothstep(0.55, 0.8, drift2) * smoothstep(0.95, 0.6, py) * smoothstep(seaLine + 0.15, seaLine + 0.4, py);
      col = mix(col, cloudLit * 0.7, band2 * 0.5);
    }

    // sea — sun path by day, moon path by night
    if (py < seaLine) {
      float depth = (seaLine - py) / seaLine;
      vec3 seaNear = mix(uSeaNear, uSeaDeep * 1.8, away);
      vec3 sea = mix(seaNear, uSeaDeep, smoothstep(0.0, 0.7, depth));
      float swell = noise(vec2(px * 7.5, py * 60.0 + t * 0.35));
      sea *= 0.92 + 0.16 * swell;
      float pathW = mix(0.1, 0.5, depth);
      float sunPath = smoothstep(pathW, 0.0, abs(px - sunPx)) * uSunGlow;
      float moonPx = (uMoonArcFrac * uPanoLen) / uBandH;
      float moonPath = smoothstep(pathW * 0.7, 0.0, abs(px - moonPx)) * uMoon * 0.6;
      float sparkle = 0.5;
      if (detail > 0.5) {
        sparkle = smoothstep(0.72, 0.95, noise(vec2(px * 40.0, py * 220.0 - t * 1.1)));
      }
      sea += uSun * sunPath * (0.25 + 0.75 * sparkle) * (1.0 - depth * 0.7);
      sea += vec3(0.7, 0.75, 0.85) * moonPath * (0.2 + 0.6 * sparkle) * (1.0 - depth * 0.7);
      col = sea;
    }

    float vig = smoothstep(0.0, 0.1, py) * smoothstep(1.0, 0.92, py);
    return col * mix(0.8, 1.0, vig);
  }
`;

export type SkyUniforms = Record<string, IUniform>;

export function createSkyUniforms(bandH: number, sunArc: number, panoLen: number): SkyUniforms {
  return {
    uTime: { value: 0 },
    uBandH: { value: bandH },
    uSunArc: { value: sunArc },
    uPanoLen: { value: panoLen },
    uSunElev: { value: 6 },
    uZenith: { value: [0.09, 0.16, 0.36] },
    uMid: { value: [0.62, 0.36, 0.24] },
    uHorizon: { value: [1.05, 0.62, 0.22] },
    uSun: { value: [1.25, 0.88, 0.55] },
    uSunGlow: { value: 0.85 },
    uCloudLit: { value: [0.9, 0.55, 0.32] },
    uSeaNear: { value: [0.55, 0.35, 0.2] },
    uSeaDeep: { value: [0.06, 0.09, 0.14] },
    uStar: { value: 0 },
    uMoon: { value: 0 },
    uMoonArcFrac: { value: 0.14 },
    uMoonHeight: { value: 0.35 },
  };
}

/** Push a SkyParams frame into a uniform set (shared by every sky-driven material). */
export function applySkyParams(u: SkyUniforms, p: SkyParams, time: number): void {
  u.uTime!.value = time;
  u.uSunElev!.value = p.sunElev;
  u.uZenith!.value = p.zenith;
  u.uMid!.value = p.mid;
  u.uHorizon!.value = p.horizon;
  u.uSun!.value = p.sun;
  u.uSunGlow!.value = p.sunGlow;
  u.uCloudLit!.value = p.cloudLit;
  u.uSeaNear!.value = p.seaNear;
  u.uSeaDeep!.value = p.seaDeep;
  u.uStar!.value = p.star;
  u.uMoon!.value = p.moon;
  u.uMoonArcFrac!.value = p.moonArcFrac;
  u.uMoonHeight!.value = p.moonHeight;
}
