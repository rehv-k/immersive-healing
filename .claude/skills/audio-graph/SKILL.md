---
name: audio-graph
description: "IH(몰입 힐링) 오디오 계층 — Web Audio 버스·앰비언스·정위 음원. Use when: 볼륨, 음소거, 덕킹, 페이드, 버스, GainNode, 앰비언스, 위상 믹스, phaseMix, nightWeight, PositionalAudio, HRTF, 정위감, AudioContext, resume, visibilityBus, graph.ts, 소리가 안 날 때, 밤에 소리가 이상할 때, 클릭·팝 노이즈 등. Covers: src/audio/**, SRS-AUD-1~9, docs/tc/TC_AUD_AudioGraph.md, tests/phaseMix.test.ts."
argument-hint: "대상 (예: bus, ambience, positional)"
---

# Audio Graph Layer

Web Audio 버스 믹서 계층. 소스 → (spatialBus) → userVolume → duck → mute → visibilityBus → destination. 대상은 `$ARGUMENTS`로 받는다.

---

## 흐름 / 핵심 파일

| 단계 | 파일 | 역할 |
|---|---|---|
| 1 | `src/audio/graph.ts` | ★버스 생성·배선. AudioContext 생성 → `THREE.AudioContext.setContext()` → **그 다음** AudioListener 생성 |
| 2 | `src/audio/ambience.ts` | 합성 5레이어(waves 37s·wind 53s·pad 71s·nightAir 43s·drone 61s) — 다른 길이·오프셋 루프 |
| 2b | `src/audio/phaseMix.ts` | ★태양 고도→레이어 게인 순수 함수 — 상한표·밤 총합 ≤ 낮 불변식 (TC-AUD-09~10) |
| 3 | `src/audio/positional.ts` | 정위 음원 ≤8 — 생성 즉시 `distanceModel='linear'` + spatialBus 재배선 |
| 4 | `src/audio/scheduler.ts` | 모든 예약은 `ctx.currentTime` 기준 — rAF 비의존 |

## 램프·믹스 상수 (SRS-AUD-2·5·6·7)

| 키 | 값 | 의미 |
|---|---|---|
| 덕킹(일시정지) | 0.35로 1.0s 램프 / 해제 1.0s | duckBus (TC-AUD-07) |
| 음소거 | 0/1, 0.15s 램프 | muteBus |
| 가시성 페이드 | 숨김 0.25s→0 / 복귀 0.6s→1 | visibilityBus — **게인만**, 클럭은 계속 |
| 씬 믹스 | gate→corridor 페이드 인 2~4s, hall 진입 크로스페이드 ~2s | 상태 머신 onEnter 훅 |
| 정위 파라미터 | `refDistance 4~8m`, `rolloffFactor 1`, maxDistance 씬별 분리 | SRS-AUD-4 |
| 위상 믹스 램프 | 고도 0.4° 변할 때마다 2.5s 램프 | main.ts 루프 — 게인 값 자체는 phaseMix만 소유 |
| 정위 배치 | 벽면 앵커 5곳(전방=태양·좌·우·후방 2) | 시각 정합(SRS-AUD-9), world.audioAnchors |

## 주의·함정 (전부 실제 금지 규칙 — check-arch·검사가 잡는다)

- **three `setVolume`/`setMasterVolume` 호출** — 금지. 버스 램프 스케줄과 충돌한다. 자체 GainNode 버스만 (TC-AUD-01).
- **`gain.value` 직접 대입** — 클릭·팝. `setValueAtTime(현재값, now)` → `linearRampToValueAtTime`. 등파워는 `setValueCurveAtTime` cos/sin (TC-AUD-02).
- **`visibilitychange → ctx.suspend()`** — 절대 금지(check-arch 자동 검출). 복귀 시 스케줄 전체가 어긋난다. [2026-08-22 사용자 결정] 소리는 탭이 보일 때만 = visibilityBus **게인** 페이드로 처리 (TC-AUD-03).
- **`ctx.onstatechange`** — `'suspended'`는 다음 사용자 제스처에서 resume, `'closed'`는 그래프 전체 재구성(SRS-AUD-7). 최초 resume은 게이트 클릭.
- **정위 음원을 멈췄다 다시 만들기** — 금지. 상시 재생 + 개별 GainNode 0 램프 소거. 근거: HRTF 컨볼루션 노드 생성/파괴 비용(구 three.js #15422 근거는 폐기됨 — SRS-AUD-4 v1.1 정정 참조).
- **MP3·MediaElementSource·5분급 통짜 버퍼** — 금지(TC-AUD-05). OGG Vorbis/Opus + 짧은 루프 레이어. 감상 사이클은 상영관 도달 후 2분 내 1회 완결(PRD FR-37).

- **레이어 게인 하드코딩 금지** — 개별 게인은 `gainsForElevation`이 유일 소유. 상수 바꾸려면 `DAY_GAINS`/`NIGHT_GAINS`/`GAIN_CEILING`을 고치고 TC-AUD-09(총합 ≤ 낮)가 통과하는지 확인. 사용자 상한 결정('소리 과대' 2026-08-22)이 시험으로 고정돼 있다.

## 관련 문서(SDLC)

- 요구: `docs/srs/SRS.md` §3.9 (SRS-AUD-1~9)
- 시험: `docs/tc/TC_AUD_AudioGraph.md` (01~08 검사·시연 / 09~10 시험 레인)
- 램프 상수 변경 시 `CLAUDE.md` §7 오디오 정책 메모 정합.
