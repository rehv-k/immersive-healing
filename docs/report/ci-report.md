# TC 커버리지 리포트 (자동 생성 — 손 편집 금지)

> 생성: `node scripts/generate-report.mjs` · 2026-09-10T10:54:28.716Z
> 이 리포트는 **특정 실행의 evidence**다 — 요구·시험의 권위는 `docs/tc/` TC 문서다.
> 미커버에는 다른 레인(검사·시연·분석)이 포함된다 — 각 TC 문서 §3의 검증 방법 열 참조.

## ① 요약

- 테스트 파일 7 · 테스트 35 (통과 35 / 실패 0 / 건너뜀 0)
- TC 문서 자동시험 연결 5 / 6
- **orphan 0건** (게이트: 0이어야 함) · 미커버 32건

## ② TC 문서 커버리지

| TC 문서 | 자동시험 | 담당 테스트 파일 |
|---|---|---|
| `TC_AUD_AudioGraph.md` | ✅ 2/10 | `tests/phaseMix.test.ts` |
| `TC_COR_CoreStateSettings.md` | ✅ 13/16 | `tests/sceneState.test.ts` · `tests/settings.test.ts` |
| `TC_QLT_Adaptation.md` | ✅ 6/9 | `tests/adaptation.test.ts` |
| `TC_SCN_WorldRender.md` | ✅ 7/14 | `tests/hallGeometry.test.ts` · `tests/skyCycle.test.ts` |
| `TC_UI_Overlay.md` | — (검사·시연 레인) | — |
| `TC_VID_VideoRendition.md` | ✅ 6/10 | `tests/rendition.test.ts` |

## ③ TC-ID별 결과

| 상태 | TC-ID | 통과/실패/건너뜀 | 테스트 |
|---|---|---|---|
| ✅ | TC-AUD-09 | 1/0/0 | `phase mix > [TC-AUD-09] every layer stays under its ceiling and no phase is louder than day` |
| ✅ | TC-AUD-10 | 1/0/0 | `phase mix > [TC-AUD-10] night weight is continuous, monotone and reaches both ends` |
| ✅ | TC-COR-01 | 1/0/0 | `transition matrix > [TC-COR-01] allows exactly the specified transitions` |
| ✅ | TC-COR-02 | 1/0/0 | `transition matrix > [TC-COR-02] unsupported is terminal` |
| ✅ | TC-COR-03 | 1/0/0 | `transition matrix > [TC-COR-03] pause is only reachable in corridor/hall (SRS-COR-32)` |
| ✅ | TC-COR-04 | 1/0/0 | `sanitizeSettings > [TC-COR-04] returns defaults for null/garbage roots` |
| ✅ | TC-COR-05 | 1/0/0 | `sanitizeSettings > [TC-COR-05] clamps fov into 60..100 and rejects NaN/Infinity` |
| ✅ | TC-COR-06 | 1/0/0 | `sanitizeSettings > [TC-COR-06] falls back per-field, not whole-object` |
| ✅ | TC-COR-07 | 1/0/0 | `sanitizeSettings > [TC-COR-07] rejects unknown enum values` |
| ✅ | TC-COR-08 | 1/0/0 | `sanitizeSettings > [TC-COR-08] sensitivity clamps to 0.1..3.0` |
| ✅ | TC-COR-09 | 1/0/0 | `sanitizeSettings > [TC-COR-09] booleans reject non-boolean values` |
| ✅ | TC-COR-10 | 1/0/0 | `sanitizeSettings > [TC-COR-10] prefers-reduced-motion drives defaults` |
| ✅ | TC-COR-11 | 1/0/0 | `comfort profile > [TC-COR-11] sensitive forces the comfort set` |
| ✅ | TC-COR-12 | 1/0/0 | `comfort profile > [TC-COR-12] breaking a sensitive profile resolves to custom` |
| ✅ | TC-COR-16 | 1/0/0 | `sanitizeSettings > [TC-COR-16] breathGuide defaults off and rejects non-boolean values` |
| ✅ | TC-QLT-01 | 1/0/0 | `adaptation > [TC-QLT-01] threshold aligns with NFR-1 target 45 (audit F-4)` |
| ✅ | TC-QLT-02 | 1/0/0 | `adaptation > [TC-QLT-02] scales down after 3 low windows` |
| ✅ | TC-QLT-03 | 1/0/0 | `adaptation > [TC-QLT-03] 40..45 gap no longer stalls below target (fps 44 triggers downscale)` |
| ✅ | TC-QLT-04 | 1/0/0 | `adaptation > [TC-QLT-04] drops preset only at scale floor, max twice, 30s apart` |
| ✅ | TC-QLT-05 | 1/0/0 | `adaptation > [TC-QLT-05] never auto-upgrades preset; only renderScale rises` |
| ✅ | TC-QLT-06 | 1/0/0 | `adaptation > [TC-QLT-06] manual preset never auto-drops preset` |
| ✅ | TC-SCN-08 | 1/0/0 | `hall ellipse > [TC-SCN-08] perimeter matches Ramanujan within 0.2% (≈82m, 국중박 60m 참조 초과)` |
| ✅ | TC-SCN-09 | 1/0/0 | `hall ellipse > [TC-SCN-09] panorama arc is monotone clockwise and the sun sits at its midpoint` |
| ✅ | TC-SCN-10 | 1/0/0 | `hall ellipse > [TC-SCN-10] thetaAtClockwiseArc inverts clockwiseArc to <1e-3 rad` |
| ✅ | TC-SCN-11 | 2/0/0 | `hall ellipse > [TC-SCN-11] insideEllipse honours the wall-clearance margin`<br>`hall ellipse > [TC-SCN-11] ribbon arcs are continuous and the LUT is monotone` |
| ✅ | TC-SCN-12 | 1/0/0 | `sky cycle > [TC-SCN-12] loops seamlessly: t=0 and t=CYCLE agree` |
| ✅ | TC-SCN-13 | 1/0/0 | `sky cycle > [TC-SCN-13] is flash-free: per-second change stays tiny over the whole cycle` |
| ✅ | TC-SCN-14 | 1/0/0 | `sky cycle > [TC-SCN-14] stars and moon only after civil twilight; phases run in order` |
| ✅ | TC-VID-01 | 1/0/0 | `chooseRendition > [TC-VID-01] defaults to 1080p on the baseline device` |
| ✅ | TC-VID-02 | 1/0/0 | `chooseRendition > [TC-VID-02] reaches 1440p on a 1080p monitor with good specs (audit F-5 fix)` |
| ✅ | TC-VID-03 | 1/0/0 | `chooseRendition > [TC-VID-03] drops to 720p on slow connections` |
| ✅ | TC-VID-04 | 1/0/0 | `chooseRendition > [TC-VID-04] is capped by preset (low ≤ 1080p)` |
| ✅ | TC-VID-05 | 1/0/0 | `chooseRendition > [TC-VID-05] low memory prevents 1440p` |
| ✅ | TC-VID-06 | 1/0/0 | `chooseRendition > [TC-VID-06] stepDown cascades and terminates` |

