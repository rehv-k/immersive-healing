# TC-COR — 코어 상태·설정 시험 명세

| 항목 | 값 |
|---|---|
| Document ID | TC_COR_CoreStateSettings |
| Version / Status | v1.0 / Draft |
| Parent SRS | [SRS](../srs/SRS.md) §3.1~3.4·§3.6 (SRS-COR-1x·2x·3x·5x) |
| Test Scripts | `tests/sceneState.test.ts` · `tests/settings.test.ts` (초기 계획값 — 실제 연결은 리포트가 집계) |
| 상위 체인 | RFP R-2·R-6·R-14 → PRD FR-2x·FR-5x → SRS-COR → **본 TC** |

> **권위 선언**: 요구·시험의 권위는 본 TC 문서다. `scripts/generate-report.mjs`의 리포트는
> **특정 실행의 evidence**이며, 검사·시연·분석 유형을 자동 미커버/PASS로 재정의하지 않는다.
> §6의 스크립트 경로·구현 상태 표기는 초기 계획값으로 **손으로 유지하지 않는다** — 태깅하면 리포트에 자동 반영된다.

## 1. 테스트 전략

- **1.1 레벨**: 순수 함수 단위 시험(Vitest, 빌드 게이트 — SRS §9.2) + 정적 검사(check-arch, 빌드 게이트) + 시연(수동 체크리스트).
- **1.2 SRS 추적성**: 본 문서의 모든 TC는 SRS-COR 요구를 검증하며 §6 표로 연결한다. 검증 방법 어휘는 SRS §9.2와 동일: **시험(Test) · 검사(Inspection) · 시연(Demonstration) · 분석(Analysis)**.

## 2. 테스트 환경 및 전제

| 구분 | 전제 |
|---|---|
| 단위 시험 | Node ≥20 + Vitest. 브라우저·DOM 불필요(전부 순수 함수) |
| 검사 | `node scripts/check-arch.mjs` 통과 = 합격 evidence |
| 시연 | Chrome/Edge/Firefox 실기, 수동 절차. 결과는 DEVLOG 또는 `docs/report/`에 기록 |

## 3. 테스트 그룹

### 3.1 상태 머신 (SRS-COR-30~32)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-COR-01** | SRS-COR-30 | 시험 | 상태 6종 정의 로드 | ① 6×6 모든 (from,to) 쌍에 `canTransition` 호출 ② 허용 목록(8쌍)과 대조 | 허용 8쌍만 true, 나머지 전부 false | 전수 일치 **AND** 예외 0 → Pass |
| **TC-COR-02** | SRS-COR-30 | 시험 | — | ① `TRANSITIONS.unsupported` 조회 | 빈 배열(종결 상태) | 길이 0 → Pass |
| **TC-COR-03** | SRS-COR-32 | 시험 | — | ① 상태 6종 각각에 `canPauseIn` 호출 | corridor·hall만 true | 2개 true **AND** 4개 false → Pass |

### 3.2 설정 무결성 (SRS-COR-20~21)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-COR-04** | SRS-COR-21 | 시험 | — | ① `sanitizeSettings`에 null·문자열·숫자 루트 주입 | 매번 완전한 기본값 객체 | 3케이스 모두 `defaultSettings()` 동치 → Pass |
| **TC-COR-05** | SRS-COR-21 | 시험 | — | ① fov에 30/300/NaN/Infinity/문자열 주입 | 60·100 클램프, 비수치는 기본 90 | 전 케이스 범위 내 **AND** 비수치→90 → Pass |
| **TC-COR-06** | SRS-COR-21 | 시험 | — | ① 정상·손상 필드 혼합 객체 주입 | 손상 필드만 기본값, 정상 필드 보존 | 필드 단위 폴백(전체 객체 아님) → Pass |
| **TC-COR-07** | SRS-COR-21 | 시험 | — | ① enum 필드에 미정의 값 주입(moveSpeed·quality·keyLayout·comfortProfile) | 화이트리스트 밖 값은 기본값 | 4필드 전부 기본값 폴백 → Pass |
| **TC-COR-08** | SRS-COR-21 | 시험 | — | ① sensitivityX/Y에 0·99 주입 | 0.1~3.0 클램프 | 하한 0.1 **AND** 상한 3.0 → Pass |
| **TC-COR-09** | SRS-COR-21 | 시험 | — | ① 불리언 필드에 문자열·숫자 주입 | 비불리언은 기본값 | 전 케이스 기본값 → Pass |

