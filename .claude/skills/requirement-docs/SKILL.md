---
name: requirement-docs
description: "IH(몰입 힐링) 요구문서 체인 운영 프로세스. Use when: 문서 갱신, 역반영, 역정합, 요구 추가·폐기, SRS 개정, TC 문서 작성, 추적성, 번호 발급, baseline, MRD, RFP, PRD, SRS, SDD, DEVLOG, 감사, 요구가 코드와 어긋날 때, 어느 문서에 쓸지 애매할 때 등. Covers: docs/{mrd,rfp,prd,srs,tc}/**, docs/SDD.md, docs/dev/DEVLOG.md, docs/report/**, docs/audit/**."
argument-hint: "대상 (예: srs, tc, devlog)"
---

# Requirement Docs Process

문서 체인: GOAL → MRD → RFP(R-NN) → PRD(FR/NFR-NN) → **SRS(SRS-<모듈>-NN, 규범)** → **TC(TC-<모듈>-NN)**. 구현은 SRS가 규범, 시험은 TC가 권위. 대상은 `$ARGUMENTS`로 받는다.

---

## 흐름 / 핵심 파일

| 층 | 파일 | ID 가족 | 핵심 질문 |
|---|---|---|---|
| MRD | `docs/mrd/MRD.md` | — | 왜 이 시장에 필요한가 |
| RFP | `docs/rfp/RFP.md` | R-NN | 이번 개발에서 무엇을 요구하는가 |
| PRD | `docs/prd/PRD.md` | FR-NN·NFR-NN | 사용자가 어떤 경험을 얻는가 |
| SRS | `docs/srs/SRS.md` | **SRS-<모듈>-NN** | 시스템이 무엇을 얼마나 잘 보장하는가 |
| SDD | `docs/SDD.md` | D-NN | 어떤 구조·기술로 실현하는가(설계 결정 기록) |
| TC | `docs/tc/TC_<모듈>_*.md` | **TC-<모듈>-NN** | 충족을 어떻게 증명하는가 |

모듈 코드(SRS §1.2): COR / SCN / VID / AUD / UI / QLT / ANL / ERR / DEP. 근거 계층은 `docs/report/`(측정)·`docs/*/research/`(조사)·`docs/audit/`(감사).

## 번호 규율 (어기면 추적성이 죽는다)

- **append-only**: 다음 빈 번호부터. 기존 번호 재배치·재사용 절대 금지.
- 폐기해도 행을 지우지 않는다 — 취소선 + `[폐기 — <대체 ID>로 대체]`.
- 요구문서 본문에 구현 상태(구현됨/미구현/파일 경로/함수명) 금지 — 요구는 "보장해야 한다"로 쓴다. 상태는 리포트·git이 안다.
- 정량 합격선은 평가 **전에 lock**(사후 조정 금지). 연구 아이디어를 [필수]로 올리지 않는다.

## 역반영 6단계 (코드 동작·정책이 바뀌었을 때)

1. **번호 잇기** — 해당 모듈의 다음 빈 SRS/TC 번호 확인.
2. **SRS** — 검증 가능 문구 + 검증 방법(시험/검사/시연/분석)으로 해당 절 갱신. 상위(RFP·PRD) 영향 시에만 상위도.
3. **TC** — `docs/tc/` §3에 전제·절차·기대·Pass/Fail 행 추가, §6 추적성 정합.
4. **테스트** — 시험 레인이면 `[TC-…]` 태깅 + SUITES 등록(→ tc-verification 스킬).
5. **컨텍스트** — `CLAUDE.md` §2/§5/§7 + 해당 SKILL.md 정합.
6. **확인** — `npm run report`(orphan 0) 후 문서·코드·테스트를 **같은 커밋에**.

## 배치 판정 — "이 내용 어디에 쓰지?"

순서대로 물어 처음 "예"인 곳: ① 시장·고객 이유 → MRD ② 이번 범위의 제공 결과 → RFP ③ 사용자가 보고 수행하는 경험 → PRD ④ 관찰 가능하게 보장할 동작 → SRS ⑤ 구조·기술·알고리즘 → SDD ⑥ 합격 확인 방법 → TC ⑦ 그날그날 작업 기록 → DEVLOG.

## 주의·함정

- **SRS baseline 존중** — v1.1은 감사 반영 baseline. 컴포넌트-한정 변경으로 시스템 공통 합격선(45fps 등)을 건드리지 않는다. 개정 시 헤더 버전·변경 이력 갱신.
- **추적표에 비공식 식별자 금지** — "피드백 #3" 같은 건 정식 SRS/TC ID로 승격한 뒤 추적.
- **문서를 늘리지 않는다** — ADR·API 명세·데이터 사전을 따로 만들지 말고 SDD 결정 기록·SRS §4·§5에 흡수.
- **DEVLOG는 체인 밖** — 결정의 임시 기착지. 굳은 결정은 SDD/SRS로 승격하고 DEVLOG에는 승격 위치를 링크.

## 관련 문서(SDLC)

- 방법론 원문: `프로젝트_운영_방법론_이식_가이드라인.md` — **저장소 밖 로컬 문서**(경로는 각자 환경에 따라 다름).
- 동기화 규칙·커밋 규약: `CLAUDE.md` §9. 시험 장치: tc-verification 스킬.
