# Immersive Healing (가칭) — 일몰 · 상영관

박물관 실감영상관의 압도적 시청각 경험을 웹 브라우저에서 — 어두운 복도를 직접 걸어 들어가, 대형 스크린의 일몰과 공간을 감싸는 소리 속에서 원하는 만큼 머무는 몰입 전시 MVP.

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

`docs/` — GOAL → MRD → RFP(v1.2) → PRD(v1.1) → SRS(v1.2) → TC(`docs/tc/`) 문서 체인 + 설계 결정 기록(`docs/SDD.md`) + 적대 감사 보고서(`docs/audit/`) + 개발 기록(`docs/dev/DEVLOG.md`). 구현 규범은 SRS, 시험 권위는 TC 문서, AI 협업 컨텍스트는 `CLAUDE.md`(+`.claude/skills/` 5종).

## 현재 상태

- MVP 전 기능 구현: 게이트 → 복도 입장 연출 → 상영관 루프 상영 → 일시정지/퇴장, HRTF 공간 오디오(3버스 믹서), A/B 무결점 루프 스왑, 품질 자동 적응, comfort 설정 세트, 감각 안전 규칙.
- 미디어·앰비언스는 로컬 개발용 합성본 — 정식 소스 선정은 `docs/dev/DEVLOG.md`의 사용자 확인 항목 참조.
