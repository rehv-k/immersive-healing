// Unit tests — state transition matrix, exhaustive allow/deny (SRS §9.2 unit layer).
import { describe, expect, it } from 'vitest';
import { TRANSITIONS, canTransition, canPauseIn } from '../src/core/sceneState';
import type { SceneState } from '../src/types';

const ALL: SceneState[] = ['boot', 'unsupported', 'gate', 'corridor', 'hall', 'exiting'];

describe('transition matrix', () => {
  const allowed: Array<[SceneState, SceneState]> = [
    ['boot', 'gate'],
    ['boot', 'unsupported'],
    ['gate', 'corridor'],
    ['gate', 'hall'],
    ['corridor', 'hall'],
    ['corridor', 'exiting'], // v1.1 fix — exit from corridor must not dead-end (audit S6)
    ['hall', 'exiting'],
    ['exiting', 'gate'],
  ];

  it('allows exactly the specified transitions', () => {
    for (const from of ALL) {
      for (const to of ALL) {
        const should = allowed.some(([f, t]) => f === from && t === to);
        expect(canTransition(from, to), `${from} -> ${to}`).toBe(should);
      }
    }
  });

  it('unsupported is terminal', () => {
    expect(TRANSITIONS.unsupported).toHaveLength(0);
  });

  it('pause is only reachable in corridor/hall (SRS-COR-32)', () => {
    expect(canPauseIn('corridor')).toBe(true);
    expect(canPauseIn('hall')).toBe(true);
    expect(canPauseIn('gate')).toBe(false);
    expect(canPauseIn('exiting')).toBe(false);
    expect(canPauseIn('boot')).toBe(false);
    expect(canPauseIn('unsupported')).toBe(false);
  });
});
