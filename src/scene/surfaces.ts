// scene/surfaces — glossy floor / ceiling with an ANALYTIC reflection of the panorama
// (SRS-SCN-26). Because the wall image is procedural, the reflection is computed by
// reflecting the view ray about the surface plane, intersecting the elliptic cylinder of
// the wall and evaluating the same `panorama()` there — no mirror camera, no extra render
// target, no memory. Reference look: 아르떼뮤지엄의 거울 바닥 + 국중박 실감1관 바닥 투사 (조사 K).

import { DoubleSide, ShaderMaterial, type DataTexture } from 'three';
import { SKY_FUNCTIONS, SKY_UNIFORM_DECL, type SkyUniforms } from './skyShader';

const VERT = /* glsl */ `
  varying vec3 vWorldPos;
  void main() {
    vec4 wp = modelMatrix * vec4(position, 1.0);
    vWorldPos = wp.xyz;
    gl_Position = projectionMatrix * viewMatrix * wp;
  }
`;

const FRAG = /* glsl */ `
  ${SKY_UNIFORM_DECL}
  uniform vec2 uCenter;
  uniform vec2 uAxes;
  uniform float uPlaneY;
  uniform float uNormalSign;
  uniform float uBandBottom;
  uniform float uBandTop;
  uniform sampler2D uArcLut;
  uniform float uPerimeter;
  uniform float uPanoStart;
  uniform float uGloss;
  uniform float uTaps;
  uniform float uDetail;
  uniform vec3 uBase;
  uniform float uBreath;
  uniform vec2 uBreathCenter;
  varying vec3 vWorldPos;

  ${SKY_FUNCTIONS}

  // 16-bit LUT: clockwise arc (normalised by perimeter) indexed by u = (start−θ)/2π.
  float lutArc(float u01) {
    float n = 1024.0;
    float f = u01 * (n - 1.0);
    float i = floor(f);
    float fr = f - i;
    vec2 t0 = texture2D(uArcLut, vec2((i + 0.5) / n, 0.5)).rg;
    vec2 t1 = texture2D(uArcLut, vec2((min(i + 1.0, n - 1.0) + 0.5) / n, 0.5)).rg;
    float a0 = (t0.r * 255.0 * 256.0 + t0.g * 255.0) / 65535.0;
    float a1 = (t1.r * 255.0 * 256.0 + t1.g * 255.0) / 65535.0;
    return mix(a0, a1, fr) * uPerimeter;
  }

  // Emitted colour seen from P along R: hit the elliptic wall, map to the panorama.
  vec3 reflectSample(vec3 P, vec3 R) {
    vec2 o = (P.xz - uCenter) / uAxes;
    vec2 d = R.xz / uAxes;
    float A = dot(d, d);
    float B = 2.0 * dot(o, d);
    float C = dot(o, o) - 1.0;
    float disc = B * B - 4.0 * A * C;
    if (A < 1e-7 || disc < 0.0) return vec3(0.0);
    float t = (-B + sqrt(disc)) / (2.0 * A);
    if (t < 0.0) return vec3(0.0);
    vec3 H = P + R * t;
    if (H.y < uBandBottom || H.y > uBandTop) return vec3(0.0);
    vec2 hp = (H.xz - uCenter) / uAxes;
    float theta = atan(hp.y, hp.x);
    float u = mod(uPanoStart - theta, 6.28318530718) / 6.28318530718;
    float arc = lutArc(u);
    if (arc > uPanoLen) return vec3(0.02, 0.015, 0.01); // entrance gap — dark corridor
    float px = arc / uBandH;
    float py = (H.y - uBandBottom) / uBandH;
    return panorama(px, py, uDetail);
  }

  void main() {
    vec3 V = normalize(vWorldPos - cameraPosition);
    vec3 N = vec3(0.0, uNormalSign, 0.0);
    vec3 R = reflect(V, N);
    float cosT = clamp(dot(-V, N), 0.0, 1.0);
    float fres = 0.04 + 0.96 * pow(1.0 - cosT, 5.0);

    vec3 refl = reflectSample(vWorldPos, R);
    if (uTaps > 1.5) {
      // roughness: average a few slightly tilted rays (cheap blur, no texture)
      refl += reflectSample(vWorldPos, normalize(R + vec3(0.0, 0.03, 0.0)));
      refl += reflectSample(vWorldPos, normalize(R - vec3(0.0, 0.03, 0.0)));
      refl /= 3.0;
    }

    // base: dark polished tiles, faint grout
    vec2 g = fract(vWorldPos.xz / 1.2);
    float grout = smoothstep(0.0, 0.03, g.x) * smoothstep(0.0, 0.03, g.y) * smoothstep(1.0, 0.97, g.x) * smoothstep(1.0, 0.97, g.y);
    vec3 base = uBase * mix(0.55, 1.0, grout);
    float k = uGloss * mix(0.45, 1.0, fres);
    vec3 col = base * (1.0 - 0.5 * k) + refl * k;

    // breathing-rhythm light: a soft ring around the viewer, slow (6/min), warm, dim
    if (uBreath > 0.001) {
      float rr = length(vWorldPos.xz - uBreathCenter);
      float ring = smoothstep(0.45, 0.0, abs(rr - (1.4 + 0.6 * uBreath)));
      col += vec3(1.0, 0.72, 0.48) * ring * 0.06 * (0.3 + 0.7 * uBreath);
    }
    gl_FragColor = vec4(col, 1.0);
  }
`;

export interface ReflectiveOptions {
  sky: SkyUniforms;
  arcLut: DataTexture;
  center: [number, number];
  axes: [number, number];
  perimeter: number;
  panoStart: number;
  bandBottom: number;
  bandTop: number;
  planeY: number;
  normalSign: 1 | -1;
  gloss: number;
  base: [number, number, number];
}

export function createReflectiveMaterial(o: ReflectiveOptions): ShaderMaterial {
  return new ShaderMaterial({
    uniforms: {
      ...o.sky, // shared IUniform objects — one update feeds every sky material
      uCenter: { value: o.center },
      uAxes: { value: o.axes },
      uPlaneY: { value: o.planeY },
      uNormalSign: { value: o.normalSign },
      uBandBottom: { value: o.bandBottom },
      uBandTop: { value: o.bandTop },
      uArcLut: { value: o.arcLut },
      uPerimeter: { value: o.perimeter },
      uPanoStart: { value: o.panoStart },
      uGloss: { value: o.gloss },
      uTaps: { value: 3 },
      uDetail: { value: 0 },
      uBase: { value: o.base },
      uBreath: { value: 0 },
      uBreathCenter: { value: [0, 0] },
    },
    vertexShader: VERT,
    fragmentShader: FRAG,
    side: DoubleSide,
  });
}
