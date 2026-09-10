// ui/gate — entry gate (SRS-UI-2). Copy follows PRD FR-90: rest/relaxation wording only,
// no therapeutic claims. The enter click is the single user gesture that unlocks audio+pointer.

import { store } from '../core/store';
import { el, setPanelVisible } from './dom';

/**
 * Entry travels on a callback, not on the action channel (SRS-UI-3 v1.4): `onEnter` must run
 * inside this click's own gesture task so audio resume and pointer lock are granted
 * (SRS-COR-51), and it must be able to fail back onto the gate (§6.1). ui still calls no
 * browser API itself — core/inputSession and audio/graph own those.
 */
export interface GateCallbacks {
  onEnter(direct: boolean): void;
  onFullscreenToggled(v: boolean): void;
}

export function createGate(rootEl: HTMLElement, cb: GateCallbacks): { update(): void } {
  const title = el('h1', { text: '일몰 · 몰입 홀' });
  const subtitle = el('p', {
    class: 'muted',
    text: '웹을 위해 만들어진 몰입 전시 — 어두운 복도를 지나, 벽 전체가 하늘과 바다로 이어지는 타원의 홀로. 일몰에서 별이 뜨는 밤까지, 10분의 순환.',
  });
  const notice = el('p', {
    class: 'tiny muted',
    text: '⚠ 어두운 공간과 1인칭 이동이 포함돼요. 멀미에 민감하면 아래에서 “민감함”을 선택해 주세요. 섬광 연출은 없습니다.',
  });
  const headphone = el('p', { class: 'hint', text: '🎧 헤드폰 착용을 권장합니다 — 소리가 공간의 절반입니다.' });

  const comfortWrap = el('div', { class: 'row' });
  const comfortNormal = el('button', { class: 'choice selected', text: '보통' });
  const comfortSensitive = el('button', { class: 'choice', text: '민감함 (움직임 최소화)' });
  comfortWrap.append(comfortNormal, comfortSensitive);
  comfortNormal.addEventListener('click', () => {
    comfortNormal.classList.add('selected');
    comfortSensitive.classList.remove('selected');
    store.dispatch({ type: 'settingsChanged', patch: { comfortProfile: 'normal' } });
  });
  comfortSensitive.addEventListener('click', () => {
    comfortSensitive.classList.add('selected');
    comfortNormal.classList.remove('selected');
    store.dispatch({ type: 'settingsChanged', patch: { comfortProfile: 'sensitive' } });
  });

  const fsLabel = el('label', { class: 'tiny' });
  const fsCheck = el('input', { type: 'checkbox' });
  fsLabel.append(fsCheck, ' 전체화면으로 관람 (선택)');
  fsCheck.addEventListener('change', () => cb.onFullscreenToggled(fsCheck.checked));

  const progress = el('div', { class: 'progress' }, [el('div', { class: 'bar' })]);
  const progressLabel = el('p', { class: 'tiny muted', text: '준비 중…' });

  const enterBtn = el('button', { class: 'primary', text: '입장하기', disabled: '' });
  enterBtn.addEventListener('click', () => cb.onEnter(false));
  const directBtn = el('button', { class: 'ghost hidden', text: '바로 홀 입장 (재방문)' });
  directBtn.addEventListener('click', () => cb.onEnter(true));

  const links = el('div', { class: 'row tiny' });
  const settingsLink = el('button', { class: 'link', text: '설정' });
  settingsLink.addEventListener('click', () => store.dispatch({ type: 'openSettings' }));
  const creditsLink = el('button', { class: 'link', text: '크레딧' });
  creditsLink.addEventListener('click', () => store.dispatch({ type: 'openCredits' }));
  links.append(settingsLink, creditsLink);

  const panel = el('section', { class: 'panel gate', role: 'dialog', 'aria-label': '입장 화면' }, [
    title,
    subtitle,
    headphone,
    notice,
    el('p', { class: 'tiny muted', text: '조작: 이동 WASD/방향키 · 시점 마우스 또는 Q/E/R/F · 일시정지 Esc' }),
    comfortWrap,
    fsLabel,
    progress,
    progressLabel,
    enterBtn,
    directBtn,
    links,
  ]);
  rootEl.append(panel);

  let loadStart = performance.now();

  const update = (): void => {
    const s = store.get();
    const showing = s.scene.state === 'gate';
    setPanelVisible(panel, showing);
    if (!showing) return;

    const p = s.sys.loadProgress;
    const ready = s.sys.corridorReady;
    (progress.firstElementChild as HTMLElement).style.width = `${Math.round(p * 100)}%`;
    const elapsed = (performance.now() - loadStart) / 1000;
    if (ready) {
      progressLabel.textContent = '준비 완료';
      enterBtn.removeAttribute('disabled');
    } else if (elapsed > 3) {
      progressLabel.textContent = `불러오는 중 ${Math.round(p * 100)}%`;
    }
    directBtn.classList.toggle('hidden', !(s.settings.visited && s.sys.hallLqReady));

    // reflect comfort selection from settings (may be set by prefers-reduced-motion)
    const sensitive = s.settings.comfortProfile === 'sensitive';
    comfortSensitive.classList.toggle('selected', sensitive);
    comfortNormal.classList.toggle('selected', !sensitive && s.settings.comfortProfile === 'normal');
  };

  store.subscribe((s) => ({ st: s.scene.state, p: s.sys.loadProgress, r: s.sys.corridorReady, v: s.settings.visited, c: s.settings.comfortProfile, lq: s.sys.hallLqReady }), update);
  loadStart = performance.now();
  return { update };
}
