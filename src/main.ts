// main — bootstrap + the single rAF loop (SRS §3.2 frame pipeline, SRS-SCN-14).
// Wires core (state/input) ↔ scene ↔ audio ↔ ui according to the dependency rules in §2.1.
// v5: the sky cycle (skyCycle) is advanced here and pushed once per frame into the shared
// sky uniforms that the wall screen, floor and ceiling all read; the ambience mix and the
// spill lights follow the same parameters so light and sound stay congruent (조사 K).

import { AudioListener, PerspectiveCamera, Scene } from 'three';
import { store } from './core/store';
import { initCore, sceneMachine } from './core/sceneState';
import { InputSession } from './core/inputSession';
import { createRenderer, isWebGL2Available } from './scene/renderer';
import { buildWorld, EYE_HEIGHT } from './scene/world';
import { Player } from './scene/player';
import { ScreenPlayer } from './scene/screen';
import { QualityController } from './scene/quality';
import { chooseRendition } from './scene/renditionSelect';
import { PRESET_DPR_CAP } from './scene/adaptation';
import { skyParams } from './scene/skyCycle';
import { applySkyParams, createSkyUniforms } from './scene/skyShader';
import { AudioGraph } from './audio/graph';
import { Ambience } from './audio/ambience';
import { gainsForElevation } from './audio/phaseMix';
import { PositionalPool, makeGuideBuffer } from './audio/positional';
import { createGate } from './ui/gate';
import { createSettingsPanel } from './ui/settingsPanel';
import { createPauseMenu } from './ui/pauseMenu';
import { createCredits } from './ui/credits';
import { createUnsupported } from './ui/unsupported';
import { createHud } from './ui/hud';
import { createDebugOverlay } from './ui/debugOverlay';
import { track } from './analytics/track';

const overlay = document.getElementById('overlay')!;
const fadeEl = document.getElementById('fade')!;

const BREATH_PERIOD_S = 10; // 6 breaths per minute — slow, no claims beyond '이완' (FR-90)

function isMobileLike(): boolean {
  return matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches;
}

async function fadeToBlack(): Promise<void> {
  fadeEl.classList.remove('clear');
  await new Promise((r) => setTimeout(r, 700)); // >=0.5s progressive fade (SRS-SCN-23)
}
function fadeIn(): void {
  fadeEl.classList.add('clear');
}

