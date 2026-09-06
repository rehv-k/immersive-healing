// Unit tests — rendition selection (SRS-VID-1 v1.1, audit F-5: reachable on 1080p monitors).
import { describe, expect, it } from 'vitest';
import { chooseRendition, stepDown } from '../src/scene/renditionSelect';

const base = {
  screenShare: 0.85,
  viewportWidth: 1920,
  devicePixelRatio: 1,
  presetDprCap: 1.5,
  deviceMemoryGb: 8,
  downlinkMbps: 50,
  preset: 'high' as const,
};

describe('chooseRendition', () => {
  it('[TC-VID-01] defaults to 1080p on the baseline device', () => {
    expect(chooseRendition({ ...base, deviceMemoryGb: 4, downlinkMbps: 10 })).toBe('1080p');
  });

  it('[TC-VID-02] reaches 1440p on a 1080p monitor with good specs (audit F-5 fix)', () => {
    // pw = 0.85*1920*1 = 1632 > 1400 → must be reachable without a 4K display
    expect(chooseRendition(base)).toBe('1440p');
  });

  it('[TC-VID-03] drops to 720p on slow connections', () => {
    expect(chooseRendition({ ...base, downlinkMbps: 4 })).toBe('720p');
  });

  it('[TC-VID-04] is capped by preset (low ≤ 1080p)', () => {
    expect(chooseRendition({ ...base, preset: 'low' })).toBe('1080p');
  });

  it('[TC-VID-05] low memory prevents 1440p', () => {
    expect(chooseRendition({ ...base, deviceMemoryGb: 4 })).toBe('1080p');
  });

  it('[TC-VID-06] stepDown cascades and terminates', () => {
    expect(stepDown('1440p')).toBe('1080p');
    expect(stepDown('1080p')).toBe('720p');
    expect(stepDown('720p')).toBeNull();
  });
});
