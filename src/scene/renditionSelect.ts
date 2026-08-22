// scene/renditionSelect — pure rendition selection logic (SRS-VID-1, v1.1 thresholds).
// Kept free of three.js imports so it is unit-testable.

import type { Preset, Rendition } from '../types';

export interface RenditionInput {
  /** Expected on-screen pixel width of the 3D screen surface. */
  screenShare: number; // 0..1 share of viewport width the screen occupies at viewing spot
  viewportWidth: number;
  devicePixelRatio: number;
  presetDprCap: number;
  deviceMemoryGb: number; // navigator.deviceMemory ?? 4
  downlinkMbps: number; // navigator.connection?.downlink ?? 10
  preset: Preset;
}

export const PRESET_RENDITION_CAP: Record<Preset, Rendition> = {
  low: '1080p',
  med: '1440p',
  high: '1440p',
};

const ORDER: Rendition[] = ['720p', '1080p', '1440p'];

export function capRendition(r: Rendition, cap: Rendition): Rendition {
  return ORDER.indexOf(r) > ORDER.indexOf(cap) ? cap : r;
}

export function stepDown(r: Rendition): Rendition | null {
  const i = ORDER.indexOf(r);
  return i > 0 ? (ORDER[i - 1] as Rendition) : null;
}

export function chooseRendition(input: RenditionInput): Rendition {
  const pw =
    input.screenShare *
    input.viewportWidth *
    Math.min(input.devicePixelRatio, input.presetDprCap);

  let pick: Rendition = '1080p';
  if (input.downlinkMbps > 0 && input.downlinkMbps < 6) pick = '720p';
  else if (pw > 1400 && input.deviceMemoryGb >= 8 && input.downlinkMbps > 25) pick = '1440p';

  return capRendition(pick, PRESET_RENDITION_CAP[input.preset]);
}