## ④ TC 문서 대조

| 컴포넌트 | 문서 정의 | 태그됨 | 미커버(다른 레인 포함) |
|---|---|---|---|
| AUD | 10 | 2 | TC-AUD-01 · TC-AUD-02 · TC-AUD-03 · TC-AUD-04 · TC-AUD-05 · TC-AUD-06 · TC-AUD-07 · TC-AUD-08 |
| COR | 16 | 13 | TC-COR-13 · TC-COR-14 · TC-COR-15 |
| QLT | 9 | 6 | TC-QLT-07 · TC-QLT-08 · TC-QLT-09 |
| SCN | 14 | 7 | TC-SCN-01 · TC-SCN-02 · TC-SCN-03 · TC-SCN-04 · TC-SCN-05 · TC-SCN-06 · TC-SCN-07 |
| UI | 7 | 0 | TC-UI-01 · TC-UI-02 · TC-UI-03 · TC-UI-04 · TC-UI-05 · TC-UI-06 · TC-UI-07 |
| VID | 10 | 6 | TC-VID-07 · TC-VID-08 · TC-VID-09 · TC-VID-10 |

## ⑤ 파일별 상세

| 파일 | 통과 | 실패 | 건너뜀 | 실패 케이스 |
|---|---|---|---|---|
| `tests/adaptation.test.ts` | 6 | 0 | 0 | — |
| `tests/hallGeometry.test.ts` | 5 | 0 | 0 | — |
| `tests/phaseMix.test.ts` | 2 | 0 | 0 | — |
| `tests/rendition.test.ts` | 6 | 0 | 0 | — |
| `tests/sceneState.test.ts` | 3 | 0 | 0 | — |
| `tests/settings.test.ts` | 10 | 0 | 0 | — |
| `tests/skyCycle.test.ts` | 3 | 0 | 0 | — |
