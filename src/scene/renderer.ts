// scene/renderer — WebGL2 renderer + postprocessing composer (SRS-SCN-1x).
// Tone mapping happens ONCE at the end of the pipeline (ToneMappingEffect); renderer stays
// NoToneMapping. Screen material is unlit and decodes video texels manually (§V8 rationale).

import {
  Camera,
  ColorManagement,
  NoToneMapping,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import {
  BloomEffect,
  EffectComposer,
  EffectPass,
  RenderPass,
  SMAAEffect,
  ToneMappingEffect,
  ToneMappingMode,
} from 'postprocessing';
import type { Preset } from '../types';

export interface RendererBundle {
  renderer: WebGLRenderer;
  composer: EffectComposer;
  canvas: HTMLCanvasElement;
  setPreset(preset: Preset, renderScale: number): void;
  render(dt: number): void;
  getUploadCostMs(): number;
  dispose(): void;
}

export function isWebGL2Available(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!c.getContext('webgl2');
  } catch {
    return false;
  }
}

export function createRenderer(scene: Scene, camera: PerspectiveCamera): RendererBundle {
  ColorManagement.enabled = true;
  const canvas = document.createElement('canvas');
  canvas.id = 'gl';
  const renderer = new WebGLRenderer({
    canvas,
    antialias: false,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = NoToneMapping;
  renderer.setClearColor(0x000000, 1);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera as Camera));

  // Effects are assembled per preset (SRS §8.1). Single merged EffectPass.
  let effectPass: EffectPass | null = null;
  let currentPreset: Preset | '' = '';
  let currentScale = 0;

  const buildEffects = (preset: Preset): EffectPass => {
    const effects = [];
    if (preset !== 'low') {
      // Bloom limited by luminance threshold — the emissive screen is the only element
      // bright enough to pass, approximating SelectiveBloom at lower cost.
      effects.push(
        new BloomEffect({
          luminanceThreshold: 0.85,
          luminanceSmoothing: 0.1,
          intensity: preset === 'high' ? 0.9 : 0.6,
          mipmapBlur: true,
        }),
      );
    }
    effects.push(new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC }));
    if (preset !== 'low') effects.push(new SMAAEffect());
    return new EffectPass(camera, ...effects);
  };

  const applySize = (preset: Preset, scale: number): void => {
    const dprCap = preset === 'low' ? 1.0 : preset === 'med' ? 1.25 : 1.5;
    const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
    const w = Math.floor(window.innerWidth * dpr * scale);
    const h = Math.floor(window.innerHeight * dpr * scale);
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    canvas.style.width = '100vw';
    canvas.style.height = '100vh';
  };

  const setPreset = (preset: Preset, renderScale: number): void => {
    if (preset !== currentPreset) {
      if (effectPass) {
        composer.removePass(effectPass);
        effectPass.dispose();
      }
      effectPass = buildEffects(preset);
      composer.addPass(effectPass);
      currentPreset = preset;
    }
    if (Math.abs(renderScale - currentScale) > 1e-6 || preset !== currentPreset) {
      currentScale = renderScale;
      applySize(preset, renderScale);
    }
  };

  window.addEventListener('resize', () => {
    if (currentPreset) applySize(currentPreset as Preset, currentScale);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
  });

  let lastUploadCost = 0;

  return {
    renderer,
    composer,
    canvas,
    setPreset,
    render(dt: number): void {
      const t0 = performance.now();
      composer.render(dt);
      lastUploadCost = performance.now() - t0; // frame CPU-side render cost (debug overlay)
    },
    getUploadCostMs: () => lastUploadCost,
    dispose(): void {
      composer.dispose();
      renderer.dispose();
    },
  };
}
