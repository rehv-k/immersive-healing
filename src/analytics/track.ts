// analytics/track — no-op hook (SRS-ANL-1: tool undecided, wired at M2, enabled at launch).
// Event names/payloads follow the whitelist in PRD FR-80 / SRS-ANL-2. No identifiers.

type EventName =
  | 'load_complete'
  | 'enter'
  | 'corridor_skip'
  | 'hall_reached'
  | 'dwell'
  | 'exit'
  | 'quality'
  | 'error';

export function track(name: EventName, payload?: Record<string, string | number | boolean>): void {
  if (import.meta.env.DEV) {
    console.debug('[analytics:noop]', name, payload ?? {});
  }
  // Intentionally empty in production until an analytics tool is adopted (launch decision).
}
