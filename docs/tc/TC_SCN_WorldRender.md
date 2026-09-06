# TC-SCN — 씬·렌더링·입력 시험 명세

| 항목 | 값 |
|---|---|
| Document ID | TC_SCN_WorldRender |
| Version / Status | v1.0 / Draft |
| Parent SRS | [SRS](../srs/SRS.md) §2.1·§3.5·§3.7 (SRS-SCN-1x·2x·3x, SRS-COR-40) |
| Test Scripts | (자동 시험 미배정 — 검사·시연·분석 중심 컴포넌트) |
| 상위 체인 | RFP R-1~R-5 → PRD FR-1x·2x → SRS-SCN → **본 TC** |

> **권위 선언**: 요구·시험의 권위는 본 TC 문서다. 리포트는 특정 실행의 evidence다.
> 렌더링·공간은 시각 품질 의존이 커서 **검사·시연·분석(M0)이 1차 레인**이다. 리포트 "미커버"는 레인 배치다.

## 1. 테스트 전략

- **1.1 레벨**: 정적 검사(check-arch — 의존 규칙·API 전유, 빌드 게이트) + 실기 시연 + M0 실측(분석).
- **1.2 SRS 추적성**: §6 표. 충돌·이동 로직이 순수 함수로 분리되면 시험 레인으로 승격, **8번부터** 발급.

## 2. 테스트 환경 및 전제

| 구분 | 전제 |
|---|---|
| 검사 | `node scripts/check-arch.mjs`(빌드 게이트) + 코드 검사 |
| 시연 | Chrome/Edge/Firefox 실기. 결과는 DEVLOG 또는 `docs/report/` |
| 분석 | M0a/M0b 절차(SRS §9.1) — 결과는 `docs/report/` 근거 계층 |

## 3. 테스트 그룹

### 3.1 아키텍처·프레임 규율

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-SCN-01** | §2.1 의존 규칙 | 검사 | — | ① check-arch 실행 | ui↔scene/audio 상호 import 0건 | 위반 0 → Pass |
| **TC-SCN-02** | SRS-SCN-14 · SRS-COR-40 | 검사 | — | ① rAF 호출부 grep | rAF 루프는 `main.ts` 단일 소유, §3.2 순서 준수 | main.ts 밖 rAF 루프 0건 → Pass |

### 3.2 렌더링 계약 (SRS-SCN-10~13)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-SCN-03** | SRS-SCN-11 | 검사·분석 | — | ① 렌더러 설정 검사 ② M0a V8 컬러 검증 | `NoToneMapping` + 말단 `ToneMappingEffect` 1회, 이중 톤매핑 없음 | 검사 일치 **AND** V8 합격 → Pass |
| **TC-SCN-04** | SRS-SCN-13 | 검사 | — | ① `RectAreaLight` grep ② 스필 라이트 경로 검사 | RectAreaLight 0건, 평균색 샘플링→Point/Spot 근사 | 0건 **AND** 근사 경로 존재 → Pass |
| **TC-SCN-05** | SRS-SCN-23 | 시연 | 실기 | ① 전 상태 전이 주행 관찰 | 전환 전부 페이드 ≥0.5초, 1초 3회 초과 휘도 반전 없음 | 육안 위반 0 → Pass |

### 3.3 입력·이동 (SRS-SCN-30~33)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-SCN-06** | SRS-SCN-30 | 검사·시연 | 한글 IME 실기 | ① 키 핸들러 검사(`e.code` + `isComposing\|\|keyCode===229` 가드) ② 한글 IME 상태 실기 | WASD+방향키 병행, IME 조합 중 오입력 없음 | 가드 존재 **AND** 실기 오동작 0 → Pass |
| **TC-SCN-07** | SRS-SCN-31·33 | 시연 | 실기 | ① Q/E/R/F 키보드 시점 ② invertY·FOV 변경 | 90°/s 회전, FOV 즉시 반영, 자동 FOV 연출 없음 | 전 항목 동작 → Pass |

## 4. 테스트 실행 순서

3.1(검사)은 빌드 게이트. 3.2·3.3의 시연은 릴리스 전, 분석은 M0 시점.

## 5. Pass/Fail 기준

검사 = 빌드 게이트 통과. 시연 = 절차 기록 명기. 분석 = M0 보고서 합격선 충족(정량 목표 사전 lock).

## 6. 추적성

| SRS ID | TC ID | test 스크립트(계획값) |
|---|---|---|
| SRS §2.1 | TC-SCN-01 | `scripts/check-arch.mjs` |
| SRS-SCN-14 · SRS-COR-40 | TC-SCN-02 | 검사 |
| SRS-SCN-11 | TC-SCN-03 | 검사 + M0a V8 |
| SRS-SCN-13 | TC-SCN-04 | 검사 |
| SRS-SCN-23 | TC-SCN-05 | 수동 시연 |
| SRS-SCN-30 | TC-SCN-06 | 검사 + 실기 |
| SRS-SCN-31·33 | TC-SCN-07 | 수동 시연 |

> 번호 규율: 다음 SCN TC 번호는 **8번부터**. 재배치·재사용 금지.
