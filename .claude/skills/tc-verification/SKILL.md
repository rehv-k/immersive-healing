---
name: tc-verification
description: "IH(몰입 힐링) 시험·검증 자동화 계층. Use when: 테스트 작성·실행, TC-ID 태깅, TC 문서, 커버리지 리포트, orphan, 미커버, SUITES 등록, vitest, JUnit, generate-report, ci-report.md, 리포트가 빌드를 깰 때, 태그가 집계 안 될 때, 커밋 전 검증 등. Covers: tests/**, scripts/generate-report.mjs, scripts/check-arch.mjs, docs/tc/**, docs/report/ci-report.md."
argument-hint: "대상 (예: cor, qlt, vid, all)"
---

# TC Verification Layer

TC 문서 ↔ 테스트 ↔ 리포트 자동 대조 장치. 흐름: `docs/tc/` 정의 → 테스트 제목 `[TC-<COMP>-NN]` 태깅 → `npm run report` 집계·대조. 대상은 `$ARGUMENTS`로 받는다.

---

## 흐름 / 핵심 파일

| 단계 | 파일 | 역할 |
|---|---|---|
| 1 | `docs/tc/TC_<COMP>_*.md` | TC-ID **정의 원천**(권위). §3 표에 전제·절차·기대·Pass/Fail |
| 2 | `tests/*.test.ts` | 제목에 완전형 `[TC-<COMP>-NN]` 포함(복수 가능) — pytest 마커의 Vitest 등가 |
| 3 | `scripts/generate-report.mjs` | vitest 실행(JUnit) → TC-ID 집계 → 문서 대조 → `docs/report/ci-report.md` |
| 4 | `scripts/check-arch.mjs` | 검사(Inspection) 레인 자동화 — 의존 규칙·API 전유·안티패턴 |

## 권위 체계 (방법론 3단계형)

- **요구·시험의 권위 = TC 문서.** 리포트는 특정 실행의 evidence — 검사·시연·분석 유형을 자동 PASS/미커버로 재정의하지 않는다.
- **orphan**(태그됐으나 문서 정의 없음) = 오타 또는 드리프트 → **리포트가 exit 1로 빌드를 깬다. 커밋 전 0 필수.**
- **미커버**(문서에 있으나 태그 없음) = 다른 레인(검사·시연·분석) 포함 — 부끄러운 게 아니라 범위 선언. 각 TC 문서 §3의 검증 방법 열이 레인을 명시한다.
- TC 문서 헤더의 Test Scripts·§6 스크립트 경로는 초기 계획값 — **손으로 유지하지 않는다**(리포트가 실제 연결을 안다).

## 새 테스트 추가 절차 (전부 같은 커밋에)

1. `docs/tc/TC_<COMP>_*.md` §3에 **다음 빈 번호**로 TC 행 추가(§6 추적성도) — 번호 재사용 금지.
2. 테스트 제목에 `[TC-<COMP>-NN]` 태깅. 한 테스트가 여러 TC를 커버하면 제목에 나열.
3. 새 테스트 **파일**이면 `generate-report.mjs`의 `SUITES` 배열에 등록(미등록은 리포트가 경고).
4. `npm run report` → TC-ID별 결과 ❌ 없음 + orphan 0 확인.

## 주의·함정 (이식 시 실제로 밟은 지뢰 포함)

- **`classname=`이 `name=` 정규식에 걸림** — JUnit 속성 파싱은 공백 경계(`\sname=`) 필수. generate-report.mjs에 주석으로 박아둠. 파서 수정 시 이 케이스 회귀 확인.
- **문서에 "다음 번호는 TC-X-NN부터" 식 완전형 ID를 쓰면** 정의로 오집계된다 — 번호만 쓴다("9번부터"). 반대로 **추적성 표에는 완전형 ID를 한 번은** 쓴다(축약 `TC-VID-01·02`는 02가 안 잡힘 — 리포트 대조가 아니라 사람 검색용 함정).
- **TC 문서 파일명 접두 규칙** — `TC_<COMP>_*.md`의 `<COMP>`와 일치하는 ID만 그 문서의 정의로 센다(교차 인용은 무시됨). 새 컴포넌트 문서는 파일명부터 정확히.
- **리포트 손 편집 금지** — `docs/report/ci-report.md`는 자동 생성. 날짜별 사본을 커밋하지 말 것.
- **테스트 약화 금지** — 시험이 깨졌는데 요구가 맞다면 코드를 고친다. 요구가 바뀐 거라면 SRS·TC 문서를 같은 커밋에 역정합.

## 관련 문서(SDLC)

- 시험 정의: `docs/tc/` 6종(COR·QLT·VID·AUD·SCN·UI) — 기준 모델은 `TC_COR_CoreStateSettings.md`
- 검증 계층 정의: `docs/srs/SRS.md` §9.2 (시험·검사·시연·분석 4종 어휘)
- 커밋 규약·체크리스트: `CLAUDE.md` §9.
