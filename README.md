# Immersive Healing (가칭) — 일몰 · 몰입 홀

박물관 실감영상관의 압도적 시청각 경험을 웹 브라우저에서 — 어두운 복도를 걸어 들어가면, 입구를 제외한 타원 홀의 벽 전체가 하나의 하늘과 바다로 이어지고 바닥까지 그 빛이 비친다. 골든아워에서 별이 뜨는 밤, 새벽까지 10분의 순환 속에서 원하는 만큼 머무는 몰입 전시 MVP.

## 실행

```bash
npm install
npm run gen:media   # 로컬 테스트용 합성 일몰 렌디션 생성 (최초 1회, FFmpeg 자동 포함)
npm run dev         # http://localhost:5173  (?debug 로 측정 오버레이)
```

- 데스크톱 Chrome/Edge/Firefox 전용 (Pointer Lock 필요).
- 조작: 이동 WASD/방향키 · 시점 마우스 또는 Q/E/R/F · 일시정지 Esc · 음소거 M.

## 검증

```bash
npm test        # 단위 테스트 (설정 클램프 · 상태 전이 매트릭스 · 렌디션 선택 · 적응 히스테리시스)
npm run report  # TC 커버리지 리포트 → docs/report/ci-report.md (TC 문서 대조, orphan 게이트)
npm run build   # tsc + vite build + 번들 예산(≤300KB gzip) + 라이선스 허용목록 + 아키텍처 규칙 + TC 리포트 게이트
```

테스트는 제목의 `[TC-<모듈>-NN]` 태그로 `docs/tc/` 시험 문서와 자동 대조된다 — "이 코드가 어떤 요구를 지키는가"는 번호로 답한다.

## 문서

`docs/` — GOAL → MRD → RFP(v1.3) → PRD(v1.2) → SRS(v1.3) → TC(`docs/tc/`) 문서 체인 + 설계 결정 기록(`docs/SDD.md`) + 적대 감사 보고서(`docs/audit/`) + 개발 기록(`docs/dev/DEVLOG.md`). 구현 규범은 SRS, 시험 권위는 TC 문서, AI 협업 컨텍스트는 `CLAUDE.md`(+`.claude/skills/` 5종).

## 현재 상태

- v5 몰입 홀: 타원(15×11m) 연속 리본 스크린 + 해석적 반사 바닥·천장(추가 렌더 패스 0) + 10분 하늘 순환(골든아워→블루아워→별밤→새벽) + 위상 연동 5레이어 앰비언스·벽면 정위 5소스, 선택형 호흡 리듬 빛. 게이트→복도 입장 연출, A/B 루프 스왑, 품질 자동 적응, comfort 세트, 감각 안전 규칙 유지.
- 미디어·앰비언스는 로컬 개발용 합성본 — 정식 소스 선정은 `docs/dev/DEVLOG.md`의 사용자 확인 항목 참조.
