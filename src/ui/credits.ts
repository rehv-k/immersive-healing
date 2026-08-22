// ui/credits — rendered solely from data/credits.json (SRS-UI-6, single source).

import creditsData from '../data/credits.json';
import { store } from '../core/store';
import { el, setPanelVisible, trapFocus } from './dom';

interface CreditEntry {
  kind: string;
  title: string;
  author: string;
  sourceUrl: string;
  license: string;
  licenseUrl: string;
  usedFor: string;
}

export function createCredits(rootEl: HTMLElement): void {
  const entries = creditsData as CreditEntry[];
  const list = el('ul', { class: 'credits-list' });
  for (const c of entries) {
    const line = el('li', {}, [
      el('strong', { text: c.title }),
      ` — ${c.author} · `,
      el('a', { href: c.licenseUrl, target: '_blank', rel: 'noreferrer', text: c.license }),
      el('span', { class: 'muted tiny', text: ` (${c.usedFor})` }),
    ]);
    list.append(line);
  }

  const closeBtn = el('button', { class: 'primary', text: '닫기' });
  closeBtn.addEventListener('click', () => store.dispatch({ type: 'closeCredits' }));

  const panel = el('section', { class: 'panel credits', role: 'dialog', 'aria-label': '크레딧' }, [
    el('h2', { text: '크레딧' }),
    el('p', {
      class: 'muted tiny',
      text: '이 전시는 웹을 위해 만들어진 원본 작품입니다. 편안한 휴식이 되었기를 바라요.',
    }),
    list,
    el('p', { class: 'tiny muted', text: '통계: 현재 아무 데이터도 수집하지 않습니다.' }),
    closeBtn,
  ]);
  rootEl.append(panel);

  let untrap: (() => void) | null = null;
  store.subscribe(
    (s) => s.ui.creditsOpen,
    (open) => {
      setPanelVisible(panel, open);
      if (open && !untrap) untrap = trapFocus(panel);
      if (!open && untrap) {
        untrap();
        untrap = null;
      }
    },
  );
}
