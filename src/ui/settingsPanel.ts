// ui/settingsPanel — full comfort/control settings (SRS-UI-5, fields per SRS-COR-21).
// Shared between gate and pause menu; immediate apply + debounced persistence.

import type { Settings } from '../types';
import { store } from '../core/store';
import { el, setPanelVisible, trapFocus } from './dom';

export function createSettingsPanel(rootEl: HTMLElement): void {
  const patch = (p: Partial<Settings>): void => store.dispatch({ type: 'settingsChanged', patch: p });

  const slider = (
    label: string,
    min: number,
    max: number,
    step: number,
    get: (s: Settings) => number,
    set: (v: number) => void,
    hint?: string,
  ): { row: HTMLElement; sync: (s: Settings) => void } => {
    const input = el('input', { type: 'range', min: String(min), max: String(max), step: String(step) });
    const value = el('span', { class: 'val' });
    input.addEventListener('input', () => set(Number(input.value)));
    const row = el('div', { class: 'setting' }, [
      el('label', {}, [label, value]),
      input,
      ...(hint ? [el('p', { class: 'tiny muted', text: hint })] : []),
    ]);
    return {
      row,
      sync: (s: Settings) => {
        const v = get(s);
        input.value = String(v);
        value.textContent = ` ${Math.round(v * 100) / 100}`;
      },
    };
  };

  const toggle = (
    label: string,
    get: (s: Settings) => boolean,
    set: (v: boolean) => void,
  ): { row: HTMLElement; sync: (s: Settings) => void } => {
    const input = el('input', { type: 'checkbox' });
    input.addEventListener('change', () => set(input.checked));
    const row = el('label', { class: 'setting toggle' }, [input, ` ${label}`]);
    return { row, sync: (s: Settings) => (input.checked = get(s)) };
  };

  const select = <T extends string>(
    label: string,
    options: Array<[T, string]>,
    get: (s: Settings) => T,
    set: (v: T) => void,
  ): { row: HTMLElement; sync: (s: Settings) => void } => {
    const sel = el('select');
    for (const [v, text] of options) sel.append(el('option', { value: v, text }));
    sel.addEventListener('change', () => set(sel.value as T));
    const row = el('div', { class: 'setting' }, [el('label', { text: label }), sel]);
    return { row, sync: (s: Settings) => (sel.value = get(s)) };
  };

  const controls = [
    slider('시야각(FOV)', 60, 100, 1, (s) => s.fov, (v) => patch({ fov: v }), '낮을수록 어안 왜곡이 줄어 멀미 완화에 도움이 돼요.'),
    select('이동 속도', [['slow', '느림'], ['normal', '보통'], ['fast', '빠름']], (s) => s.moveSpeed, (v) => patch({ moveSpeed: v })),
    slider('마우스 감도 (좌우)', 0.1, 3, 0.05, (s) => s.sensitivityX, (v) => patch({ sensitivityX: v })),
    slider('마우스 감도 (상하)', 0.1, 3, 0.05, (s) => s.sensitivityY, (v) => patch({ sensitivityY: v })),
    toggle('상하 시점 반전', (s) => s.invertY, (v) => patch({ invertY: v })),
    slider('걷기 흔들림(헤드밥)', 0, 1, 0.05, (s) => s.headBob, (v) => patch({ headBob: v }), '기본 0 — 멀미 저감을 위해 꺼져 있어요.'),
    toggle('카메라 부가 모션', (s) => s.cameraExtras, (v) => patch({ cameraExtras: v })),
    toggle('모션 블러', (s) => s.motionBlur, (v) => patch({ motionBlur: v })),
    toggle('마우스 스무딩', (s) => s.mouseSmoothing, (v) => patch({ mouseSmoothing: v })),
    slider('배경 애니메이션', 0, 1, 0.05, (s) => s.bgAnimation, (v) => patch({ bgAnimation: v })),
    select('품질', [['auto', '자동'], ['low', '낮음'], ['med', '보통'], ['high', '높음']], (s) => s.quality, (v) => patch({ quality: v })),
    slider('볼륨', 0, 1, 0.02, (s) => s.masterVolume, (v) => patch({ masterVolume: v })),
    toggle('음소거 (M)', (s) => s.muted, (v) => patch({ muted: v })),
    select('키 배치', [['wasd', 'WASD'], ['arrows', '방향키 중심']], (s) => s.keyLayout, (v) => patch({ keyLayout: v })),
  ];

  const closeBtn = el('button', { class: 'primary', text: '닫기' });
  closeBtn.addEventListener('click', () => store.dispatch({ type: 'closeSettings' }));

  const panel = el('section', { class: 'panel settings', role: 'dialog', 'aria-label': '설정' }, [
    el('h2', { text: '설정' }),
    ...controls.map((c) => c.row),
    closeBtn,
  ]);
  rootEl.append(panel);

  let untrap: (() => void) | null = null;
  store.subscribe(
    (s) => ({ open: s.ui.settingsOpen, settings: s.settings }),
    ({ open, settings }) => {
      setPanelVisible(panel, open);
      for (const c of controls) c.sync(settings);
      if (open && !untrap) untrap = trapFocus(panel);
      if (!open && untrap) {
        untrap();
        untrap = null;
      }
    },
  );
}
