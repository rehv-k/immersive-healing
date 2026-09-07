// Unit tests — settings sanitize/clamp (SRS §9.2 unit layer; corruption injection cases).
import { describe, expect, it } from 'vitest';
import {
  applyComfortProfile,
  defaultSettings,
  resolveComfortProfile,
  sanitizeSettings,
} from '../src/core/settings';

describe('sanitizeSettings', () => {
  it('[TC-COR-04] returns defaults for null/garbage roots', () => {
    expect(sanitizeSettings(null)).toEqual(defaultSettings());
    expect(sanitizeSettings('str')).toEqual(defaultSettings());
    expect(sanitizeSettings(42)).toEqual(defaultSettings());
  });

  it('[TC-COR-05] clamps fov into 60..100 and rejects NaN/Infinity', () => {
    expect(sanitizeSettings({ fov: 30 }).fov).toBe(60);
    expect(sanitizeSettings({ fov: 300 }).fov).toBe(100);
    expect(sanitizeSettings({ fov: NaN }).fov).toBe(90);
    expect(sanitizeSettings({ fov: Infinity }).fov).toBe(90);
    expect(sanitizeSettings({ fov: 'evil' }).fov).toBe(90);
  });

  it('[TC-COR-06] falls back per-field, not whole-object', () => {
    const s = sanitizeSettings({ fov: 75, masterVolume: 'broken', headBob: 2 });
    expect(s.fov).toBe(75);
    expect(s.masterVolume).toBe(0.8);
    expect(s.headBob).toBe(1);
  });

  it('[TC-COR-07] rejects unknown enum values', () => {
    expect(sanitizeSettings({ moveSpeed: 'ludicrous' }).moveSpeed).toBe('normal');
    expect(sanitizeSettings({ quality: 'ultra' }).quality).toBe('auto');
    expect(sanitizeSettings({ keyLayout: 'custom' }).keyLayout).toBe('wasd'); // custom is out of MVP scope
    expect(sanitizeSettings({ comfortProfile: 'weird' }).comfortProfile).toBe('normal');
  });

  it('[TC-COR-08] sensitivity clamps to 0.1..3.0', () => {
    expect(sanitizeSettings({ sensitivityX: 0 }).sensitivityX).toBe(0.1);
    expect(sanitizeSettings({ sensitivityY: 99 }).sensitivityY).toBe(3);
  });

  it('[TC-COR-09] booleans reject non-boolean values', () => {
    expect(sanitizeSettings({ muted: 'yes' }).muted).toBe(false);
    expect(sanitizeSettings({ invertY: 1 }).invertY).toBe(false);
  });

  it('[TC-COR-16] breathGuide defaults off and rejects non-boolean values', () => {
    expect(defaultSettings().breathGuide).toBe(false);
    expect(sanitizeSettings({ breathGuide: 'on' }).breathGuide).toBe(false);
    expect(sanitizeSettings({ breathGuide: true }).breathGuide).toBe(true);
  });

  it('[TC-COR-10] prefers-reduced-motion drives defaults', () => {
    const d = defaultSettings(true);
    expect(d.comfortProfile).toBe('sensitive');
    expect(d.bgAnimation).toBe(0.3);
  });
});

describe('comfort profile', () => {
  it('[TC-COR-11] sensitive forces the comfort set', () => {
    const s = applyComfortProfile({ ...defaultSettings(), headBob: 1, motionBlur: true, bgAnimation: 1 }, 'sensitive');
    expect(s.headBob).toBe(0);
    expect(s.motionBlur).toBe(false);
    expect(s.bgAnimation).toBeLessThanOrEqual(0.3);
  });

  it('[TC-COR-12] breaking a sensitive profile resolves to custom', () => {
    const base = applyComfortProfile(defaultSettings(), 'sensitive');
    expect(resolveComfortProfile(base)).toBe('sensitive');
    expect(resolveComfortProfile({ ...base, headBob: 0.5 })).toBe('custom');
    expect(resolveComfortProfile({ ...base, bgAnimation: 0.8 })).toBe('custom');
  });
});
