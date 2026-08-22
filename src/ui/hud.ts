// ui/hud — corridor hints, skip button, background-return prompt, notice toasts,
// exiting/credits screen. HUD is hidden in hall by default (SRS-UI-1 / PRD FR-36).

import { store } from '../core/store';
import { el, setPanelVisible } from './dom';

export interface HudCallbacks {
  onResumeFromBackground(): void;
  onReenter(): void;
}

export function createHud(rootEl: HTMLElement, cb: HudCallbacks): { notifyMoved(): void } {
  // Corridor hint + skip
  const hint = el('div', { class: 'hud-hint' }, [
    el('span', { text: '이동 ⬆⬇⬅➡ / WASD · 시점 🖱 또는 Q E R F' }),
  ]);
  const skipBtn = el('button', { class: 'ghost hud-skip', text: '건너뛰기 ▸' });
  skipBtn.addEventListener('click', () => store.dispatch({ type: 'skipCorridor' }));
  const corridorWrap = el('div', { class: 'hud-corridor' }, [hint, skipBtn]);
  rootEl.append(corridorWrap);

  // Background-return minimal prompt (SRS-COR-32 — not the full pause menu)
  const bgPrompt = el('button', { class: 'panel bg-prompt', text: '클릭하여 시점 복귀' });
  bgPrompt.addEventListener('click', () => cb.onResumeFromBackground());
  rootEl.append(bgPrompt);

  // Exit / credits end screen
  const reenterBtn = el('button', { class: 'primary', text: '다시 입장' });
  reenterBtn.addEventListener('click', () => cb.onReenter());
  const exitScreen = el('section', { class: 'panel exit-screen' }, [
    el('h2', { text: '오늘의 상영이 이어지고 있어요' }),
    el('p', { class: 'muted', text: '함께해 주셔서 고마워요. 언제든 다시 걸어 들어오세요.' }),
    reenterBtn,
  ]);
  rootEl.append(exitScreen);

  // Notice toasts
  const toastWrap = el('div', { class: 'toasts' });
  rootEl.append(toastWrap);
  const toastEls = new Map<string, HTMLElement>();

  let movedOnce = false;

  const sync = (): void => {
    const s = store.get();
    const inCorridor = s.scene.state === 'corridor' && !s.scene.paused;
    corridorWrap.classList.toggle('visible', inCorridor);
    hint.classList.toggle('faded', movedOnce);
    setPanelVisible(
      bgPrompt,
      s.sys.backgroundUnlocked &&
        !s.scene.paused &&
        (s.scene.state === 'corridor' || s.scene.state === 'hall'),
    );
    setPanelVisible(exitScreen, s.scene.state === 'exiting');

    // toasts
    for (const n of s.sys.notices) {
      if (toastEls.has(n.id)) continue;
      const t = el('div', { class: `toast ${n.severity}` }, [
        el('span', { text: n.message }),
      ]);
      if (n.retryable) {
        const retry = el('button', { class: 'link', text: '다시 시도' });
        retry.addEventListener('click', () => store.dispatch({ type: 'noticeRetried', id: n.id }));
        t.append(retry);
      }
      const close = el('button', { class: 'link', text: '✕' });
      close.addEventListener('click', () => store.dispatch({ type: 'noticeDismissed', id: n.id }));
      t.append(close);
      toastWrap.append(t);
      toastEls.set(n.id, t);
    }
    for (const [id, elx] of toastEls) {
      if (!s.sys.notices.some((n) => n.id === id)) {
        elx.remove();
        toastEls.delete(id);
      }
    }
  };

  store.subscribe((s) => ({ st: s.scene.state, p: s.scene.paused, bg: s.sys.backgroundUnlocked, n: s.sys.notices }), sync);

  return {
    notifyMoved(): void {
      if (!movedOnce) {
        movedOnce = true;
        sync();
      }
    },
  };
}
