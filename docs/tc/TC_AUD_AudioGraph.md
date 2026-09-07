# TC-AUD — 오디오 그래프·버스 시험 명세

| 항목 | 값 |
|---|---|
| Document ID | TC_AUD_AudioGraph |
| Version / Status | v1.0 / Draft |
| Parent SRS | [SRS](../srs/SRS.md) §3.9 (SRS-AUD-1~8) |
| Test Scripts | (자동 시험 미배정 — 검사·시연 중심 컴포넌트) |
| 상위 체인 | RFP R-3(정위 오디오)·R-7(탭 가시성)·R-17(급작 소리 배제) → PRD FR-4x → SRS-AUD → **본 TC** |

> **권위 선언**: 요구·시험의 권위는 본 TC 문서다. 리포트는 특정 실행의 evidence다.
> 본 컴포넌트는 Web Audio 실기 의존이 커서 **검사(Inspection)·시연(Demonstration)이 1차 레인**이다.
> 리포트의 "미커버"는 본 문서가 의도한 레인 배치이며 미구현을 뜻하지 않는다.

## 1. 테스트 전략

- **1.1 레벨**: 정적 검사(check-arch 자동 — suspend 안티패턴 등) + 코드 검사 + 실기 시연(청감·믹스) + M0a V4(HRTF 분석).
- **1.2 SRS 추적성**: §6 표. 그래프 로직 중 순수 함수로 분리 가능한 부분(페이드 파라미터 계산 등)이 생기면 시험 레인으로 승격하고 **9번부터** 발급한다.

## 2. 테스트 환경 및 전제

| 구분 | 전제 |
|---|---|
| 검사 | `node scripts/check-arch.mjs` + 코드 grep. 빌드 게이트 |
| 시연 | 실기 브라우저 + 헤드폰. 결과는 DEVLOG 또는 `docs/report/`에 기록 |

## 3. 테스트 그룹

### 3.1 버스·게인 규율 (SRS-AUD-1·2·7)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-AUD-01** | SRS-AUD-1 | 검사 | — | ① `src/audio/graph.ts` 버스 배선 검사 | userVolume→duck→mute(→visibility) 체인, three `setVolume`/`setMasterVolume` 사용 0건 | 체인 구성 일치 **AND** 금지 API 0건 → Pass |
| **TC-AUD-02** | SRS-AUD-2 | 검사 | — | ① `gain.value` 직접 대입 grep | `setValueAtTime`+`linearRampToValueAtTime`만 사용 | 직접 대입 0건 → Pass |
| **TC-AUD-03** | SRS-AUD-7 | 검사·시연 | 실기 | ① check-arch(visibilitychange→suspend 안티패턴 검출) ② 탭 숨김/복귀 실기 | suspend 호출 없음, 게인만 페이드(숨김 0.25s→0, 복귀 0.6s→1), 클럭 지속 | 검사 0건 **AND** 복귀 시 스케줄 어긋남 없음 → Pass |
| **TC-AUD-04** | SRS-AUD-2 | 검사 | — | ① 스케줄 코드 검사 | 모든 예약이 `ctx.currentTime` 기준(rAF 비의존) | rAF 의존 스케줄 0건 → Pass |

### 3.2 소스·정위 (SRS-AUD-3·4)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-AUD-05** | SRS-AUD-3 | 검사 | — | ① 소스 로딩 코드 검사 | OGG + `AudioBufferSourceNode(loop=true)`. MP3·MediaElementSource·5분급 통짜 버퍼 0건 | 금지 3종 0건 → Pass |
| **TC-AUD-06** | SRS-AUD-4 | 검사 | — | ① PositionalAudio 생성부 검사 | 생성 즉시 `distanceModel='linear'` + spatialBus 재배선, 동시 활성 ≤8 | 전 생성부 준수 → Pass |

### 3.3 믹스·전이 (SRS-AUD-5·6)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-AUD-07** | SRS-AUD-5 | 시연 | 실기 | ① Esc 일시정지 ② 계속으로 복귀 | 덕킹 35%로 1.0s 램프, 복귀 시 1.0s 복원. 음소거는 0.15s | 클릭·팝 없음 **AND** 램프 시간 체감 일치 → Pass |
| **TC-AUD-08** | SRS-AUD-6 | 시연 | 실기 | ① gate→corridor→hall 주행 | 앰비언스 페이드 인 2~4s, hall 진입 크로스페이드 ~2s | 전이마다 급단절 없음 → Pass |

### 3.4 위상 연동 믹스 (SRS-AUD-9 — 시험 레인, v1.1 신설)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-AUD-09** | SRS-AUD-9 | 시험 | 고도 +8~−20° 0.5° 간격 | ① `gainsForElevation` 전수 ② 상한표·총합 비교 | 모든 레이어 0 ≤ g ≤ 상한, 총합 ≤ 낮 믹스 총합 | 전 고도 → Pass |
| **TC-AUD-10** | SRS-AUD-9 | 시험 | — | ① `nightWeight` 0.25° 간격 스캔 ② 끝값 | 연속(스텝 <0.05)·단조, +6°→0, −12°→1; 낮 게인 = 기준값, 밤에 drone>0.1·wind<낮 | 전 항목 → Pass |

## 4. 테스트 실행 순서

3.1·3.2(검사)는 빌드 게이트. 3.4(시험)는 `npm run report`. 3.3(시연)은 릴리스 전 체크리스트. HRTF 부하는 M0a V4(분석)가 소유.

## 5. Pass/Fail 기준

검사 = 빌드 게이트 통과 + 코드 검사 기록. 시연 = 절차 기록에 기대 결과 충족 명기.
필수 SRS 연계 TC 100% Pass가 컴포넌트 합격 조건.

## 6. 추적성

| SRS ID | TC ID | test 스크립트(계획값) |
|---|---|---|
| SRS-AUD-1 | TC-AUD-01 | 검사 |
| SRS-AUD-2 | TC-AUD-02 · TC-AUD-04 | 검사 |
| SRS-AUD-7 | TC-AUD-03 | `scripts/check-arch.mjs` + 시연 |
| SRS-AUD-3 | TC-AUD-05 | 검사 |
| SRS-AUD-4 | TC-AUD-06 | 검사 |
| SRS-AUD-5 | TC-AUD-07 | 수동 시연 |
| SRS-AUD-6 | TC-AUD-08 | 수동 시연 |
| SRS-AUD-9 | TC-AUD-09 · TC-AUD-10 | `tests/phaseMix.test.ts` |

> 번호 규율: 다음 AUD TC 번호는 **11번부터**. 재배치·재사용 금지.
