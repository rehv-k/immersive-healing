# 조사 E — 브라우저 UX 제약 (RFP 보강 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 대상: 데스크톱 웹, WASD+마우스 룩 1인칭

---

## 1. Pointer Lock API — 1인칭 마우스 룩의 필수 전제

- **필수성**: 무한 회전 시점에는 사실상 필수 (`movementX/Y` 델타 공급). 없으면 커서가 창 밖으로 나가는 순간 입력 단절.
- **사용자 제스처 필수**: `requestPointerLock()`은 transient activation 요구 — **페이지 로드 직후 자동 진입 불가능.**
- **Esc 해제 및 재진입** (가장 중요한 제약):
  - 앱이 `exitPointerLock()` 호출 → 제스처 불필요, 즉시 재락 가능
  - **사용자가 Esc → 새로운 클릭(engagement gesture) 필요.** [추정] Chrome에서 Esc 직후 약 1초 내 재락 시도 실패 보고 다수(명시된 쿨다운 수치는 1차 문서 미확인) — Esc 후 1~1.5초 지연 후 재락 버튼 활성화 권장.
- **지원**: Chrome 22+/Edge/Firefox 14+/Safari macOS 10.1+ 지원. **iOS Safari·Chrome Android 미지원** → 모바일 전면 불가.
- **Chrome 권한 프롬프트 리스크 없음**: Chrome 131의 Pointer Lock 권한 모달 계획은 공식 철회됨.
- **실무 진입 UX 표준** (three.js `PointerLockControls` 예제): blocker 오버레이 + "Click to play" → 클릭 시 lock → unlock 이벤트(=Esc) 시 오버레이 재노출 = **자연스러운 일시정지 메뉴.** Esc를 버그가 아닌 **의도된 일시정지 트리거**로 설계하는 것이 정답.

**RFP 영향**: 자동 몰입 진입 금지 — "클릭하여 시작" + Esc→일시정지→재클릭 복귀 루프를 필수 산출물로. 모바일 지원 제외 명문화.

## 2. Fullscreen API

- `requestFullscreen()`도 사용자 제스처 필수. Pointer Lock과 같은 클릭 안에서 호출이 표준 (MDN: **`requestPointerLock()`을 먼저 호출**).
- Esc 충돌: 동시 사용 시 Esc 한 번의 처리 방식이 브라우저별로 다름 — 브라우저별 QA 항목.
- Keyboard Lock API(Esc 가로채기)는 Chrome/Edge + Safari 26.4+ 지원, **Firefox 미지원** → progressive enhancement로만.

**RFP 영향**: 전체화면은 "권장 옵션", 필수 의존 금지. Esc 처리 정책을 브라우저별 QA에 포함.

## 3. 탭 비활성화/백그라운드 — "오디오는 계속, 렌더링은 정지" 성립

- **requestAnimationFrame**: 백그라운드 탭에서 **완전 정지** (스로틀링 아님).
- **Web Audio**: `AudioContext`는 계속 재생. 오디오 재생 탭은 Chrome 스로틀링에서 **면제**.
- **타이머**: 백그라운드 10초 후 budget throttling — 게임 로직을 setTimeout에 두면 안 됨.
- **Video**: 가장 불안정 — 백그라운드에서 음소거 비디오가 일시정지되는 사례 다수. **WebGL 비디오 텍스처는 프레임 공급 중단.**

**성립 조건 2가지**:
1. 사운드는 `<audio>` 엘리먼트가 아닌 **Web Audio API** 사용
2. rAF **델타타임 클램핑**(예: 최대 0.1초) — 미처리 시 탭 복귀 순간 카메라/물리 순간이동
3. `visibilitychange` 명시적 상태 관리 권장 (Chrome 사례: CPU 75% 절감)

**RFP 영향**: 백그라운드 앰비언트 재생 요구 시 Web Audio 파이프라인 명문화. 배경 영상 텍스처의 백그라운드 지속은 불가를 전제.

## 4. 키보드 레이아웃 — `KeyboardEvent.code`가 표준 해법

- `key`는 레이아웃 종속 문자 반환 → AZERTY에서 WASD 완전 붕괴. **`code`는 물리 키 위치 반환** — AZERTY에서 자동으로 ZQSD가 되어 정상 동작 (MDN 게임 입력 예제의 표준 패턴).
- 주의: 화면 조작 안내(HUD)는 `code`로 만들면 안 됨 (각인 문자 불일치).
- **한국 사용자**: 한글 키보드는 물리적 QWERTY라 레이아웃 문제 없음. 진짜 변수는 **IME** — 한글 입력 모드에서 `key === 'Process'`/`keyCode 229`, Firefox는 조합 중 방향키 keydown 미발생 버그(Bugzilla 1529467). 방어: `if (event.isComposing || event.keyCode === 229) return;` + `code` 기반 구현이 상당 부분 회피. 실기기 QA 필요.

**RFP 영향**: "모든 키보드 입력은 `KeyboardEvent.code` 기반" 명문 요구 + 한글 IME 모드 정상 동작 QA 체크리스트.

## 5. Gamepad API / 대체 입력

- MDN 기준 Baseline Widely available (2017~). 폴링 필수(rAF 루프 내), 게임패드 제스처 전까지 빈 목록.
- **방향키(Arrow keys) 병행: 필수** — 구현 비용 거의 0, 비게이머에게 직관적.
- **게임패드: 권장(가점)** — 아날로그 스틱은 "천천히 부드럽게 이동"에 WASD보다 우월, Pointer Lock 미지원 환경 폴백 가치.

---

## 종합 — RFP 반영 요약

1. 자동 몰입 진입 불가 — "클릭하여 시작"은 우회 불가능한 구조적 요구.
2. Esc = 일시정지로 설계. 재진입은 새 클릭.
3. 데스크톱 전용 명문화 (모바일 Pointer Lock 미지원).
4. 백그라운드 앰비언트는 Web Audio + rAF 델타 클램핑 전제. `<video>` 기반 불가.
5. 입력은 `KeyboardEvent.code` + 방향키 병행이 최소선.
6. 전체화면·Keyboard Lock은 progressive enhancement.

**추가 검증 권장 [추정 항목]**: Safari macOS Pointer Lock Promise/`unadjustedMovement` 지원, Chrome Esc 재락 쿨다운 정확 수치, Chrome `requestFullscreen({keyboardLock})` 신형 문법 — 실기기 테스트 필요.

## 출처
- https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API
- https://developer.mozilla.org/en-US/docs/Web/API/Element/requestPointerLock
- https://www.w3.org/TR/pointerlock-2/
- https://www.chromium.org/developers/design-documents/mouse-lock/
- https://caniuse.com/pointerlock
- https://developer.chrome.com/blog/keyboard-lock-pointer-lock-permission (권한 계획 철회)
- https://threejs.org/examples/misc_controls_pointerlock.html
- https://developer.mozilla.org/en-US/docs/Web/API/Fullscreen_API
- https://webkit.org/blog/17862/webkit-features-for-safari-26-4/
- https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame
- https://developer.chrome.com/blog/background_tabs
- https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API
- https://developer.chrome.com/blog/timer-throttling-in-chrome-88
- https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code
- https://bugzilla.mozilla.org/show_bug.cgi?id=1529467
- https://developer.mozilla.org/en-US/docs/Web/API/Gamepad_API/Using_the_Gamepad_API
- https://caniuse.com/gamepad
