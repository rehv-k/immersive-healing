// ui/dom — tiny DOM helpers shared by overlay panels.

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  children: Array<HTMLElement | string> = [],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else node.setAttribute(k, v);
  }
  for (const c of children) node.append(typeof c === 'string' ? document.createTextNode(c) : c);
  return node;
}

/** Show/hide with `inert` so hidden panels leak neither clicks nor Tab focus (SRS-UI-1). */
export function setPanelVisible(panel: HTMLElement, visible: boolean): void {
  panel.classList.toggle('visible', visible);
  if (visible) panel.removeAttribute('inert');
  else panel.setAttribute('inert', '');
}

/** Focus trap for modal panels (SRS-UI-4). Returns cleanup. */
export function trapFocus(panel: HTMLElement): () => void {
  const prev = document.activeElement as HTMLElement | null;
  const onKey = (e: KeyboardEvent): void => {
    if (e.key !== 'Tab') return;
    const focusables = panel.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input, select, [tabindex]:not([tabindex="-1"])',
    );
    if (focusables.length === 0) return;
    const first = focusables[0]!;
    const last = focusables[focusables.length - 1]!;
    if (e.shiftKey && document.activeElement === first) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };
  panel.addEventListener('keydown', onKey);
  const focusables = panel.querySelectorAll<HTMLElement>('button:not([disabled])');
  focusables[0]?.focus();
  return () => {
    panel.removeEventListener('keydown', onKey);
    prev?.focus();
  };
}
