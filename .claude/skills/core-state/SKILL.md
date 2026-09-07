---
name: core-state
description: "IH(몰입 힐링) 코어 상태·설정·입력 세션 계층. Use when: 상태 머신, 씬 전이, 일시정지, 설정 클램프, comfortProfile, 포인터락, 전체화면, 탭 전환, store, dispatch, publishSys, sceneState.ts, inputSession.ts, ih:settings:v1, 설정이 저장 안 될 때, Esc가 안 먹을 때, 전이가 거부될 때 등. Covers: src/core/**, src/types.ts, tests/{sceneState,settings}.test.ts."
argument-hint: "대상 (예: state, settings, input)"
---

# Core State Layer

상태 전이·설정 write·브라우저 세션 API를 전유하는 계층. ui 액션 → `store.dispatch` → core 내부 전이 → 구독자(scene/audio) 흐름. 대상은 `$ARGUMENTS`로 받는다.

---

## 흐름 / 핵심 파일

| 단계 | 파일 | 역할 |
|---|---|---|
| 1 | `src/types.ts` | `Action` 유니언(13종)·`AppState`·`Settings` — 액션 추가는 여기부터 |
| 2 | `src/core/store.ts` | pub/sub — `get`/`dispatch`(ui)/`publishSys`(scene·audio)/`subscribe({immediate:true} 기본)` |
| 3 | `src/core/sceneState.ts` | 6상태·허용 8전이 매트릭스(`TRANSITIONS`·`canTransition`·`canPauseIn`) |
| 4 | `src/core/settings.ts` | `sanitizeSettings`(필드 단위 클램프)·`defaultSettings(reducedMotion?)`·comfort 프로필 |
| 5 | `src/core/inputSession.ts` | Pointer Lock·Fullscreen·visibility **전유** — 다른 파일에서 호출하면 check-arch 실패 |

## 상태 머신

- 상태 6종: boot / unsupported(종결) / gate / corridor / hall / exiting. 허용 전이 8쌍뿐 — 추가 시 `TC-COR-01` 전수 시험과 SRS-COR-30 표를 같은 커밋에 갱신.
- `paused`는 corridor·hall에서만 (SRS-COR-32, `TC-COR-03`). 크레딧은 상태가 아니라 `ui.creditsOpen` 오버레이.
- 구독 초기 스냅샷: `immediate:true`가 기본 — 늦게 생성되는 scene/audio가 게이트에서 바뀐 설정을 놓치지 않는 근거(SRS-COR-10).

## 설정 계약 (SRS-COR-20~24)

| 키 | 범위/기본 | 의미 |
|---|---|---|
| `fov` | 60~100 / 90 | 비수치·범위 밖 → 클램프 또는 기본 |
| `sensitivityX/Y` | 0.1~3.0 | 클램프 |
| `masterVolume` | 0~1 / 0.8 | userVolume 버스 입력 |
| `comfortProfile` | normal·sensitive·custom | sensitive는 headBob 0·motionBlur off·bgAnimation ≤0.3 강제 |
| `quality` | auto·low·med·high | 수동 선택 시 자동 강등 금지(TC-QLT-06) |
| `breathGuide` | bool / false | 호흡 리듬 빛(분당 6회) — 기본 off, 효능 문구 금지(TC-COR-16, SRS-COR-25) |

- 저장: localStorage 단일 키 `ih:settings:v1`, 디바운스 300ms + `pagehide` 즉시 플러시(TC-COR-15).
- 손상 주입 대응은 **필드 단위** 폴백 — 전체 객체 리셋 아님(`TC-COR-06`).

## 주의·함정

- **store.coreSet을 core 밖에서 호출** — check-arch가 빌드를 깬다. ui는 dispatch, scene/audio는 publishSys만.
- **포인터락을 제스처 밖에서 요청** — 브라우저가 거부. 반드시 사용자 클릭 핸들러 문맥 + `unadjustedMovement:true` 시도 → 실패 시 옵션 없이 2단 폴백(SRS-COR-51). 성공 판정은 `pointerlockchange` 이벤트 기준.
- **reduced-motion 런타임 반영** — `comfortTouchedByUser===true`면 자동 변경 금지, 알림만(SRS-COR-24).
- **전이 추가 시 시험 누락** — `TC-COR-01`이 6×6 전수 대조라 매트릭스만 고치면 시험이 잡아준다. 시험을 약화시키지 말고 문서·시험을 같이 갱신.

## 관련 문서(SDLC)

- 요구: `docs/srs/SRS.md` §3.1~3.4·§3.6 (SRS-COR)
- 시험: `docs/tc/TC_COR_CoreStateSettings.md` (TC-COR-01~15)
- 설정 키 변경 시 `CLAUDE.md` §5·§7 정합도 같은 커밋에.
