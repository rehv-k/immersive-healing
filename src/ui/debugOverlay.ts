// ui/debugOverlay — ?debug measurement panel (SRS §8.6, NFR-11).
// Shows fps, 1% low, frame-time spikes, input latency proxy, scale/preset/rendition,
// draw calls, render cost. JSON download persists a measurement log (M0 evidence).

import type { WebGLRenderer } from 'three';
import { store } from '../core/store';
import { el } from './dom';

interface Sample {
  t: number;
  fps: number;
  frameMs: number;
}

export interface DebugSources {
  renderer: WebGLRenderer;
  getOnePercentLow(): number;
  getRenderCostMs(): number;
}

export function createDebugOverlay(rootEl: HTMLElement, src: DebugSources): { frame(dt: number): void } {
  const enabled = new URLSearchParams(location.search).has('debug');
  if (!enabled) return { frame: () => {} };

  const pre = el('pre', { class: 'debug-overlay' });
  const dl = el('button', { class: 'link', text: 'JSON ⭳' });
  const wrap = el('div', { class: 'debug-wrap' }, [pre, dl]);
  rootEl.append(wrap);

  const log: Sample[] = [];
  let spikes = 0;
  let frames = 0;
  let acc = 0;

  dl.addEventListener('click', () => {
    const blob = new Blob(
      [JSON.stringify({ exportedAt: new Date().toISOString(), spikesOver50ms: spikes, samples: log }, null, 1)],
      { type: 'application/json' },
    );
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `ih-measure-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  return {
    frame(dt: number): void {
      const ms = dt * 1000;
      if (ms > 50) spikes++;
      frames++;
      acc += dt;
      if (acc >= 0.5) {
        const s = store.get().sys;
        const info = src.renderer.info;
        pre.textContent = [
          `fps(1s) ${s.fpsDisplay}  window ${s.fpsWindow}  1%low ${src.getOnePercentLow().toFixed(0)}`,
          `spikes>50ms ${spikes}   render ${src.getRenderCostMs().toFixed(2)}ms`,
          `preset ${s.preset}  scale ${s.renderScale.toFixed(2)}  rendition ${s.rendition}`,
          `drawcalls ${info.render.calls}  tris ${info.render.triangles}`,
          `audio ${s.audioState}  locked ${s.pointerLocked}`,
        ].join('\n');
        log.push({ t: performance.now(), fps: s.fpsDisplay, frameMs: ms });
        if (log.length > 2400) log.shift();
        frames = 0;
        acc = 0;
      }
    },
  };
}
