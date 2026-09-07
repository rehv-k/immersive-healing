// ui/unsupported — terminal screen for mobile / no-WebGL2 (SRS-UI-7).

import { store } from '../core/store';
import { el, setPanelVisible } from './dom';

export function createUnsupported(rootEl: HTMLElement): void {
  const copyBtn = el('button', { class: 'ghost', text: '링크 복사' });
  copyBtn.addEventListener('click', () => {
    void navigator.clipboard?.writeText(location.href);
    copyBtn.textContent = '복사됨!';
  });
  const panel = el('section', { class: 'panel unsupported', role: 'dialog' }, [
    el('h1', { text: '일몰 · 몰입 홀' }),
    el('div', { class: 'unsupported-art', 'aria-hidden': 'true' }),
    el('p', { text: '이 전시는 데스크톱 브라우저(Chrome · Edge · Firefox)에서 감상할 수 있어요.' }),
    el('p', { class: 'muted tiny', text: '1인칭 시점 조작이 모바일 브라우저에서는 지원되지 않아요.' }),
    copyBtn,
  ]);
  rootEl.append(panel);
  store.subscribe(
    (s) => s.scene.state === 'unsupported',
    (v) => setPanelVisible(panel, v),
  );
}
