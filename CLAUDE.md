# Immersive Healing — 구현 규칙 (SRS §9.4 요약)

웹 1인칭 몰입 힐링 전시 MVP. 문서 체인: docs/GOAL.md → mrd/MRD.md → rfp/RFP.md(v1.2) → prd/PRD.md(v1.1) → srs/SRS.md(v1.1). 구현은 SRS가 규범. 개발 기록·문서 역반영은 docs/dev/DEVLOG.md.

## 아키텍처 (위반 시 scripts/check-arch.mjs가 빌드 실패)
- `ui/`는 store에 **액션만 발행**, `scene/`·`audio/`를 import 금지.
- `scene/`·`audio/`는 `publishSys()`로 `sys.*`에만 발행. `ui/` import 금지.
- 상태 전이·설정 write는 `core/` 전용. Pointer Lock/Fullscreen/visibility API는 `core/inputSession.ts` 전유.
- rAF 루프는 `main.ts` 단일 소유, 프레임 순서는 SRS §3.2 고정.

## 오디오 금지 규칙
- three의 `Audio.setVolume()` / `AudioListener.setMasterVolume()` 금지 — 자체 GainNode 버스(3단: userVolume→duck→mute)만.
- `gain.value` 직접 대입 금지 — `setValueAtTime`+`linearRampToValueAtTime`.
- MP3, `MediaElementSource`, 5분급 통짜 AudioBuffer 금지.
- `visibilitychange → ctx.suspend()` 절대 금지 — 단 [2026-08-22 사용자 결정] 소리는 탭이 보일 때만: visibilityBus **게인** 페이드로 처리(클럭은 계속 돈다).
- 오디오 스케줄을 rAF에 매달기 금지 — `ctx.currentTime` 기준.
- PositionalAudio: 생성 즉시 `distanceModel='linear'` 명시 + gain을 spatialBus로 재배선. AudioContext는 graph.ts가 생성 후 `THREE.AudioContext.setContext()`를 AudioListener 생성 전에 호출.

## 비디오 금지 규칙
- `<video loop>` 속성 금지 — 루프는 A/B 스왑 로직 소유.
- 텍스처 업로드는 rVFC 게이팅(`needsUpdate`는 rVFC에서만 세움).
- 영상 파일에 오디오 트랙 금지(-an).

## 렌더링·연출
- `RectAreaLight` 실사용 금지 — 영상 평균색 샘플링 + Point/SpotLight 근사.
- 씬 전환·밝기 변화는 0.5초 이상 페이드. 1초 3회 초과 섬광 금지.
- renderScale 변경 시 렌더타겟 재할당 금지(최대 크기 1회 할당 + viewport 부분 렌더).
- 톤매핑은 파이프라인 말단 1회(렌더러 NoToneMapping).

## 기타
- 키 입력은 `KeyboardEvent.code` + `isComposing||keyCode===229` 가드. 방향키 상시 병행, Q/E/R/F 키보드 시점.
- 설정은 localStorage 단일 키 `ih:settings:v1`, 필드 단위 클램프·폴백.
- three는 0.185.1 정확 핀 — postprocessing peer `<0.186.0` 때문. 임의 업그레이드 금지.
- UI 문구: 치료·치유·효능 주장 금지, '이완/휴식' 수준만 (PRD FR-90).
