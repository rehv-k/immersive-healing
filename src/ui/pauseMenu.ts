// ui/pauseMenu — Esc pause overlay (SRS-UI-4). "계속" enables after the 1.5s re-lock
// cooldown; focus is trapped while open.

import { store } from '../core/store';
import { el, setPanelVisible, trapFocus } from './dom';

/** Resume is a re-lock request in the click's gesture task, not an action (SRS-UI-3 v1.4). */
export interface PauseCallbacks {
  onContinue(): void;
  msUntilResumeAllowed(): number;
}

export function createPauseMenu(rootEl: HTMLElement, cb: PauseCallbacks): void {
  const continueBtn = el('button', { class: 'primary', text: '계속', disabled: '' });
  continueBtn.addEventListener('click', () => cb.onContinue());
  const settingsBtn = el('button', { class: 'ghost', text: '설정' });
  settingsBtn.addEventListener('click', () => store.dispatch({ type: 'openSettings' }));
  const creditsBtn = el('button', { class: 'ghost', text: '크레딧' });
  creditsBtn.addEventListener('click', () => store.dispatch({ type: 'openCredits' }));
  const exitBtn = el('button', { class: 'ghost', text: '나가기' });
  exitBtn.addEventListener('click', () => store.dispatch({ type: 'exitRequested' }));

  const panel = el('section', { class: 'panel pause', role: 'dialog', 'aria-label': '일시정지' }, [
    el('h2', { text: '잠시 멈춤' }),
    el('p', { class: 'muted tiny', text: '소리는 낮은 볼륨으로 계속 흐르고 있어요.' }),
    continueBtn,
    settingsBtn,
    creditsBtn,
    exitBtn,
  ]);
  rootEl.append(panel);

  let untrap: (() => void) | null = null;
  let cooldownTimer: ReturnType<typeof setInterval> | null = null;

  store.subscribe(
    (s) => s.scene.paused && !s.ui.settingsOpen && !s.ui.creditsOpen,
    (open) => {
      setPanelVisible(panel, open);
      if (open) {
        continueBtn.setAttribute('disabled', '');
        if (cooldownTimer) clearInterval(cooldownTimer);
        cooldownTimer = setInterval(() => {
          if (cb.msUntilResumeAllowed() <= 0) {
            continueBtn.removeAttribute('disabled');
            if (cooldownTimer) clearInterval(cooldownTimer);
            cooldownTimer = null;
          }
        }, 100);
        if (!untrap) untrap = trapFocus(panel);
      } else {
        if (cooldownTimer) {
          clearInterval(cooldownTimer);
          cooldownTimer = null;
        }
        if (untrap) {
          untrap();
          untrap = null;
        }
      }
    },
  );
}