### 3.3 편안한 관람 프로필 (SRS-COR-23~24)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-COR-10** | SRS-COR-24 | 시험 | — | ① `defaultSettings(true)`(reduced-motion) 호출 | comfortProfile='sensitive', bgAnimation≤0.3 | 두 조건 모두 충족 → Pass |
| **TC-COR-11** | SRS-COR-23 | 시험 | — | ① 저감 항목이 켜진 설정에 sensitive 프로필 적용 | headBob=0, motionBlur=false, bgAnimation≤0.3 | 강제 세트 전부 적용 → Pass |
| **TC-COR-12** | SRS-COR-23 | 시험 | — | ① sensitive 적용 상태에서 저감 항목 1개 수정 ② `resolveComfortProfile` 판정 | 수정 전 'sensitive', 수정 후 'custom' | 판정 전이 정확 → Pass |

### 3.4 소유권·생명주기 (자동 시험 밖 — 다른 레인)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-COR-13** | SRS-COR-11 | 검사 | — | ① `node scripts/check-arch.mjs` 실행 | core 밖 `store.coreSet` 0건 | 위반 0 → Pass |
| **TC-COR-14** | SRS-COR-50 | 검사 | — | ① check-arch 실행 | inputSession 밖 포인터락·전체화면 API 0건 | 위반 0 → Pass |
| **TC-COR-15** | SRS-COR-22 | 시연 | 실기 브라우저 | ① 설정 변경 직후 탭 닫기/숨김 ② 재방문 | 보류 쓰기가 플러시되어 설정 보존 | 변경값 복원 → Pass |

## 4. 테스트 실행 순서

A(3.1 상태 머신) → B(3.2 설정) → C(3.3 프로필) — 상호 독립, 순서 무관. D(3.4)는 빌드 게이트(검사)·릴리스 전(시연).

## 5. Pass/Fail 기준

- 시험 유형: `npm run report` 리포트의 TC-ID별 결과에 해당 ID **failed 0** → Pass.
- 검사 유형: 빌드 게이트(check-arch) 종료 코드 0 → Pass.
- 시연 유형: 절차 수행 기록(DEVLOG/`docs/report/`)에 기대 결과 충족 명기 → Pass.
- 본 문서 전체: **필수 SRS에 연계된 TC 100% Pass**가 컴포넌트 합격 조건.

## 6. 추적성

| SRS ID | TC ID | test 스크립트(계획값) |
|---|---|---|
| SRS-COR-30 | TC-COR-01 · TC-COR-02 | `tests/sceneState.test.ts` |
| SRS-COR-32 | TC-COR-03 | `tests/sceneState.test.ts` |
| SRS-COR-21 | TC-COR-04 ~ TC-COR-09 | `tests/settings.test.ts` |
| SRS-COR-24 | TC-COR-10 | `tests/settings.test.ts` |
| SRS-COR-23 | TC-COR-11 · TC-COR-12 | `tests/settings.test.ts` |
| SRS-COR-11 | TC-COR-13 | `scripts/check-arch.mjs` (검사) |
| SRS-COR-50 | TC-COR-14 | `scripts/check-arch.mjs` (검사) |
| SRS-COR-22 | TC-COR-15 | 수동 시연 |

> 번호 규율: 다음 COR TC 번호는 **16번부터** 발급한다. 재배치·재사용 금지, 폐기는 취소선+대체 포인터.
