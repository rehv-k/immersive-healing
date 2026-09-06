---
name: scene-video
description: "IH(몰입 힐링) 씬·렌더링·비디오 계층. Use when: 렌더러, 후처리, 블룸, 톤매핑, 랩어라운드 스크린, 플레이어 이동, A/B 스왑, 루프 이음새, 렌디션, rVFC, renderScale, 프리셋, 적응 히스테리시스, screen.ts, adaptation.ts, 영상이 안 나올 때, 스왑에서 깜빡일 때, fps가 떨어질 때 등. Covers: src/scene/**, src/main.ts(rAF), tests/{adaptation,rendition}.test.ts."
argument-hint: "대상 (예: render, video, quality)"
---

# Scene & Video Layer

three.js 렌더링·공간·비디오 재생 계층. store 구독 → 렌더/재생, 관측값은 `sys.*`로만 발행. 대상은 `$ARGUMENTS`로 받는다.

---

## 흐름 / 핵심 파일

| 단계 | 파일 | 역할 |
|---|---|---|
| 1 | `src/main.ts` | ★rAF 루프 유일 소유 — 프레임 순서는 SRS §3.2 고정(입력→상태→오디오 훅→비디오 게이트→렌더) |
| 2 | `src/scene/renderer.ts` | WebGLRenderer(antialias:false) + 후처리 단일 EffectPass. 톤매핑 말단 1회 |
| 3 | `src/scene/world.ts` | 홀·복도 — 랩어라운드 월 스크린(사용자 결정 v4, 되돌리기 금지) |
| 4 | `src/scene/player.ts` | `e.code` 이동 + IME 가드, Q/E(수평)·R/F(수직) 키보드 시점 90°/s |
| 5 | `src/scene/screen.ts` | ★비디오 A/B 스왑 — `<video loop>` 금지, 스왑 로직이 루프 소유 |
| 6 | `src/scene/renditionSelect.ts` | 렌디션 3종(720/1080/1440p) 선택 순수 함수 (TC-VID-01~06) |
| 7 | `src/scene/quality.ts` · `adaptation.ts` | 프리셋 적용 / 적응 히스테리시스 순수 함수 (TC-QLT-01~06) |

## 적응·품질 상수 (SRS §8.2 — 근거는 감사 F-4·D5·D6)

| 키 | 값 | 의미 |
|---|---|---|
| `FPS_DOWN_THRESHOLD` | 45 | NFR-1 목표 정렬 — 44도 강등 대상(40~45 갭 금지) |
| `DOWN_WINDOWS` / `UP_WINDOWS` | 3 / (코드 참조) | 연속 윈도우 히스테리시스 |
| 프리셋 강등 | scale 플로어에서만 · 최대 2회 · 30s 간격 | 요요 방지 |
| 자동 상향 | **renderScale만** | 프리셋 상향은 수동 전용(감사 D6) |
| renderScale 변경 | 렌더타겟 재할당 금지 | 최대 크기 1회 할당 + viewport 부분 렌더 |

## 비디오 스왑 계약 (SRS-VID-3·7)

- 트리거 여유 **0.5s** 전 B 재생 시작, `uMix` 램프 **0.25s**(램프 ≤ 여유×60%).
- 마스터의 루프-세이프 크로스페이드 구간과 셰이더 램프 구간은 **겹치지 않게**(이중 디졸브 방지).
- B는 사전 워밍업(`play()→pause()`). 텍스처 `needsUpdate`는 rVFC 콜백에서만 — rVFC 부재 시 `currentTime` 변화 감지 폴백 + 프리셋 1단 하향(SRS-VID-4).
- 재생 실패(`error`/`stalled` 5s): 계단식 폴백 최대 3단(720p까지) + 세션 블랙리스트, 최종 실패는 ERR-4.

## 주의·함정

- **이중 톤매핑** — 렌더러는 `NoToneMapping`, `ToneMappingEffect(ACES)`가 말단 1회. 비디오 텍스처 `colorSpace=SRGBColorSpace`+unlit 머티리얼(TC-SCN-03, M0a V8이 판정).
- **RectAreaLight 유혹** — 금지. 영상 평균색 2×2 캔버스 CPU 샘플(주기 ≥250ms) → Point/Spot 근사. 이 경로는 CORS 오염 감지(ERR-10)를 겸한다(SRS-SCN-13).
- **광과민 안전** — 전환 페이드 ≥0.5s, 1초 3회 초과 휘도 반전 금지(TC-SCN-05). 밝기 급변을 만드는 어떤 효과도 이 게이트를 먼저 본다.
- **스왑 설계 확정 전** — 최종형은 M0a V15(캐시 공유·디코더 2세션 실측)로 확정. 그 전에 Blob URL 공유 같은 대안을 코드에 넣지 말 것(문서만 검토).

## 관련 문서(SDLC)

- 요구: `docs/srs/SRS.md` §3.5·§3.7·§3.8·§8 (SRS-SCN·VID·QLT)
- 시험: `docs/tc/TC_SCN_WorldRender.md` · `TC_VID_VideoRendition.md` · `TC_QLT_Adaptation.md`
- 근거: M0 측정 결과는 `docs/report/`에. 임계 변경 시 `CLAUDE.md` §7 정책 메모 정합.
