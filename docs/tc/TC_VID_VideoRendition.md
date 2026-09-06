# TC-VID — 비디오 렌디션·재생 시험 명세

| 항목 | 값 |
|---|---|
| Document ID | TC_VID_VideoRendition |
| Version / Status | v1.0 / Draft |
| Parent SRS | [SRS](../srs/SRS.md) §3.8·§6.4·§6.5 (SRS-VID-1~7) |
| Test Scripts | `tests/rendition.test.ts` (초기 계획값 — 실제 연결은 리포트가 집계) |
| 상위 체인 | RFP R-8·R-11 → PRD FR-3x → SRS-VID → **본 TC** |

> **권위 선언**: 요구·시험의 권위는 본 TC 문서다. 리포트는 특정 실행의 evidence다.
> §6의 스크립트 경로는 초기 계획값이며 손으로 유지하지 않는다.

## 1. 테스트 전략

- **1.1 레벨**: 렌디션 선택 순수 함수 단위 시험(빌드 게이트) + 검사(check-arch 자동 일부) + 시연/분석(M0a V8·V15 — A/B 스왑·이음새).
- **1.2 SRS 추적성**: §6 표. 검증 방법 어휘 = 시험·검사·시연·분석.

## 2. 테스트 환경 및 전제

| 구분 | 전제 |
|---|---|
| 단위 시험 | `src/scene/renditionSelect.ts` 순수 함수 — 기기 지표는 인자 주입 |
| 시연/분석 | 실기 + 테스트 미디어(`npm run gen:media`) 또는 실미디어 렌디션 3종 |

## 3. 테스트 그룹

### 3.1 렌디션 선택 (SRS-VID-1)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-VID-01** | SRS-VID-1 | 시험 | 기준 기기(1920×1080·4GB·10Mbps) | ① `chooseRendition` 호출 | '1080p' | 일치 → Pass |
| **TC-VID-02** | SRS-VID-1 | 시험 | 1080p 모니터 + 상급 사양 | ① `chooseRendition` 호출 | '1440p' 도달 가능(감사 F-5) | 일치 → Pass |
| **TC-VID-03** | SRS-VID-1 | 시험 | downlink 4Mbps | ① `chooseRendition` 호출 | '720p' 강등 | 일치 → Pass |
| **TC-VID-04** | SRS-VID-1 | 시험 | preset='low' | ① `chooseRendition` 호출 | 프리셋 캡 적용(≤1080p) | 일치 → Pass |
| **TC-VID-05** | SRS-VID-1 | 시험 | deviceMemory 4GB | ① `chooseRendition` 호출 | 1440p 차단 | ='1080p' → Pass |
| **TC-VID-06** | SRS-VID-6 | 시험 | — | ① `stepDown` 3연쇄 호출 | 1440p→1080p→720p→null 종결 | 캐스케이드 정확 **AND** 종결 → Pass |

### 3.2 재생 계약 (자동 시험 밖 — 다른 레인)

| TC ID | 검증 SRS | 검증 방법 | 전제 | 절차 | 기대 결과 | Pass/Fail 기준 |
|---|---|---|---|---|---|---|
| **TC-VID-07** | SRS-VID-2 | 검사 | — | ① check-arch 실행 + `<video>` 속성 검사 | `loop` 영구 false, muted·playsinline·crossorigin 존재, 영상 오디오 트랙 없음(-an) | 위반 0 → Pass |
| **TC-VID-08** | SRS-VID-3·7 | 시연·분석 | M0a 실기 | ① 스왑 100회 관찰 ② 이음새 30프레임 휘도 자동 판정(V8) | 드롭·이중 디졸브 없음, 휘도 불연속 <1% | 판정 스크립트 합격 → Pass (결과 `docs/report/`) |
| **TC-VID-09** | SRS-VID-4 | 검사·시연 | rVFC 미지원 브라우저 포함 | ① 텍스처 업로드 경로 검사 ② 폴백 경로 실기 확인 | needsUpdate는 rVFC(또는 폴백 게이트)에서만 | 검사 0건 위반 **AND** 폴백 재생 정상 → Pass |
| **TC-VID-10** | SRS-VID-6 | 시연 | 네트워크 차단 도구 | ① 재생 중 렌디션 URL 차단 ② 5초 대기 | 계단식 폴백(최대 3단→720p), 실패 렌디션 세션 블랙리스트, 최종 실패 시 ERR-4 | 폴백 순서 준수 **AND** 무한 재시도 없음 → Pass |

## 4. 테스트 실행 순서

3.1 (독립, 순서 무관) → 3.2는 빌드 게이트(검사)·M0a(시연·분석).

## 5. Pass/Fail 기준

시험 = 리포트 failed 0. 검사 = 빌드 게이트 통과. 시연·분석 = 절차 기록에 기대 결과 충족 명기.
스왑 설계 최종형은 **M0a V15 결과로 확정**(SRS-VID-3) — 그 전 본 문서의 스왑 TC는 현행 설계 기준.

## 6. 추적성

| SRS ID | TC ID | test 스크립트(계획값) |
|---|---|---|
| SRS-VID-1 | TC-VID-01 ~ TC-VID-05 | `tests/rendition.test.ts` |
| SRS-VID-6 | TC-VID-06 · TC-VID-10 | `tests/rendition.test.ts` / 수동 시연 |
| SRS-VID-2 | TC-VID-07 | `scripts/check-arch.mjs` + 검사 |
| SRS-VID-3·7 | TC-VID-08 | M0a V8·V15(`docs/report/`) |
| SRS-VID-4 | TC-VID-09 | 검사 + 실기 |

> 번호 규율: 다음 VID TC 번호는 **11번부터**. 재배치·재사용 금지.