function boot(): void {
  const prefersReducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const settingsStore = initCore(prefersReducedMotion);

  createUnsupported(overlay);
  createCredits(overlay);
  createSettingsPanel(overlay);

  if (!isWebGL2Available() || !InputSession.isSupported() || isMobileLike()) {
    sceneMachine.transition('unsupported');
    fadeIn();
    return;
  }

  // --- scene ---
  const scene = new Scene();
  const camera = new PerspectiveCamera(store.get().settings.fov, innerWidth / innerHeight, 0.1, 200);
  const bundle = createRenderer(scene, camera);
  document.body.prepend(bundle.canvas);
  bundle.canvas.setAttribute('role', 'application');
  bundle.canvas.setAttribute(
    'aria-label',
    '일몰 몰입 홀 3D 공간. 벽 전체가 하늘과 바다로 이어지는 타원의 홀. 이동은 WASD 또는 방향키, 시점은 마우스 또는 Q E R F, 일시정지는 Esc.',
  );

  const sky = createSkyUniforms(0, 0, 0); // metrics are filled in by buildWorld
  const world = buildWorld(scene, sky);
  const player = new Player(camera);
  player.setWalkables(world.walkRegions, world.obstacles);
  player.teleport(world.anchors.spawnCorridor.clone().setY(EYE_HEIGHT), 0);

  const inputSession = new InputSession(bundle.canvas);

  // --- audio (context created suspended; resumed by the gate gesture) ---
  const graph = new AudioGraph();
  const listener = new AudioListener(); // after setContext (SRS-AUD-1 boot order)
  camera.add(listener);
  const ambience = new Ambience(graph);
  const positional = new PositionalPool(graph, listener);

  // Five positional sources on the wall: the sea ahead (audible from the corridor — it
  // leads the walk), lapping water left/right, air behind. All synthesized placeholders.
  const a = world.audioAnchors;
  const hallMax = world.anchors.viewingMaxDistance * 1.5;
  positional.create(a.front, makeGuideBuffer(graph.ctx, 23), { refDistance: 8, maxDistance: 70, level: 0.42 });
  positional.create(a.left, makeGuideBuffer(graph.ctx, 29), { refDistance: 5, maxDistance: hallMax, level: 0.16 });
  positional.create(a.right, makeGuideBuffer(graph.ctx, 31), { refDistance: 5, maxDistance: hallMax, level: 0.16 });
  positional.create(a.backLeft, makeGuideBuffer(graph.ctx, 27), { refDistance: 4, maxDistance: hallMax, level: 0.09 });
  positional.create(a.backRight, makeGuideBuffer(graph.ctx, 33), { refDistance: 4, maxDistance: hallMax, level: 0.09 });

  // --- quality / screen ---
  const qc = new QualityController((preset, scale) => {
    bundle.setPreset(preset, scale);
    // Reflection cost scales with the preset: Low = single tap, no ceiling reflection.
    world.setReflectionQuality(preset === 'high' ? 3 : 1, preset !== 'low');
  });
  const screen = new ScreenPlayer(world.screenSurfaces, world.panorama, world.spillLights, sky, '1080p', {
    preferVideo: new URLSearchParams(location.search).has('video'),
  });

  const pickRendition = () =>
    chooseRendition({
      screenShare: 0.85,
      viewportWidth: innerWidth,
      devicePixelRatio: devicePixelRatio || 1,
      presetDprCap: PRESET_DPR_CAP[qc.preset],
      deviceMemoryGb: (navigator as { deviceMemory?: number }).deviceMemory ?? 4,
      downlinkMbps:
        (navigator as { connection?: { downlink?: number } }).connection?.downlink ?? 10,
      preset: qc.preset,
    });

  // --- loading (procedural world + synth audio => near-instant, still reported honestly) ---
  const markLoaded = (): void => {
    ambience.prepare(); // audio-base
    store.publishSys({
      loadProgress: 1,
      corridorReady: true,
      hallLqReady: true,
      hallHqReady: true,
    });
    track('load_complete', { seconds: performance.now() / 1000 });
  };

  // --- ui ---
  const hud = createHud(overlay, {
    onResumeFromBackground(): void {
      void inputSession.requestLock();
      inputSession.clearBackgroundUnlocked();
    },
    onReenter(): void {
      store.dispatch({ type: 'reenterRequested' });
    },
  });

  createPauseMenu(overlay, {
    onContinue(): void {
      void inputSession.requestLock(); // exitPaused fires on lock success (SRS-COR-32)
    },
    msUntilResumeAllowed: () => inputSession.msUntilResumeAllowed(),
  });

  let enterBusy = false; // guards button spam while the async enter sequence runs
  createGate(overlay, {
    async onEnter(direct: boolean): Promise<void> {
      const s = store.get();
      if (!s.sys.corridorReady || enterBusy) return;
      enterBusy = true;
      try {
        await doEnter(direct, s);
      } finally {
        enterBusy = false;
      }
    },
    onFullscreenToggled: (v) => inputSession.setFullscreenWanted(v),
  });

  async function doEnter(direct: boolean, s: ReturnType<typeof store.get>): Promise<void> {
    const audioOk = await graph.resume();
    if (!audioOk) {
      store.pushNotice({
        id: 'audio-resume',
        kind: 'audio-resume',
        severity: 'toast',
        retryable: true,
        at: Date.now(),
        message: '소리를 켜지 못했어요. 화면을 한 번 더 클릭해 주세요.',
      });
    }
    const locked = await inputSession.requestLock();
    if (!locked) return; // notice pushed by inputSession; stay on gate (§6.1)
    await inputSession.requestFullscreenIfWanted();
    track('enter', { revisit: s.settings.visited });

    sceneMachine.setTransitioning(true);
    await fadeToBlack();
    if (direct && s.settings.visited) {
      player.teleport(world.anchors.spawnHall.clone().setY(EYE_HEIGHT), 0);
      sceneMachine.transition('hall');
    } else {
      // yaw 0 looks down -z — straight into the corridor toward the hall
      player.teleport(world.anchors.spawnCorridor.clone().setY(EYE_HEIGHT), 0);
      sceneMachine.transition('corridor');
    }
    fadeIn();
    sceneMachine.setTransitioning(false);
    player.setEnabled(true);
  }

  const debug = createDebugOverlay(overlay, {
    renderer: bundle.renderer,
    getOnePercentLow: () => qc.onePercentLow,
    getRenderCostMs: () => bundle.getUploadCostMs(),
  });

  // --- state machine hooks: audio mix + screen control (SRS-COR-31, AUD-6) ---
  sceneMachine.onEnter('corridor', () => {
    ambience.start();
    graph.fadeAmbience(0.55, 3.5);
    void screen.load().then(() => {
      // screen keeps paused until hall
    });
  });
  sceneMachine.onEnter('hall', (from) => {
    const p = player.position;
    if (!world.anchors.boundsViewing.containsPoint(p)) {
      player.teleport(world.anchors.spawnHall.clone().setY(EYE_HEIGHT), 0);
    }
    if (from === 'gate') {
      ambience.start();
      void screen.load().then(() => void screen.play());
    } else {
      void screen.play();
    }
    graph.fadeAmbience(1.0, 2.0);
    sceneMachine.markHallReached();
  });
  sceneMachine.onExit('hall', () => screen.pause());
  sceneMachine.onEnter('exiting', () => {
    player.setEnabled(false);
    inputSession.releaseLock();
    graph.fadeAmbience(0.15, 2.5);
  });
  sceneMachine.onEnter('gate', () => {
    player.setEnabled(false);
    graph.fadeAmbience(0, 1.5);
  });

  // --- subscriptions (settings → modules; pause → duck/screen) ---
  store.subscribe(
    (s) => s.settings,
    (settings) => {
      player.applySettings(settings);
      graph.setUserVolume(settings.masterVolume);
      graph.setMuted(settings.muted);
      world.setBgAnimation(settings.bgAnimation);
      settingsStore.save(settings);
    },
  );
  let lastQuality = store.get().settings.quality;
  store.subscribe(
    (s) => s.settings.quality,
    (q) => {
      if (q === lastQuality) return;
      lastQuality = q;
      qc.setManual(q);
      setTimeout(() => {
        const r = pickRendition();
        if (r !== screen.currentRendition) void screen.changeRendition(r);
      }, 100);
    },
  );
  store.subscribe(
    (s) => s.scene.paused,
    (paused) => {
      graph.setDucked(paused);
      bundle.canvas.classList.toggle('paused-blur', paused);
      if (paused) screen.onPause();
      else if (store.get().scene.state === 'hall') void screen.play();
      player.setEnabled(!paused && ['corridor', 'hall'].includes(store.get().scene.state));
    },
  );

  document.addEventListener('visibilitychange', () => {
    // Sound only while viewing (user decision 2026-08-22): gain-only, the context keeps running.
    graph.setHidden(document.visibilityState === 'hidden');
    if (document.visibilityState === 'visible') {
      screen.onVisible(store.get().scene.paused);
      if (graph.ctx.state !== 'running' && store.get().scene.state !== 'gate') {
        void graph.ctx.resume().catch(() => {});
      }
    }
  });

  // Global shortcuts (code-based, IME-guarded)
  document.addEventListener('keydown', (e) => {
    if (e.isComposing || e.keyCode === 229) return;
    if (e.code === 'KeyM' && store.get().scene.state !== 'gate') {
      store.dispatch({ type: 'muteToggled' });
    }
  });

  // prefers-reduced-motion runtime changes (SRS-COR-24)
  const prm = matchMedia('(prefers-reduced-motion: reduce)');
  prm.addEventListener('change', () => {
    const s = store.get().settings;
    if (!s.comfortTouchedByUser) {
      store.dispatch({
        type: 'settingsChanged',
        patch: { comfortProfile: prm.matches ? 'sensitive' : 'normal' },
      });
    }
  });

  // Retry hooks for notices
  sceneMachine.onNoticeRetry('pointer-lock', () => void inputSession.requestLock());
  sceneMachine.onNoticeRetry('audio-resume', () => void graph.resume());
  sceneMachine.onNoticeRetry('audio-closed', () => location.reload());

  // Dwell tracking buckets (FR-80 whitelist)
  const dwellBuckets = [60, 180, 600, 1800];
  let hallEnteredAt = 0;
  let bucketIdx = 0;
  sceneMachine.onEnter('hall', () => {
    hallEnteredAt = performance.now();
    bucketIdx = 0;
  });

  // WebGL context loss (ERR-2)
  bundle.canvas.addEventListener('webglcontextlost', (e) => {
    e.preventDefault();
    store.pushNotice({
      id: 'context-lost',
      kind: 'context-lost',
      severity: 'overlay',
      retryable: true,
      at: Date.now(),
      message: '일시적인 그래픽 문제가 발생했어요. 잠시 후 자동 복구를 시도합니다.',
    });
  });
  bundle.canvas.addEventListener('webglcontextrestored', () => {
    store.removeNotice('context-lost');
  });

  // DEV-only debugging hook (never shipped): lets automated checks drive the state
  // machine without pointer lock (headless/non-composited environments).
  if (import.meta.env.DEV) {
    (window as unknown as Record<string, unknown>).__ih = {
      store,
      machine: sceneMachine,
      screen,
      graph,
      world,
      player,
      forceEnter: (): void => {
        sceneMachine.transition('corridor');
        player.setEnabled(true);
      },
      forceHall: (): void => {
        sceneMachine.transition('corridor');
        player.teleport(world.anchors.spawnHall.clone().setY(EYE_HEIGHT), 0);
        sceneMachine.transition('hall');
        player.setEnabled(true);
      },
      setSkyTime: (t: number): void => {
        skyTime = t;
      },
    };
  }

  // --- boot to gate ---
  markLoaded();
  void qc.detect(store.get().settings.quality).then(() => {
    const r = pickRendition();
    if (r !== screen.currentRendition) void screen.changeRendition(r);
  });
  sceneMachine.transition('gate');
  fadeIn();

  // --- sky cycle state (SRS-VID-8): runs while inside, freezes on pause / gate ---
  let skyTime = 0;
  let motionTime = 0; // shader time, scaled by bgAnimation (never rescaled in-shader)
  let breathPhase = 0;
  let lastMixElev = Number.POSITIVE_INFINITY;

  // --- the single rAF loop (frame pipeline order per SRS §3.2) ---
  let last = performance.now();
  const loop = (): void => {
    requestAnimationFrame(loop);
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.1); // delta clamp (SRS-SCN-14)
    last = now;
    const app = store.get();

    player.update(dt, app); // input → move/collide → camera
    if (player.isMoving) hud.notifyMoved();

    // corridor → hall arrival trigger (SRS-SCN-24)
    if (app.scene.state === 'corridor' && !app.scene.transitioning) {
      if (world.anchors.triggerHallEntry.containsPoint(player.position)) {
        sceneMachine.transition('hall');
      }
    }

    // dwell buckets
    if (app.scene.state === 'hall' && hallEnteredAt > 0 && bucketIdx < dwellBuckets.length) {
      const sec = (now - hallEnteredAt) / 1000;
      const threshold = dwellBuckets[bucketIdx]!;
      if (sec >= threshold) {
        track('dwell', { bucket: `${threshold}s` });
        bucketIdx++;
      }
    }

    // sky cycle → shared uniforms → wall + reflections + spill + ambience mix
    const inside = (app.scene.state === 'corridor' || app.scene.state === 'hall') && !app.scene.paused;
    if (inside) {
      skyTime += dt;
      motionTime += dt * (0.5 + 0.5 * app.settings.bgAnimation);
    }
    const sp = skyParams(skyTime);
    applySkyParams(sky, sp, motionTime);
    if (Math.abs(sp.sunElev - lastMixElev) > 0.4) {
      lastMixElev = sp.sunElev;
      ambience.setGains(gainsForElevation(sp.sunElev), 2.5);
    }
    world.setDustColor(sp.average[0] * 1.2, sp.average[1] * 1.2, sp.average[2] * 1.5);

    // breathing-rhythm floor light (opt-in setting, hall only)
    if (app.settings.breathGuide && app.scene.state === 'hall' && !app.scene.paused) {
      breathPhase += (dt * 2 * Math.PI) / BREATH_PERIOD_S;
      world.setBreath(player.position.x, player.position.z, 0.5 + 0.5 * Math.sin(breathPhase));
    } else {
      world.setBreath(0, 0, 0);
    }

    screen.update(dt, sp.average); // video ramp/gating/spill (uploads merge into render below)
    world.update(dt); // dust motes drift
    qc.tick(dt, app);
    bundle.render(dt);
    debug.frame(dt);
  };
  requestAnimationFrame(loop);
}

boot();
