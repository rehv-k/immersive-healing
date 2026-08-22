# SRS — Immersive Healing (가칭) · 1호 콘텐츠 「일몰」 MVP

> **Software Requirements Specification** · v1.1 (2026-08-22) · 실용형 구현 명세
> 문서 계보: [GOAL](../GOAL.md) → [MRD](../mrd/MRD.md) → [RFP](../rfp/RFP.md) → [PRD](../prd/PRD.md) → **SRS(본 문서)**
> 기술 근거: 조사 [E](../rfp/research/E-browser-ux-constraints.md)·[F](../rfp/research/F-motion-sickness-accessibility.md)·[G](../rfp/research/G-performance-targets-analytics.md)·[H](../prd/research/H-rendering-stack.md)·[I](../prd/research/I-video-delivery-hosting.md)·[J](../prd/research/J-audio-app-architecture.md)
> 코드 조각은 규범적 의사코드다 — 동작·계약이 규범이며, 문장 그대로의 구현을 강제하지 않는다.
>
> **v1.1 개정 ([감사](../audit/AUDIT-2026-08-22.md) 전면 반영)**: 입력 세션 소유자 신설(§3.4)·탭 전환 분기(§3.3)·오류 채널 신설(§4.1) 등 아키텍처 차단 11건 해소 / 렌디션 3종화·선택 규칙 재산정 / 적응 임계 45/55 정렬·프리셋 상향 수동화 / 상태 머신 보완(unsupported·corridor→exiting·transitioning) / 볼륨 3버스 분리 / GLB 명명 규약 / 오류 6종 추가 / 라이선스 SPDX 허용목록 / 메모리 예산·웹폰트 정책 신설 / M0a·M0b 분할 / 분석 도구 미정 처리 / 추적성 매트릭스 전수 재작성 / stale 근거 정정(three.js #15422 종결 반영 등).

---

## 1. 개요

### 1.1 목적·범위

1호 콘텐츠 「일몰」 MVP의 소프트웨어를 구현 가능한 수준으로 명세한다. M0 검증 절차(§9)를 포함한다. 아트 디렉션(공간의 구체적 형태·재질)은 M1 산출물로, 본 문서는 아트가 만족해야 할 기술 제약(§3.5의 명명 규약·보행 거리, §8의 예산)을 명세한다. **개발·검증은 로컬 우선 — 클라우드 배포는 배포 준비 단계로 이월** (감사 D4).

### 1.2 요구사항 ID 체계

`SRS-<모듈>-<번호>`. 모듈 코드: COR(core) / SCN(scene) / VID(video) / AUD(audio) / UI / QLT(quality) / ANL(analytics) / ERR(오류) / DEP(배포). 등급 **[필수]**/**[권장]**, PRD 출처(FR/NFR) 병기.

### 1.3 확정·미정 사항 (v1.1 갱신)

| 항목 | 상태 |
|---|---|
| 일시정지 중 오디오 | **확정**: 마스터 덕킹 버스를 35%로 1.0초 램프, 복귀 시 복원 (PRD FR-61 해소) |
| 분석 도구 | **미정 — 공개 시점 결정** (우선 후보 Umami Cloud 무료 티어. 셀프호스팅은 "무료·정적" 방침과 충돌해 비권고 — 감사 D2). 이벤트 스키마(§3.11)는 도구 중립으로 유지, 훅만 M2에 no-op |
| 렌디션 | **3종(720p/1080p/1440p), 2160p 삭제, 파일 ≤400MB** (감사 D3) |
| M0 | **M0a(현 PC 로컬) / M0b(하한 실기 확보 후)** 분할. M0b 전 스택 "최종 확정" 보류 (감사 D1) |
| 성능-품질 충돌 시 양보 순서 | **화질 → 공간 장식 → fps 목표** (감사 D5) |

### 1.4 용어

PRD §1.4 승계. 추가: **버스(bus)** = GainNode 믹서 채널. **렌디션** = 해상도별 인코딩본. **프리셋** = 품질 3단. **입력 세션** = Pointer Lock·전체화면·가시성의 생명주기를 관리하는 core 소유 단위(§3.4).

---

## 2. 시스템 개요

### 2.1 아키텍처

```
┌──────────────────────────── 브라우저 (데스크톱, WebGL2) ────────────────────────────┐
│                                                                                     │
│  ui/  (DOM 오버레이)           core/                          scene/  (three.js)     │
│  ┌──────────────┐   액션 발행  ┌────────────────────┐  구독   ┌──────────────────┐  │
│  │ gate         │ ───────────► │ store (pub/sub)    │ ──────► │ renderer/composer │  │
│  │ settingsPanel│              │ settings           │         │ world (hall/corr) │  │
│  │ pauseMenu    │ ◄─────────── │ sceneState (전이)   │ ◄────── │ player            │  │
│  │ credits      │   구독       │ inputSession ★v1.1 │  sys.*  │ screen (video)    │  │
│  │ unsupported  │              └───────┬────────────┘  발행   │ quality (adapt)   │  │
│  │ debugOverlay │                      │ onEnter/onExit       └──────────────────┘  │
│  └──────────────┘                      ▼                                             │
│                              audio/  (Web Audio)               analytics/ (no-op)    │
│                              ┌────────────────────┐           ┌────────────┐        │
│                              │ graph (3단 버스)     │           │ track(ev)  │        │
│                              │ ambience/positional │           └────────────┘        │
│                              │ scheduler (ctx시계)  │                                 │
│                              └────────────────────┘                                  │
│   ★ core는 브라우저 API(Pointer Lock·Fullscreen·visibility·localStorage)를 직접      │
│     소유하는 제3의 축이다 — ui·scene 어느 쪽도 이 API를 직접 호출하지 않는다 (v1.1)   │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

**의존 규칙 [필수]** (v1.1 정밀화 — 감사 B1 해소):
1. `ui/`는 store에 **액션만 발행**(§4.2), 상태를 구독해 표시한다. `scene/`·`audio/`를 import하지 않는다.
2. `scene/`·`audio/`는 store를 구독하고, **`sys.*` 네임스페이스에만** 관측값·오류를 발행한다(§4.1). `ui/`를 import하지 않는다.
3. **상태 전이(`scene.state`, `paused`)의 유일한 writer는 `core/`다.** ui의 액션과 `core/inputSession`의 브라우저 이벤트가 core 내부에서 전이로 변환된다.
4. 위반은 ESLint `no-restricted-imports` + `store.set`의 core 내부 캡슐화로 **기계적으로 강제**한다(§9.3 — "자기 점검"에서 격상, 감사 §9.2 지적).

### 2.2 기술 스택 (잠정 — M0b 게이트)

| 영역 | 확정 | 버전 정책 |
|---|---|---|
| 렌더링 | three.js **r185** + `WebGLRenderer`(WebGL2) | **정확 버전 고정(`0.185.1`) + lockfile** (v1.1 — "0.185.x" 범위 표기 정정). **주의: 핀 고정의 실질 이유는 postprocessing의 peer 상한 `<0.186.0`** — three 업그레이드는 postprocessing peer range가 열린 뒤에만 수행, 분기 1회 의존성 점검 (감사 A2) |
| 후처리 | `postprocessing`(pmndrs) 6.x | 최신 6.x 핀. SMAA 내장 룩업 텍스처의 번들 포함분을 NFR-8 예산에 계상 |
| 언어·빌드 | TypeScript strict + Vite | `assetsInlineLimit: 0` |
| 상태 | 자체 초소형 pub/sub (~50줄, §3.1 계약) 또는 nanostores(~1KB, 허용 — v1.1 명시) | React/R3F/XState/Howler 미도입 |
| 오디오 | three.js `AudioListener`/`PositionalAudio` + 자체 GainNode 버스(§3.9) | — |
| GPU 감지 | detect-gpu (§8.2 — 번들 예산 계상, 미판정 폴백 필수) | — |
| 분석 | **미정** (§1.3) | 훅만 no-op |

### 2.3 디렉터리 구조 [권장]

```
src/
  main.ts               # 부트스트랩, rAF 루프 소유(유일), 프레임 파이프라인(§3.2)
  core/
    store.ts            # pub/sub (§3.1)
    settings.ts         # localStorage (§3.6)
    sceneState.ts       # 상태 머신 (§3.3)
    inputSession.ts     # ★v1.1 Pointer Lock·Fullscreen·visibility 소유 (§3.4)
  scene/
    renderer.ts  world.ts  player.ts  screen.ts  quality.ts
  audio/
    graph.ts  ambience.ts  positional.ts  scheduler.ts
  ui/
    gate.ts  settingsPanel.ts  pauseMenu.ts  credits.ts  unsupported.ts
    debugOverlay.ts     # ★v1.1 소유 명시 (§8.6)
  analytics/track.ts    # no-op 훅
  data/credits.json  data/manifest.json
scripts/
  encode.mjs  upload.mjs # ★v1.1 .sh→.mjs (Windows 환경 크로스 플랫폼 — 감사 B8)
```

### 2.4 빌드·배포 (SRS-DEP)

- **SRS-DEP-1 [필수]** 로컬 개발: `vite dev`. 배포(배포 준비 단계): 사이트=Cloudflare Pages, 미디어=R2 커스텀 도메인(r2.dev 금지). **배포 실행은 M3 전으로 이월하되 설계는 본 절을 따른다** (감사 D4).
- **SRS-DEP-2 [필수]** R2 객체: `Cache-Control: public, max-age=31536000, immutable` + 파일명 콘텐츠 해시. **CORS 허용 오리진 = 프로덕션 도메인 + `*.pages.dev`(프리뷰) + `http://localhost:5173`** (v1.1 — 단일 오리진이면 프리뷰·로컬 전멸, 감사 M6). 압축 포맷 재압축 금지. **파일 크기 ≤400MB** (512MB 캐시 상한 마진 — §5.5).
- **SRS-DEP-3 [필수]** 인코딩·업로드는 `scripts/encode.mjs`(FFmpeg 배치, §5.5)·`scripts/upload.mjs`(wrangler/rclone)로 재현 가능.
- **SRS-DEP-4 [필수]** HTTPS 전제. JS 번들 gzip ≤ 300KB (NFR-8) — **빌드 스크립트 필수 게이트**(경계값 300KB는 합격 — v1.1 통일, PRD V11도 ≤로 정정).

---

## 3. 코어 명세

### 3.1 core/store (SRS-COR-1x)

- **SRS-COR-10 [필수]** 상태는 §4.1 `AppState` 단일 트리. API: `get()`, `dispatch(action)`(ui용), `publishSys(partial)`(scene/audio용), `subscribe(selector, cb, { immediate })`.
  - **초기 스냅샷 [필수]** (v1.1 — 감사 S3): `immediate: true`(기본값) 구독은 등록 시 현재 값으로 1회 동기 호출된다 — 늦게 생성되는 scene/audio 모듈이 게이트에서 변경된 설정을 놓치지 않는 근거.
  - **재진입 처리 [필수]** (v1.1 — 감사 S2): 통지 중 발생한 `dispatch`/`publishSys`는 **마이크로태스크 큐에 적재 후 순차 플러시**(깊이 상한 8, 초과 시 개발 모드 throw). "다음 프레임 예약"은 rAF가 아닌 `queueMicrotask`로 — **오디오 관련 지연 작업은 rAF에 올리지 않는다**(백그라운드 정지).
- **SRS-COR-11 [필수]** writer 권한: `ui/` → `dispatch`만. `scene/`·`audio/` → `publishSys`만(`sys.*` 한정 — 관측값과 `sys.notices` 포함). **상태 전이·설정 변경의 실제 write는 core 내부 전용.**

### 3.2 프레임 파이프라인 (SRS-COR-40, v1.1 신설 — 감사 S1)

- **SRS-COR-40 [필수]** rAF 콜백 내 갱신 순서(고정):
  1. `delta = min(clock.getDelta(), 0.1)`
  2. 입력 샘플링(키 상태·마우스 누적 델타 소비)
  3. 상태 머신·전이 연출 tick
  4. 플레이어 이동·충돌 → 카메라 트랜스폼 확정
  5. `AudioListener`·panner 위치 갱신 (카메라 확정 **후** — 1프레임 지연 방지)
  6. 비디오 텍스처 플래그 반영(rVFC가 세운 `needsUpdate` — 업로드는 이 render 1회로 병합, 한 프레임에 rVFC 2회면 마지막만 유효)
  7. `composer.render()`
  8. `publishSys`(fps 등 관측값)
- 오디오 스케줄링은 이 파이프라인과 **독립** — 항상 `ctx.currentTime` 기준(§3.10).

### 3.3 core/sceneState (SRS-COR-3x)

- **SRS-COR-30 [필수]** 상태·전이표 (v1.1 — unsupported 타입 편입·corridor→exiting 추가, 감사 B4·S6):

```ts
type SceneState = 'boot' | 'unsupported' | 'gate' | 'corridor' | 'hall' | 'exiting';
interface SceneSlice {
  state: SceneState;
  paused: boolean;            // 오버레이 플래그 — corridor·hall에서만 진입 가능
  pausedFrom: SceneState | null;
  transitioning: boolean;     // v1.1 — 전이 연출 중 (입력·새 전이 요청 폐기)
}
```

| 현재 | 허용 전이 | 트리거 |
|---|---|---|
| boot | gate / unsupported | 초기화 완료 / 미지원 감지 |
| unsupported | (터미널 — 전이 없음) | — |
| gate | corridor / hall | 입장하기 / (재방문) 바로 입장 — hall 직행 조건은 §5.4 |
| corridor | hall / **exiting** | 도달 트리거 통과(§3.5) 또는 스킵 / 나가기(v1.1 추가) |
| hall | exiting | 나가기 |
| exiting | gate | 페이드아웃 완료 → 크레딧 화면 → 재입장 |

허용 외 전이는 폐기 + 개발 모드 경고. `transitioning === true` 동안 새 전이 요청은 **큐잉하지 않고 폐기**(스킵 연타 방어).
- **SRS-COR-31 [필수]** 각 상태 onEnter/onExit: 오디오 믹스 크로스페이드(§3.10), 시각 페이드(≥0.5초), 분석 훅. 크레딧은 상태가 아니라 **`ui.creditsOpen` 오버레이**(v1.1 — exiting과 분리, 감사 S6d).
- **SRS-COR-32 [필수]** `paused` 규칙 (v1.1 전면 개정 — 감사 B1·B2·S5·S6):
  - 진입: `inputSession`(§3.4)이 보고하는 **가시 상태에서의 Pointer Lock 해제**만이 진입 트리거이며, `state ∈ {corridor, hall}` 일 때만 성립. gate·exiting에서의 잠금 해제는 무시.
  - **탭 전환 분기**: `visibilityState === 'hidden'` 중의 잠금 해제는 paused로 **취급하지 않는다** — 오디오 볼륨 유지, `sys.backgroundUnlocked = true`만 기록. 복귀 시 전체 메뉴가 아닌 **"클릭하여 시점 복귀" 최소 프롬프트**만 표시, 클릭 시 재잠금. ("켜두는 힐링" MR-12 보전)
  - 가시 상태 해제(진짜 Esc·다른 창 클릭·OS 알림 포함 — 포커스 상실도 의도적으로 동일 취급, v1.1 명시): paused 진입 → 일시정지 메뉴. "계속"은 1.5초 후 활성(재잠금 쿨다운 흡수).
  - **전체화면-잠금 불일치 정규화**: `fullscreenchange`로 전체화면이 해제됐는데 `pointerLockElement`가 남아 있으면 core가 `exitPointerLock()`을 호출해 paused로 정규화 — 앱 주도 해제이므로 1.5초 쿨다운 면제.

### 3.4 core/inputSession (SRS-COR-5x, v1.1 신설 — 감사 B1 해소)

- **SRS-COR-50 [필수]** Pointer Lock·Fullscreen·visibility의 **모든 브라우저 API 호출과 이벤트 수신은 이 모듈 전유**: `requestPointerLock`/`exitPointerLock`/`pointerlockchange`/`pointerlockerror`/`requestFullscreen`/`fullscreenchange`/`visibilitychange`. ui는 `enterRequested`·`pauseResume` 액션만 발행하고, scene/player는 `sys.pointerLocked`를 read-only 소비한다.
- **SRS-COR-51 [필수]** 잠금 요청 계약 (감사 S4): `requestPointerLock({ unadjustedMovement: true })` 시도 → reject/미지원 시 옵션 없이 **2단 폴백**. 성공 판정은 `pointerlockchange` 이벤트 기준(Promise 지원 여부 브라우저 편차 흡수). 요청은 반드시 사용자 제스처 핸들러 문맥에서.
- **SRS-COR-52 [필수]** 전체화면은 게이트의 별도 토글(기본 꺼짐)로, 같은 클릭 제스처 안에서 **포인터락 → 전체화면 순서**로 호출. `fullscreenerror`는 무해 처리(경험 성립에 비필수). Keyboard Lock API는 **미도입**(v1.1 명시 — Firefox 미지원, RFP §4.1-5의 처분 기록).

### 3.5 scene/world (SRS-SCN-2x)

- **SRS-SCN-20 [필수]** 복도·상영관은 GLB(Draco/Meshopt)+KTX2. **입장 가능 조건 = `corridor-min` + `audio-base` 로드 완료** (v1.1 — 오디오 포함으로 상향: "소리가 먼저 들린다" 연출은 오디오 없이는 성립 불가, 감사 D2). `audio-extra`만 지연 허용.
- **SRS-SCN-21 [필수]** `hall-hq`는 복도 체류 중 백그라운드 로드. 미완료 도달 시 **`hall-lq` 폴백**(§5.4에 그룹 신설, 예산 ≤3MB) 표시 후 완료 시 페이드 스왑.
- **SRS-SCN-22 [필수]** 이동 영역은 충돌 볼륨(캡슐 vs 단순 볼륨, 슬라이드 처리). 벽·스크린 관통 불가, 끼임 방지.
- **SRS-SCN-23 [필수]** 광과민 안전: 1초 3회 초과 휘도 반전 없음, 전환 전부 페이드 ≥0.5초, 포화 적색 전면 전환 금지.
- **SRS-SCN-24 [필수]** (v1.1 신설 — 감사 B8) **GLB 명명 규약**: 아트 에셋은 다음 노드를 포함해야 하며 로더가 추출·검증, 부재 시 부트 실패 —
  - `SPAWN_corridor` / `SPAWN_hall`: 카메라 초기 위치+방향. 스킵(FR-23)의 목적지는 `SPAWN_hall`.
  - `TRIGGER_hallEntry`: 통과 시 `corridor→hall` 전이를 발생시키는 박스 볼륨 — "도보 도달"의 정의.
  - `BOUNDS_viewing`: 관람 영역 — 정위 음원 `maxDistance` 산출 기준(§3.9).
  - **복도 유효 보행 거리 = 도보 20~40초 × 이동속도 '보통'(1.6 m/s) ≈ 32~64m** — 아트가 만족해야 할 제약(PRD FR-22의 SRS 이관, 감사 M-3).

### 3.6 core/settings (SRS-COR-2x)

- **SRS-COR-20 [필수]** localStorage 단일 키 `ih:settings:v1`, `schemaVersion: 1`.
- **SRS-COR-21 [필수]** 필드·검증·물리량 매핑 (v1.1 — 매핑 열 추가, comfortProfile 유니온화, custom 키맵 MVP 제외):

| 필드 | 타입·범위 | 기본값 | 물리량 매핑 |
|---|---|---|---|
| `fov` | clamp 60~100 | 90 | 도(°) — camera.fov |
| `moveSpeed` | `'slow'\|'normal'\|'fast'` | `'normal'` | 1.0 / 1.6 / 2.4 m/s |
| `sensitivityX/Y` | clamp 0.1~3.0 | 1.0 | 1.0 = **0.002 rad/px** (기준 계수) |
| `invertY` | boolean | false | — |
| `headBob` | clamp 0~1 | **0** | 1.0 = 진폭 0.03m·보행 주기 동기 |
| `cameraExtras` | boolean | **false** | 셰이크·부가 모션 온오프 |
| `motionBlur` | boolean | **false** | — |
| `mouseSmoothing` | boolean | **false** | true = 3프레임 이동평균 (v1.1 동작 정의) |
| `bgAnimation` | clamp 0~1 | 0.6 | `유효값 = min(설정값, 프리셋 상한)` (v1.1 결합 공식) |
| `quality` | `'auto'\|'low'\|'med'\|'high'` | `'auto'` | — |
| `masterVolume` | clamp 0~1 | 0.8 | 사용자 볼륨 버스 게인 |
| `muted` | boolean | false | — |
| `keyLayout` | `'wasd'\|'arrows'` | `'wasd'` | **`'custom'` 리매핑은 MVP 범위 외**(v1.1 — 감사 S8: UI·검증 비용 대비 과잉. 방향키 상시 병행으로 R-15 프리셋 요구 충족) |
| `comfortProfile` | `'sensitive'\|'normal'\|'custom'` | PRM 감지 시 `'sensitive'` | v1.1 유니온화 (감사 B7) |
| `comfortTouchedByUser` | boolean | false | v1.1 — OS 변경이 사용자 선택을 덮지 않는 근거 필드 |
| `visited` | boolean | false | **hall 최초 도달 시 즉시 동기 기록**(디바운스 우회 — v1.1, 감사 S9) |

파싱 실패·NaN·타입 불일치는 **필드 단위** 기본값 폴백.
- **SRS-COR-22 [필수]** 쓰기 디바운스 300ms + **`pagehide`/`visibilitychange:hidden`에서 보류 쓰기 즉시 플러시**(v1.1). try/catch 인메모리 폴백. 저장 차단 환경에서는 매 방문이 첫 방문 경로가 됨을 전제(로딩 전략 최악 경로).
- **SRS-COR-23 [필수]** `'sensitive'` 강제 효과: headBob 0, cameraExtras/motionBlur/mouseSmoothing false, bgAnimation ≤0.3, 자동 카메라 연출 비활성. 저감 항목 중 하나라도 프로필 값과 불일치하게 사용자가 수정하면 `'custom'` + `comfortTouchedByUser=true`.
- **SRS-COR-24 [필수]** `prefers-reduced-motion` change 리스너로 런타임 반영 — 단 `comfortTouchedByUser === true`면 자동 변경하지 않고 알림만.

---

## 3B. 씬·비디오·오디오·UI 명세

### 3.7 scene/renderer·player (SRS-SCN-1x·3x)

- **SRS-SCN-10 [필수]** `WebGLRenderer({ antialias: false, powerPreference: 'high-performance' })`, `outputColorSpace = SRGBColorSpace`, `ColorManagement.enabled = true`.
- **SRS-SCN-11 [필수]** 톤매핑은 파이프라인 말단 1회(렌더러 `NoToneMapping` + `ToneMappingEffect(ACES_FILMIC)`). 비디오 텍스처 `colorSpace = SRGBColorSpace`, 스크린 머티리얼 unlit — 이중 톤매핑 금지(M0a V8 검증).
- **SRS-SCN-12 [필수]** 후처리 체인(High): `RenderPass → 스크린 한정 블룸 → LUT3D → ToneMapping → SMAA` 단일 EffectPass 머지. 스크린 한정 블룸은 SelectiveBloom **또는 휘도 임계 기반 등가 구현**(발광 스크린만 임계를 통과하도록 설계 — 구현이 채택, 코드 역반영 2026-08-22) 중 택일. 프리셋별 §8.1.
- **SRS-SCN-13 [필수]** `RectAreaLight` 실사용 금지. 스필 라이트: 영상 평균색 샘플링 → PointLight/SpotLight 2~3개 구동 + 베이크 라이트맵. 샘플링 경로는 GPU 다운샘플+fence 비동기 읽기 **또는 2×2 캔버스 CPU 샘플(주기 ≥250ms) 등가 구현**(구현이 채택 — CORS 오염 감지 ERR-10을 겸함, 코드 역반영 2026-08-22) 중 택일.
- **SRS-SCN-14 [필수]** rAF 루프는 `main.ts` 단일 소유, §3.2 파이프라인 준수.
- **SRS-SCN-30 [필수]** 입력은 `KeyboardEvent.code`. `KeyW/A/S/D` + 방향키 상시 병행. 핸들러 선두 `if (e.isComposing || e.keyCode === 229) return;`.
- **SRS-SCN-31 [필수]** 시점: Pointer Lock `movementX/Y × 0.002 rad/px × sensitivity`, `invertY` 적용, 스무딩 기본 없음(원델타 직결). 키보드 시점 회전 **수평 `KeyQ/KeyE` + 수직 `KeyR/KeyF`**(v1.1 — 수직 수단 추가, WCAG 2.1.1·감사 M-8) 상시 제공, 회전 속도 90°/s.
- **SRS-SCN-32 [필수]** 이동: 등속 + **입력 램프 ≤80ms**(시작·정지 시 짧은 스무딩 — R-2 v1.2 재정의 반영). 속도 3단 = 1.0/1.6/2.4 m/s [M0a 체감 튜닝 허용]. `headBob > 0`일 때만 진폭 적용.
- **SRS-SCN-33 [필수]** FOV 즉시 반영, 자동 FOV 연출 금지.

### 3.8 scene/screen — 비디오 (SRS-VID)

- **SRS-VID-1 [필수]** 렌디션 선택(로드 시 1회, v1.1 — 3종·임계 재산정, 감사 F-5):

```
pw = 스크린의 예상 화면 픽셀 폭
   = 스크린 시야 점유율 × viewportWidth × min(devicePixelRatio, 프리셋 DPR 상한)
규칙: 기본 '1080p'
  downlink < 6                             → '720p'
  pw > 1400 ∧ mem ≥ 8 ∧ downlink > 25      → '1440p'   // 1080p 모니터에서도 도달 가능
프리셋 상한: Low ≤1080p, Med·High ≤1440p
```
(`cores ≥ 8` 조건 삭제 — 4코어 데스크톱 배제 문제. `deviceMemory` 미지원 시 4 가정.) 이후 재생 중 자동 전환 없음. **자동 프리셋 하향은 렌디션에 영향을 주지 않는다**(초기 선택 시에만 상한 적용 — v1.1 정책 확정, 감사 D1). 수동 프리셋 변경 시에만 재로드(§6.5).
- **SRS-VID-2 [필수]** `<video muted playsinline preload="auto" crossorigin="anonymous">`, `loop` 속성은 **영구 false**(스왑 로직이 루프 소유). 영상에 오디오 트랙 없음.
- **SRS-VID-3 [필수]** 이중 A/B 스왑: B 사전 워밍업(`play()→pause()`). **트리거 여유 0.5s, uMix 램프 0.25s 고정**(v1.1 — 램프≤여유×60% 규범, 감사 D9). 마스터의 루프-세이프 크로스페이드 구간(마지막 1.0~0.5s)과 셰이더 램프 구간(0.5~0.25s)은 **겹치지 않게**(이중 디졸브 방지). 스왑 설계의 최종형은 M0a V15 결과로 확정(캐시 미공유 시 Blob URL 단일 다운로드 공유 등 대안 검토).
- **SRS-VID-4 [필수]** 텍스처 갱신은 rVFC 게이팅. **rVFC 폴백**(v1.1 — 감사 S7): `'requestVideoFrameCallback' in HTMLVideoElement.prototype` 부재 시 rAF에서 `video.currentTime` 변화 감지로 게이팅 + 프리셋 1단 하향.
- **SRS-VID-5 [필수]** paused 오버레이·복도에서 `pause()` + 갱신 중단. 탭 복귀 시 `!userPaused && video.paused → play()`. (근거: PRD FR-34, 조사 G — v1.1 인용 정정)
- **SRS-VID-6 [필수]** 재생 실패(`error`/`stalled` 5초): **계단식 폴백 최대 3단(720p까지)**, 실패 렌디션은 세션 내 블랙리스트(v1.1 — 감사 S7). 최종 실패 시 ERR-4 흐름.
- **SRS-VID-7 [필수]** (v1.1 신설 — 감사 B10·B11) 스왑 경계 규칙:
  - 램프 중 paused 진입 → **램프 즉시 완료 처리**(uMix=1, 역할 교대 확정) 후 pause. 복귀는 신 A에서 재개.
  - 탭 복귀 시 `A.ended || A.currentTime ≥ duration−0.05` → 강제 리셋(`currentTime=0; play(); uMix=0`).
  - rVFC 1초 이상 미도래 → 워치독이 스왑 상태 리셋.
  - B 미준비 폴백: `A.ended` 이벤트에서 `A.currentTime=0; A.play()` **하드컷 1회 + 경고 로그** (`loop` 속성 사용 금지 — VID-2와 정합).

### 3.9 audio (SRS-AUD)

- **SRS-AUD-1 [필수]** 그래프·소유권 (v1.1 — 배선·컨텍스트 규범화, 감사 B5·B6):

```
[ambience N] ─► ambienceBus ─┐
[positional ≤8] ─► spatialBus ─┼─► userVolumeBus ─► duckBus ─► muteBus ─► ctx.destination
[UI음(선택)] ─► uiBus ────────┘      (masterVolume)   (pause 0.35)  (0/1)
```
  - **부트 순서 [필수]**: `audio/graph.ts`가 `AudioContext` 생성 → **`THREE.AudioContext.setContext(ctx)`를 `AudioListener` 생성 전에 호출** → 버스 구성. 컨텍스트 이원화 금지(노드 연결 시 InvalidAccessError).
  - **재배선 [필수]**: `PositionalAudio`/`Audio` 생성 직후 `sound.gain.disconnect(); sound.gain.connect(해당 버스)` — three.js는 기본으로 리스너 입력에 직결하므로.
  - `AudioListener.setMasterVolume()`·three `Audio.setVolume()` 사용 금지(버스 우회 + 0.01s 고정 시간상수).
  - **볼륨 3버스 분리**로 각 소스(설정·일시정지·음소거)는 자기 버스만 램프 — 결합 충돌 원천 차단. 일시정지 중 볼륨 슬라이더는 userVolumeBus만 변경(덕킹 유지).
- **SRS-AUD-2 [필수]** 페이드: `setValueAtTime(현재값, now)` → `linearRampToValueAtTime`. 등파워는 `setValueCurveAtTime` cos/sin. `gain.value` 직접 대입 금지. 모든 예약은 `ctx.currentTime` 기준.
- **SRS-AUD-3 [필수]** 앰비언스: 스테레오 베이스(30~90초) + 보조 레이어 2~3(다른 길이·오프셋), OGG Vorbis/Opus → `AudioBufferSourceNode(loop=true)`. MP3·MediaElementSource·5분급 통짜 버퍼 금지. **루프 길이·레이어 주기는 "상영관 도달 후 2분 내 감상 사이클 1회 완결"(PRD FR-37)을 만족하도록 설계**(v1.1).
- **SRS-AUD-4 [필수]** 정위 음원: 모노, `panner.distanceModel='linear'` 명시, `refDistance 4~8m`(v1.1 단위 명시), `rolloffFactor 1`. `maxDistance`는 **씬별 분리**(v1.1 — 감사 F 지적): 상영관 음원 = `BOUNDS_viewing` 최대 도달 거리 × 1.5, 복도 유도 음원 = 복도 길이 기준 별도 설정. 동시 활성 ≤8. 음원은 상시 재생 + 개별 GainNode 0 램프로 소거 — **근거(v1.1 정정): HRTF 컨볼루션 노드 생성/파괴 비용 회피**(구 근거였던 three.js #15422는 2018년 종결·수정이 upstream에 있음 — `isPlaying` 가드는 three.js가 이미 수행하므로 중복 요구 삭제).
- **SRS-AUD-5 [필수]** 일시정지: `fadeTo(duckBus, 0.35, 1.0)` / 해제 `fadeTo(duckBus, 1.0, 1.0)`. 음소거: muteBus 0/1, 0.15초 램프.
- **SRS-AUD-6 [필수]** 씬 믹스: gate→corridor 앰비언스 페이드 인 2~4초 + 유도 정위 음원 시작, corridor→hall 전체 사운드스케이프 크로스페이드 ~2초. 상태 머신 훅에서 트리거.
- **SRS-AUD-7 [필수]** **[변경 2026-08-22 — 사용자 결정, 코드 역반영]** 소리는 탭이 보일 때만: 버스 체인 말단에 `visibilityBus`를 추가하고 `visibilitychange`에서 **게인만** 페이드(숨김 0.25초→0, 복귀 0.6초→1). `suspend()` 호출은 여전히 금지(클럭·스케줄 유지 목적은 불변). `ctx.onstatechange` — `'suspended'`는 다음 사용자 제스처에서 resume, **`'closed'`는 그래프 전체 재구성**. 게이트 클릭에서 최초 resume.
- **SRS-AUD-8 [필수]** (v1.1 — [권장]에서 승격) `audio-base`(앰비언스 베이스+유도 음원)는 입장 가능 조건에 포함(§3.5 SCN-20).

### 3.10 ui (SRS-UI)

- **SRS-UI-1 [필수]** DOM 오버레이. 루트 `pointer-events: none` + **비활성 패널에 `inert` 속성**(v1.1 — Tab 포커스 유출 방지, 감사 S10). WebGL 내 텍스트 금지. **상영관 상태에서 DOM 오버레이는 전부 비표시**(일시정지·최소 프롬프트 제외 — v1.1, PRD FR-36 이관).
- **SRS-UI-2 [필수]** 게이트: 제목·소개 / 헤드폰 안내 / **광과민성·멀미 사전 고지 1줄** / "입장하기"(§3.5 조건 충족 시 활성) / 편안한 관람 2택 / 설정·크레딧 / 재방문 "바로 상영관"(§5.4 hall-lq 조건) / 3초 초과 시 실측 % 진행률. **문구는 PRD FR-90 표현 제약 준수**(치유·효능 주장 금지 — v1.1).
- **SRS-UI-3 [필수]** "입장하기" 클릭: `enterRequested` 액션 발행 → **core(inputSession)가** resume·포인터락·(토글 시) 전체화면 처리(§3.4 — v1.1 소유권 정리).
- **SRS-UI-4 [필수]** 일시정지 메뉴: 반투명+씬 흐림(스크린은 정지 프레임 — 의도된 동작, v1.1 명시), 계속(1.5s 후 활성)/설정/크레딧/나가기. **포커스 트랩 + 닫힘 시 포커스 복원**(v1.1). `:focus-visible`·대비 AA.
- **SRS-UI-5 [필수]** 설정 패널: §3.6 항목. 즉시 반영 + 디바운스 저장. 게이트·일시정지 공용.
- **SRS-UI-6 [필수]** 크레딧: `credits.json` 단일 소스 렌더(CC-BY 형식 준수) + **오픈소스 고지(three.js MIT, postprocessing Zlib 등 — `kind:'tool'` 활용)** + 분석 고지(도입 시). 문구 FR-90 준수.
- **SRS-UI-7 [필수]** unsupported: 대표 이미지 + 데스크톱 안내 + 링크 복사.
- **SRS-UI-8 [필수]** 복도 조작 안내: 아이콘 병기, 입력 감지 시 페이드 아웃, 스킵 버튼 상시.
- **SRS-UI-9 [필수]** 캔버스 접근성 (v1.1 정정 — 감사 S10): `role="application"` + `aria-label`(경험 설명·조작 요약) — 인터랙티브 표면이므로 `img` 부적절.
- **SRS-UI-10 [필수]** (v1.1 신설) **웹폰트 정책**: 기본은 **시스템 폰트 스택**(한글 웹폰트 미사용 — 서브셋 없는 한글 폰트는 수 MB로 NFR-5를 단독으로 깰 수 있음, 감사 공백 E). 브랜드 폰트 도입 시 서브셋 WOFF2 ≤150KB + `font-display: swap` 조건.

### 3.11 analytics (SRS-ANL)

- **SRS-ANL-1 [분석 도입 시 필수]** (v1.1 — 등급 조건부화, 도구 미정) 도구는 공개 시점 결정(§1.3). M2에서는 `track()` no-op 훅만. 요건: 쿠키·영구 식별자 없음, 동의 배너 불필요, 스크립트는 자체 또는 신뢰 도메인.
- **SRS-ANL-2 [분석 도입 시 필수]** 이벤트 스키마 (v1.1 — PRD FR-80 화이트리스트와 동기화, `comfort` 제거):

| 이벤트 | 페이로드 | 발행 지점 |
|---|---|---|
| `load_complete` | `{ seconds }` | 입장 가능 조건 충족 |
| `enter` | `{ revisit: boolean }` | 입장하기 클릭 |
| `corridor_skip` | — | 스킵 |
| `hall_reached` | `{ secondsFromEnter }` | 상영관 도달 |
| `dwell` | `{ bucket }` | 체류 구간 통과 |
| `exit` | `{ from: SceneState, totalSeconds }` | 나가기·`pagehide`(**`sendBeacon` 필수** — v1.1) |
| `quality` | `{ preset, renderScale, rendition, avgFps }` | hall 도달 60초 후 1회 |
| `error` | `{ kind: ErrKind }` | §7 오류 |

- **SRS-ANL-3 [분석 도입 시 필수]** IP 원본·정밀 위치·식별자 저장 금지. 서버/CDN 로그 IP 마스킹 또는 7일 파기 정책 문서화.

---

## 4. 인터페이스 명세

### 4.1 스토어 상태 (v1.1 — notices·ui·transitioning·fps 이원화 추가)

```ts
type ErrKind = 'webgl-unsupported' | 'context-lost' | 'audio-resume' | 'asset-load'
             | 'video-play' | 'storage' | 'pointer-lock' | 'manifest' | 'audio-decode' | 'video-cors';

interface AppState {
  scene: SceneSlice;                       // §3.3 — state, paused, pausedFrom, transitioning
  ui: { settingsOpen: boolean; creditsOpen: boolean };   // v1.1 신설
  settings: Settings;                      // §3.6
  sys: {
    loadProgress: number;                  // corridor-min + audio-base 바이트 가중 (§5.4 정책)
    hallProgress: number;                  // hall-hq 백그라운드 진행률 (분리 — v1.1)
    corridorReady: boolean; hallLqReady: boolean; hallHqReady: boolean;
    fpsDisplay: number;                    // 1초 이동 평균 — 표시용
    fpsWindow: number;                     // 2초 창 평균 — 적응용 (§8.2 수집 조건) — v1.1 이원화
    renderScale: number; preset: 'low'|'med'|'high';
    rendition: '720p'|'1080p'|'1440p';
    audioState: AudioContextState;
    pointerLocked: boolean; backgroundUnlocked: boolean;  // v1.1
    notices: Array<{ id: string; kind: ErrKind; severity: 'toast'|'overlay'|'blocking';
                     retryable: boolean; at: number }>;   // v1.1 — 오류 전달 채널 (감사 B3)
  };
}
```

### 4.2 액션 목록 (v1.1 확장)

`ui/` → core: `enterRequested`, `skipCorridor`, `pauseResume`, `exitRequested`, `settingsChanged(partial)`, `muteToggled`, `openSettings/closeSettings`, `openCredits/closeCredits`, **`noticeRetried(id)`, `noticeDismissed(id)`** (v1.1).
구독자 콜백 내 무거운 작업 금지 — `queueMicrotask` 예약(§3.1), 오디오 지연 작업은 rAF 금지.

---

## 5. 데이터 명세

### 5.1 설정 저장 — §3.6. 마이그레이션: `schemaVersion` 불일치 시 알려진 필드만 승격.

### 5.2 방문 기록 — `visited`만, hall 최초 도달 시 동기 기록(§3.6).

### 5.3 CREDITS 대장 (v1.1 — SPDX 허용목록 방식, 감사 M-14)

```ts
interface CreditEntry {
  kind: 'video' | 'audio' | 'model' | 'font' | 'tool';
  title: string; author: string; sourceUrl: string;
  license: string;          // SPDX 또는 플랫폼 라이선스 명 — 자유 문자열
  licenseUrl: string; usedFor: string;
}
// 빌드 검증 [필수]: 허용목록 = ['CC0-1.0','CC-BY-4.0','CC-BY-3.0','Pexels','Pixabay','MIT','Zlib','OFL-1.1']
// 허용목록 외 값(오타 포함)·거부 패턴('-NC','-ND' 포함 문자열)은 빌드 실패.
```
크레딧 화면은 이 파일만을 소스로 렌더. QA에 라이선스 페이지 수기 확인 항목 유지.

### 5.4 에셋 매니페스트 (v1.1 — 감사 B9 해소)

```ts
type AssetGroup = 'corridor-min' | 'hall-lq' | 'hall-hq' | 'audio-base' | 'audio-extra';
interface AssetEntry { id: string; group: AssetGroup; url: string; bytes: number; format: string; }
interface VideoEntry { id: string; kind: 'video';
  renditions: Record<'720p'|'1080p'|'1440p', { url: string; bytes: number }>; }
```
- **매니페스트는 번들 동봉**(네트워크 의존 제거 — v1.1, 감사 S7-1).
- **진행률 정책 [필수]**: `sys.loadProgress` = `corridor-min + audio-base`만의 바이트 가중 — **영상·hall은 불포함**(NFR-6 "입장 가능 ≤10초"의 정의와 일치). `hall-lq` ≤3MB 예산 — 재방문 직행(`gate→hall`)의 진입 조건 = `corridor-min + audio-base + hall-lq`(캐시 히트 전제 3초 내 — NFR-7, 감사 D3 해소).
- 영상 프리로드는 corridor 진입 후 시작(복도 체류 20~40초 = 1080p 165MB에 약 33Mbps 필요 — 미완료 시 hall 도달 후 로딩 연출 허용).

### 5.5 영상 렌디션 (v1.1 — 3종·크기 제약)

| 렌디션 | 해상도 | H.264 | 목표/maxrate/bufsize |
|---|---|---|---|
| 1440p | 2560×1440 | High@5.0 | 9M/12M/20M |
| 1080p | 1920×1080 | High@4.0 | 5.5M/7M/12M |
| 720p | 1280×720 | High@3.1 | 3M/4M/7M |

공통: CRF 19+VBV, 30fps CFR, `keyint=60:min-keyint=60:scenecut=0:open_gop=0:aq-mode=3:aq-strength=1.1:deblock=-1,-1`, yuv420p, bt709, `+faststart`, **`-an`**. 마스터: 루프-세이프(끝1초↔앞1초), 총 프레임 = GOP 배수, **소스 선정은 PRD §6.1-⑥(태양 이동 임계) 준수**. **각 파일 ≤400MB [필수]** — 1440p 9Mbps 기준 길이 상한 약 5.9분.

---

## 6. 상태·흐름 명세

### 6.1 입장 (v1.1 — 실패 분기 보강, 감사 S4)

```
[클릭 "입장하기"] → core: ctx.resume() 시도 + requestPointerLock(2단 폴백 §3.4)
  ├ 잠금 성공(pointerlockchange) ∧ resume 성공 → corridor 전이 (§3.3 훅: 페이드·믹스)
  ├ 잠금 성공 ∧ resume 실패/pending → corridor 전이하되 sys.notices('audio-resume', toast)
  │   → 다음 클릭·키 제스처에서 resume 재시도 (무음 입장 상태를 사용자에게 알림)
  └ 잠금 실패(pointerlockerror) → 상태 유지 + notices('pointer-lock', toast, retryable)
전체화면 토글 on이면 잠금 성공 후 같은 제스처에서 requestFullscreen (실패 무해)
```

### 6.2 Esc 일시정지 / 복귀 — §3.3 COR-32 규칙 참조. 복귀 시 품질 변경이 있었으면 §6.5 분기 선행.

### 6.3 탭 전환 / 복귀 (v1.1 — B2 해소 반영)

```
[hidden] → 아무 것도 하지 않음 (rAF 정지, 오디오 지속, suspend 금지)
  ※ 이 사이 Pointer Lock 해제는 paused로 취급 안 함 (§3.3)
[visible 복귀] → delta 클램프 → 비디오 §3.8 VID-7 경계 규칙 적용
  → backgroundUnlocked이면 "클릭하여 시점 복귀" 최소 프롬프트 (메뉴·볼륨 변화 없음)
  → ctx.state 확인 → 필요 시 resume
```

### 6.4 루프 A/B 스왑 — §3.8 VID-3·VID-7. 정상 경로: A rVFC에서 잔여 0.5s 감지 → B 재생 + uMix 0.25s 램프 → 역할 교대.

### 6.5 수동 품질 변경 → 렌디션 재로드 (v1.1 신설 — 감사 D7)

```
[일시정지 메뉴에서 프리셋 변경 → 렌디션 변경 필요 판정]
  → "계속" 대신 "품질 적용 중" 인디케이터, 신규 A를 canplay까지 대기(최대 10초)
  → 성공: A.currentTime = 구.currentTime % duration (위치 승계), 구 엘리먼트 src=''+load()로 해제
  → 실패/타임아웃: 이전 렌디션 롤백 + notices('video-play', toast)
  → 이후 정상 복귀 흐름
```

---

## 7. 오류 처리 (v1.1 — 6종 추가, 전달은 `sys.notices`)

| # | kind | 감지 | 처리 | 표시 |
|---|---|---|---|---|
| ERR-1 | webgl-unsupported | boot 컨텍스트 생성 실패 | unsupported 전이 | 전용 화면 |
| ERR-2 | context-lost | `webglcontextlost` | preventDefault → restored 시 재구성, 10초 실패 시 새로고침 안내 | overlay |
| ERR-3 | audio-resume | resume reject / `'suspended'` 정체 | 다음 제스처 재시도. **`'closed'`는 그래프 전체 재구성(§3.9)** | 음소거 아이콘+toast |
| ERR-4 | asset-load | fetch 실패/30초 | 2회 재시도(백오프) → 게이트 오류+재시도 | blocking |
| ERR-5 | video-play | `error`/`stalled` 5초 | **계단식 폴백 ≤3단 + 블랙리스트**(§3.8) | 짧은 로딩 |
| ERR-6 | storage | try/catch | 인메모리 폴백, 필드 단위 기본값 | 없음 |
| ERR-7 | pointer-lock | `pointerlockerror` | 재시도 버튼 | toast |
| ERR-8 | manifest | 번들 동봉이므로 파싱 실패만 | 하드코딩 최소 세트 폴백 | blocking |
| ERR-9 | audio-decode | `decodeAudioData` reject | 해당 레이어만 제외하고 계속(베이스 실패 시만 고지) | toast(조건부) |
| ERR-10 | video-cors | 첫 텍스처 업로드 try/catch + `videoWidth>0 ∧ 업로드 실패` (ERR-5 감지망을 빠져나가는 경로 — v1.1) | 배포 설정 오류로 분류, 고정 안내 | overlay |

전 오류는 `track('error', {kind})` 훅(도입 후) + 콘솔 원인 로그.

---

## 8. 성능·품질 명세 (SRS-QLT)

### 8.1 품질 프리셋 (v1.1 — 오타·공식·범위 정정)

**유효 픽셀 공식 [필수]**: `유효 픽셀 = viewport × min(devicePixelRatio, DPR상한) × renderScale²` — DPR 상한과 renderScale은 **곱으로 결합**되므로 프리셋별 조합 상한을 함께 규정한다.

| 항목 | Low | Med | High |
|---|---|---|---|
| renderScale 범위 | 0.6~0.85 | 0.75~1.0 | 0.85~**1.5** (v1.1 — PRD·조사 G와 정합) |
| DPR 상한 | 1.0 | 1.25 | 1.5 |
| **조합 상한(min(DPR,cap)×scale)** | ≤0.85 | ≤1.25 | **≤1.5** (v1.1 — 1.5×1.5 방지 캡) |
| 그림자 | 없음(베이크만) | 스필 1개 512px | **스필 1024px 2개 또는 2048px 1개** (v1.1 오타 정정) |
| Bloom | 꺼짐 | Selective ½해상도 | Selective + LUT |
| SMAA | 꺼짐 | 켜짐 | 켜짐 |
| 파티클·배경 애니메이션 상한 | 0.3 | 0.6 | 1.0 (§3.6 결합 공식) |
| 영상 렌디션 상한 | 1080p | 1440p | 1440p |

수치는 M0 실측(V5~V7, M0b V6)으로 갱신하되 표와 동기화한다.

### 8.2 자동 감지·적응 (v1.1 — 임계·정책 전면 정정, 감사 F-4·D4·D6)

- 초기: detect-gpu 티어 → tier1=Low, tier2=Med, tier3=High. **미판정 → Low 시작.**
- **fps 수집 조건 [필수]**: `state==='hall' ∧ !paused ∧ visibilityState==='visible'` 일 때만 2초 창 누적. 조건 파괴 시 현재 창 폐기 + 복귀 후 30프레임 워밍업 버림. (일시정지 흐림 패스·탭 복귀 이상치의 오염 방지)
- **하향**: `fpsWindow < 45`(NFR-1 목표와 정렬 — 구 40 정정) 지속 3창 → renderScale −0.05(프리셋 하한까지) → 미달 지속 시 프리셋 1단 하향. 하향 시 `renderScale = clamp(현재값, 새 프리셋 범위)`.
- **상향**: `fpsWindow > 55` 지속 10창 → **renderScale만** 상향. **프리셋 자동 상향은 하지 않는다**(세션 내 수동 전용 — 핑퐁 원천 차단).
- 프리셋 자동 하향은 **세션당 최대 2회 + 최소 30초 간격**, NFR-3 스파이크 측정에서 프리셋 전환 프레임은 제외.
- **renderScale 변경은 렌더타겟 재할당을 수반해서는 안 된다 [필수]** — 최대 크기 1회 할당 + viewport/scissor 부분 렌더 방식(변경 자체가 스파이크를 만드는 모순 방지 — 감사 D5).

### 8.3 프레임 예산 (하한 22.2ms@45fps) [권장]

비디오 업로드 ≤4ms / 후처리 ≤3ms / 씬 렌더 ≤10ms / 스크립트 ≤2ms / 여유 ≥3ms.

### 8.4 메모리 예산 (v1.1 신설 — 감사 공백 D)

하한 장비는 통합 그래픽 = 시스템 RAM 공유이므로 상주 메모리가 실제 병목일 수 있다. 목표(가이드, M0b 실측 갱신):

| 항목 | 예산 |
|---|---|
| 오디오 디코딩 버퍼 합계 | ≤ 60MB (모노 위주·짧은 루프로 통제) |
| 비디오 디코더 | 정상 1세션, 스왑 순간 2세션 (1440p 기준) |
| 텍스처(KTX2 — GPU 압축 유지) | ≤ 256MB VRAM 상당 |
| JS 힙 | ≤ 128MB |
| **총 상주 목표** | < 600MB [추정 — M0b V0에서 실측 확정] |

### 8.5 로딩 예산 (SRS-QLT-3, v1.1 신설 — 감사 M-2: NFR-5~7 이관)

| 단계 | 기준 | 측정 |
|---|---|---|
| 게이트 표시(LCP) | ≤ 2.5초 (100Mbps, 캐시 비움) | Lighthouse/Performance 패널 |
| 입장 가능(`corridor-min`+`audio-base`) | ≤ 10초 | 인앱 계측 |
| 재방문(캐시 활성, +`hall-lq`) | ≤ 3초 | 인앱 계측 |

### 8.6 디버그 오버레이 (v1.1 — 소유·사양 명시, 감사 M5·m-18)

`ui/debugOverlay.ts`, `?debug` 파라미터로 표시. 항목: fpsDisplay/fpsWindow, 1% low, 프레임타임 히스토그램, **입력→프레젠트 지연**(NFR-4 측정 수단 — v1.1 추가), renderScale/preset/rendition, 드로우콜, 비디오 업로드 ms, 메모리(가용 시). **JSON 다운로드 버튼은 프로덕션 빌드에도 유지**(검증 리포트 수집 수단). 표시 코드는 번들 포함, 로깅 상세만 `import.meta.env` 가드.

---

## 9. 검증 명세

### 9.1 M0 검증 (v1.1 — M0a/M0b 분할, 감사 D1. 상세 절차는 PRD §9와 동일 분류)

**M0 착수 준비물** (감사 A4): git init + .gitignore(+미디어 제외 정책) + 코드 라이선스 결정, CLAUDE.md(§9.4 금지 규칙 요약), FFmpeg·Firefox 설치, 일몰 후보 소스 1개+렌디션 인코딩, 사운드 샘플.

**프로토타입 구성 [필수]**: 임시 박스 상영관 + 대형 스크린 1면 + PointerLock 이동 + 렌디션 3종 선택 재생 + A/B 스왑 + PositionalAudio 1~16 + SelectiveBloom + 디버그 오버레이(JSON 수집).

- **M0a (현 PC, Chrome·Edge·Firefox)**: V3(rVFC 게이팅 ≥30% 절감) · V4(HRTF 1/4/8/16 — CPU는 **작업관리자 프로세스 CPU% 기준**(v1.1 판정 기준 명시), 아티팩트·정위 청감) · V5(블룸 3안, Selective <3ms) · V7(조명 3안) · V8(컬러 + **루프 이음새 30프레임 휘도 불연속 <1% 자동 판정** — v1.1 확장) · V11(번들 ≤300KB) · V12(WebGPU 이관 비용 측정) · V13(Babylon 트리거 — 판정: 동일 fps에서 스크린샷 비교 + 외부 1인 블라인드 선호) · **V15(A/B 이중: HTTP 캐시 공유 실측/디코더 2세션/스왑 100회 드롭·이음새/B play→첫 rVFC p95<100ms)** · **V16(후보 3소스 × 루프 10회 블라인드 지각)**.
- **M0b (하한 실기 확보 후)**: **V0(R-10 종합: 3분×3회 — 평균≥45 / 1% low≥30 / 스파이크≤3회)** · V1(업로드 <4ms) · V2(HW 디코딩 — Chrome media-internals / **Firefox about:support Media** — v1.1 수단 보강) · V6(필레이트 스윕 → §8.1 갱신) · V10(팬리스 20분, 하락 <15%).
- **배포 준비 단계 이월**: VD-1(R2 CORS·텍스처·오디오), VD-2(한국발 TTFB·처리량).
- **M0 산출물**: 실측 JSON, 갱신된 §8.1·§8.4, 스택 확정 기록(three 고정 버전), V13·V15·V16 결정. **M0b 완료 전 "최종 확정" 선언 금지. 종합 실패 시 양보 순서: 화질 → 공간 장식 → fps** (감사 D5).

### 9.2 검증 계층 (v1.1 재작성 — 감사 "회귀 방어 불가" 해소)

| 계층 | 대상 | 도구 | 시점 |
|---|---|---|---|
| 정적 (빌드 게이트) | 의존 규칙(§2.1 — `no-restricted-imports` + store write 캡슐화), 번들 ≤300KB, 라이선스 허용목록(§5.3), `tsc --noEmit` | ESLint 최소 구성 + 빌드 스크립트 | 매 빌드 |
| 단위 (빌드 게이트) | 설정 클램프·마이그레이션(손상 주입 12케이스), **상태 전이 매트릭스 전수**(허용/거부), 렌디션 선택 입력 조합, 볼륨 3버스 결합, 적응 히스테리시스 | Vitest — 전부 순수 함수 | 매 빌드 |
| 통합 [권장] | 게이트→복도→상영관 흐름, Esc→계속 5회, 손상 localStorage 기동 | Playwright(Chromium, SwiftShader — 흐름만) | 릴리스 전 |
| 계측 자동 판정 | 루프 이음새 휘도(V8 확장), fps/1% low/스파이크 JSON 리포트 임계 비교 | 디버그 오버레이 JSON + 판정 스크립트 | M0·릴리스 전 |
| 수동 (릴리스 전 1회) | 정위감 청감, 감각 안전 육안, 한글 IME 실기, 브라우저 3종 성능표, PRD §8 QA 전 항목(v1.1 경계 케이스 포함) | 체크리스트 | 릴리스 전 |

### 9.3 (구 §9.2의 잔여) MVP 수용 = PRD §8 QA 체크리스트 v1.1.

### 9.4 구현 금지 규칙 요약 (CLAUDE.md 원천 — v1.1 신설)

`Audio.setVolume()`·`AudioListener.setMasterVolume()` 금지(버스만) / `gain.value` 직접 대입 금지 / MP3·MediaElementSource·5분급 통짜 버퍼 금지 / `visibilitychange→suspend()` 금지 / 오디오 스케줄을 rAF에 매달기 금지 / `RectAreaLight` 실사용 금지 / `<video loop>` 속성 금지(스왑 로직 소유) / 렌더타겟 재할당식 renderScale 변경 금지 / ui↔scene 상호 import 금지 / store 직접 write 금지(core 전용) / 씬 전환 0.5초 미만 급전환·섬광 금지.

---

## 10. 추적성 매트릭스 (v1.1 전수 재작성 — 감사 M-1)

| MRD | RFP | PRD | SRS | 비고 |
|---|---|---|---|---|
| MR-1 | R-1 | FR-31·32 | SCN-30·31 | |
| MR-2 | R-2(v1.2 재정의) | FR-31 | SCN-32 | 관성→입력 램프 조정 기록 |
| MR-3 | R-3 | FR-40~45 | AUD-1~8 | |
| MR-4 | R-4 | FR-30·35 + §8 QA 규모감 검수 | SCN-13, §3.5 | 검수 기준은 M1 아트 브리프에서 수치화 |
| MR-5 | R-5·6 | FR-11·20~24·60 | UI-2·3, COR-32·50~52, §6.1·6.2 | |
| MR-6 | R-8 | FR-10·§2.2(무설치·무가입 여정) | UI-2, §5.4 | v1.1 매핑 명시(구 매트릭스 허위 정정) |
| MR-7 | R-9 | §1.2·§2.1(VR 미지원 전제) | — (전제 조건) | 의도적 — 구현 항목 아님 |
| MR-8 | R-10~13 | NFR-1~12, FR-14 | QLT 전체, ERR-1·2 | |
| MR-9 | R-5(통합)·R-9 헤드폰 | FR-10 | UI-2 | |
| MR-10 | R-19~21 | §6.1 | §5.5, VID-1~7 | v1.1 3렌디션 |
| MR-11 | R-22 | §6.1-④·§6.2 | §5.3 | |
| MR-12 | R-7 | FR-37(완결감)·FR-44(켜두기) | AUD-3·7, §6.3 | v1.1 — 완결감 복원 |
| MR-13 | 로드맵(§7) | §10 범위 외 | — | 의도적 이월 |
| MR-14 | 로드맵 | §10 범위 외 | — | 의도적 이월 |
| MR-15 | R-24 | **FR-90** | UI-2·6 문구 검수 | v1.1 소실 복원 |
| MR-16 | R-23 | §7 | DEP-1~3 | |
| MR-17 | 로드맵(§1.2 제외 명시) | §10 범위 외 | — | 의도적 이월 |
| MR-18 | R-21(범위 제외 기록) | §6.1 AV1 조건 부기 | §5.5 | v1.1 처분 기록 |
| — | R-14~18 | FR-13·23·43·50~53, §5.3 | COR-23·24, SCN-23·31~33, UI-4 | comfort 계열 |
| — | R-25 | FR-80·81 | ANL-1~3(조건부) | 도구 미정 |

---

## 11. 미해결·후속 (v1.1 갱신)

1. 상영관·복도 아트 디렉션 + **R-4 검수 기준 수치화** — M1(M0a와 병행 착수). 기술 제약: §3.5·§8.
2. 사운드 디자인 구체(레이어 구성·배치도) — M1. AUD-3·4 제약 내.
3. §8.1 프리셋 표·§8.4 메모리 예산 최종 수치 — M0 실측 후.
4. **일몰 영상 최종 소스 선정** — PRD §6.1 기준(⑥ 포함) 후보 3+, M0a V16 연동. (v1.1 — 증발분 복원)
5. **분석 도구·도입 구성** — 공개 시점 결정 (v1.1 — "확정" 표기 철회).
6. 서비스 이름·도메인 — 배포 준비 단계. 취득 시 VD-1·VD-2 수행.
7. **하한 실기(Iris Xe급) 확보 방법·시점** — M0b 전제 (v1.1 추가).
8. Safari macOS — 실기 확인 후 "권장"↔"미지원 명시" 재분류.
