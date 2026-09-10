// Shared types — the contract between core / scene / audio / ui (SRS §4).

export type SceneState = 'boot' | 'unsupported' | 'gate' | 'corridor' | 'hall' | 'exiting';

export type Preset = 'low' | 'med' | 'high';
export type Rendition = '720p' | '1080p' | '1440p';
export type ComfortProfile = 'sensitive' | 'normal' | 'custom';

export type ErrKind =
  | 'webgl-unsupported'
  | 'context-lost'
  | 'audio-resume'
  | 'asset-load'
  | 'video-play'
  | 'storage'
  | 'pointer-lock'
  | 'manifest'
  | 'audio-decode'
  | 'video-cors';

export interface Notice {
  id: string;
  kind: ErrKind;
  severity: 'toast' | 'overlay' | 'blocking';
  retryable: boolean;
  at: number;
  message: string;
}

export interface Settings {
  schemaVersion: 1;
  fov: number; // 60..100, default 90
  moveSpeed: 'slow' | 'normal' | 'fast';
  sensitivityX: number; // 0.1..3.0, 1.0 = 0.002 rad/px
  sensitivityY: number;
  invertY: boolean;
  headBob: number; // 0..1, default 0
  cameraExtras: boolean; // shake / additive motion, default false
  motionBlur: boolean; // default false
  mouseSmoothing: boolean; // default false; true = 3-frame moving average
  bgAnimation: number; // 0..1; effective = min(value, preset cap)
  breathGuide: boolean; // default false — 호흡 리듬 빛(바닥, 분당 6회) (SRS-COR-25)
  quality: 'auto' | Preset;
  masterVolume: number; // 0..1
  muted: boolean;
  keyLayout: 'wasd' | 'arrows';
  comfortProfile: ComfortProfile;
  comfortTouchedByUser: boolean;
  visited: boolean;
}

export interface SceneSlice {
  state: SceneState;
  paused: boolean; // only reachable from corridor|hall (SRS-COR-32)
  pausedFrom: SceneState | null;
  transitioning: boolean;
}

export interface UiSlice {
  settingsOpen: boolean;
  creditsOpen: boolean;
}

export interface SysSlice {
  loadProgress: number; // corridor-min + audio-base only (§5.4)
  hallProgress: number;
  corridorReady: boolean;
  hallLqReady: boolean;
  hallHqReady: boolean;
  fpsDisplay: number; // 1s moving average, display only
  fpsWindow: number; // 2s window average, adaptation only
  renderScale: number;
  preset: Preset;
  rendition: Rendition;
  audioState: AudioContextState | 'uninitialized';
  pointerLocked: boolean;
  backgroundUnlocked: boolean;
  notices: Notice[];
}

export interface AppState {
  scene: SceneSlice;
  ui: UiSlice;
  settings: Settings;
  sys: SysSlice;
}

/**
 * Actions ui/ may dispatch (SRS §4.2).
 *
 * Every member MUST have at least one dispatch site — check-arch fails the build on a
 * publisher-less member (TC-UI-07). Entry and pause-resume are deliberately NOT actions:
 * they must run inside the click's own gesture task (SRS-COR-51) and must report failure
 * back to the caller, neither of which the void, re-entrancy-deferred dispatch channel can
 * do. They travel on the boot-wired callbacks instead (SRS-UI-3 v1.4).
 */
export type Action =
  | { type: 'skipCorridor' }
  | { type: 'exitRequested' }
  | { type: 'reenterRequested' } // from credits back to gate
  | { type: 'settingsChanged'; patch: Partial<Settings> }
  | { type: 'muteToggled' }
  | { type: 'openSettings' }
  | { type: 'closeSettings' }
  | { type: 'openCredits' }
  | { type: 'closeCredits' }
  | { type: 'noticeRetried'; id: string }
  | { type: 'noticeDismissed'; id: string };
