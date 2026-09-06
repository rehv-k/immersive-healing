# TC-QLT — 품질 적응 시험 명세

| 항목 | 값 |
|---|---|
| Document ID | TC_QLT_Adaptation |
| Version / Status | v1.0 / Draft |
| Parent SRS | [SRS](../srs/SRS.md) §8 (SRS-QLT, §8.1~8.6) |
| Test Scripts | `tests/adaptation.test.ts` (초기 계획값 — 실제 연결은 리포트가 집계) |
| 상위 체인 | RFP R-10(성능 기준)·R-12(프리셋·핑퐁 금지) → PRD NFR-1~4 → SRS §8 → **본 TC** |

> **권위 선언**: 요구·시험의 권위는 본 TC 문서다. 리포트는 특정 실행의 evidence다.
> §6의 스크립트 경로는 초기 계획값이며 손으로 유지하지 않는다.

## 1. 테스트 전략

- **1.1 레벨**: 히스테리시스 순수 함수 단위 시험(빌드 게이트) + 검사(정적) + M0 실측(분석 — `docs/report/` 근거 계층).
- **1.2 SRS 추적성**: §6 표. 검증 방법 어휘 = 시험·검사·시연·분석(SRS §9.2).

## 2. 테스트 환경 및 전제

| 구분 | 전제 |
|---|---|
| 단위 시험 | `src/scene/adaptation.ts` 순수 함수 — 시간은 인자 주입(타이머 불필요) |
| 분석(M0) | 실기 fps JSON 수집(§8.6 디버그 오버레이) — 정량 목표는 평가 전 lock |

## 3. 테스트 그룹

### 3.1 하향 히스테리시스 (SRS §8.2)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-QLT-01** | §8.2 (NFR-1 정렬) | 시험 | — | ① `FPS_DOWN_THRESHOLD` 조회 | 45 (감사 F-4 정렬값) | =45 → Pass |
| **TC-QLT-02** | §8.2 | 시험 | med 프리셋 초기 상태 | ① fps 40 윈도우를 `DOWN_WINDOWS`회 공급 | `scale-down` 발생, renderScale 하락 | 변경 종류 일치 **AND** scale 감소 → Pass |
| **TC-QLT-03** | §8.2 | 시험 | — | ① fps 44(40~45 갭) 윈도우 연속 공급 | 갭에서도 정체 없이 `scale-down` | scale-down 발생 → Pass |
| **TC-QLT-04** | §8.2 | 시험 | renderScale = 프리셋 하한 | ① 저 fps 공급 → 프리셋 강등 확인 ② 직후 재공급 | 강등은 scale 플로어에서만, 최대 2회, 30초 간격 | 1회 강등 **AND** 간격 내 재강등 없음 → Pass |

### 3.2 상향·수동 정책 (SRS §8.2)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-QLT-05** | §8.2 | 시험 | renderScale<상한 | ① fps 60 윈도우를 `UP_WINDOWS`회 공급 | `scale-up`만 발생, 프리셋 자동 상향 없음 | scale-up **AND** preset 불변 → Pass |
| **TC-QLT-06** | §8.2 | 시험 | 수동 low 프리셋 | ① 극저 fps 장기 공급 | 수동 프리셋은 자동 강등 금지 | preset='low' 유지 **AND** manualPreset 유지 → Pass |

### 3.3 자동 시험 밖 (다른 레인)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-QLT-07** | §8.1·렌더 규칙 | 검사 | — | ① renderScale 변경 경로 코드 검사 | 렌더타겟 재할당 없음(최대 크기 1회 할당+viewport) | 재할당 코드 0건 → Pass |
| **TC-QLT-08** | §8.6 | 시연 | 실기 | ① 디버그 오버레이 켜고 3분 주행 ② JSON 수집 | fps/1% low/스파이크 JSON 산출 | 스키마 필드 전부 존재 → Pass |
| **TC-QLT-09** | §8.2·NFR-1 | 분석 | M0b 하한 실기 | ① V0 절차(3분×3회) | 평균≥45 / 1% low≥30 / 스파이크≤3회 | 3지표 충족 → Pass (결과는 `docs/report/`) |

## 4. 테스트 실행 순서

3.1 → 3.2 (상호 독립). 3.3은 빌드 게이트(검사)·M0 시점(분석).

## 5. Pass/Fail 기준

시험 = 리포트 failed 0. 검사 = 빌드 게이트 통과. 분석 = M0 보고서에 합격선 충족 명기.
정량 합격선(45/30/3회)은 **평가 전 lock — 사후 조정 금지**.

## 6. 추적성

| SRS ID | TC ID | test 스크립트(계획값) |
|---|---|---|
| SRS §8.2 | TC-QLT-01 ~ TC-QLT-06 | `tests/adaptation.test.ts` |
| SRS §8.1 | TC-QLT-07 | 코드 검사 |
| SRS §8.6 | TC-QLT-08 | 수동 시연 |
| SRS §9.1 V0 | TC-QLT-09 | M0 분석(`docs/report/`) |

> 번호 규율: 다음 QLT TC 번호는 **10번부터**. 재배치·재사용 금지.
