# SDD — Immersive Healing 설계 문서

> **Software Design Description** · v0.1 (2026-09-06) · Draft
> 방법론 지침(부록 3 약점 #4 완화)에 따라 **「설계 결정 기록」 표 하나로 시작**한다.
> 구조·데이터·시퀀스 장은 SRS §2~§6이 실질을 담고 있어 당분간 중복 작성하지 않는다(문서를 늘리지 않는 규칙).
> 상위: [SRS](srs/SRS.md). 결정의 임시 기착지는 [DEVLOG](dev/DEVLOG.md) — 굳은 결정만 여기로 승격한다.

## 1. 설계 결정 기록 (Decision Record)

상태: `Accepted`(유지) / `Open`(재검토 예정) / `Superseded`(대체됨 — 행 삭제 금지)

| ID | 결정 | 이유 | 반증된 대안 | 영향 | 상태 |
|---|---|---|---|---|---|
| D-01 | ui/core/scene·audio **3축 계층 + 기계 강제**(check-arch 빌드 게이트) | 에이전트·사람 모두 규율만으로는 경계를 지키지 못함(감사 §9.2) | 리뷰 규율만: v1.0에서 실패 판정 | `scripts/check-arch.mjs`, SRS §2.1 | Accepted |
| D-02 | **랩어라운드 월 스크린** — 입구 제외 홀 벽면 5세그먼트, 직교 벽면 유지(원통 아님). 절차 일몰을 월드 좌표 파노라마로 | 단일 평면은 좌우가 어두워 몰입 단절(사용자 결정 v4, 2026-08-22) | 단일 평면 스크린(v1~v3): 좌우 어두움의 근본 해결 불가 | `src/scene/world.ts`·`screen.ts`, 실영상 채택 시 파노라마/멀티면 소스 요구 발생 | Accepted |
| D-03 | 탭 가시성 오디오 = **visibilityBus 게인 페이드**(숨김 0.25s→0, 복귀 0.6s→1), `ctx.suspend()`는 계속 금지 | 소리는 탭이 보일 때만(사용자 결정 2026-08-22) + 클럭·스케줄 유지 | ① 백그라운드 재생 지속(구 FR-44/R-7): 사용자 폐기 ② suspend(): 복귀 시 스케줄 전체 어긋남 | SRS-AUD-7, `src/audio/graph.ts` | Accepted |
| D-04 | 스크린 블룸은 **휘도 임계 BloomEffect(threshold 0.85)** — 발광 스크린만 통과 | SelectiveBloom과 동일 목적을 더 낮은 비용·단순 구성으로 달성 | SelectiveBloomEffect: 레이어 관리 비용, 효과 동일 | SRS-SCN-12(등가 구현 허용 문구), `src/scene/renderer.ts` | Accepted |
| D-05 | 스필 라이트 평균색 = **2×2 캔버스 drawImage CPU 샘플(주기 250ms)** | 구현 단순·비용 미미, CORS 오염 감지(ERR-10) 겸용 | GPU 다운샘플+fence 비동기 읽기: 복잡도 대비 이득 없음(이 해상도에서) | SRS-SCN-13, `src/scene/screen.ts` | Accepted |
| D-06 | renderScale 변경을 현재 **setSize 재할당**으로 구현(규범은 부분 렌더) | 변경 빈도가 히스테리시스로 제한돼 실용상 스파이크 미미 추정 — **M0a 실측 후 결정** | — (실측 전) | SRS §8.2와 구현 격차로 기록, TC-QLT-07 검사 대상 | **Open** (M0a 게이트) |
| D-07 | detect-gpu는 **생성 즉시 Low 프리셋 + 감지 4초 타임박스** | 네트워크 벤치마크 지연/실패 시 렌더러 0 크기 잔류 버그 실측 | 감지 완료 대기: 무한 대기 경로 존재 | SRS §8.2 "미판정→Low" 규범의 강화 구현 | Accepted |
| D-08 | 절차 생성 일몰 셰이더를 **기본 모드**로, 영상 파이프라인은 `?video` 테스트 경로 | 합성 테스트 영상이 사실상 정지 화면(사용자 피드백) — 실미디어 채택 전 임시 | — | 실영상 소스 채택(사용자 확인 항목) 시 기본 복귀 | Accepted (임시) |
| D-09 | **SDLC 방법론 이식**: `TC-<모듈>-NN` ID 가족 신설 + Vitest 제목 태깅 + `generate-report.mjs` 자동 대조(orphan=빌드 게이트) + CLAUDE.md 9섹션 + 스킬 5종 | "이 코드가 어떤 요구를 지키는가"를 번호로 답하기 위함. 기존 `SRS-<모듈>-NN`은 append-only 규율에 따라 유지(FR 재번호화 안 함) | 전면 재번호화(FR-<COMP>-NN 통일): 기존 v1.1 baseline 추적성 파괴 — 기각 | `docs/tc/`, `scripts/generate-report.mjs`, `.claude/skills/`, `CLAUDE.md` | Accepted |

## 2. 이후 장 (예약 — 필요 시점에 작성)

프로세스 구조·데이터 모델·시퀀스는 SRS §2(아키텍처)·§4(인터페이스)·§5(데이터)·§6(상태·흐름)이 규범을 소유한다.
SDD 고유 장(동시성 상세, 장애 복구, 배포 토폴로지)은 배포 준비 단계(M3 전)에 신설한다.
