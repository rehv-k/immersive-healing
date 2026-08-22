# 조사 J — 오디오 스택·앱 구조 (PRD 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 소스 코드·표준 문서 직접 확인

## ① 오디오 스택 — 권장: three.js PositionalAudio + 자체 GainNode 믹서 하이브리드

| | three.js PositionalAudio | 순수 Web Audio | Howler.js | Babylon Audio v2 |
|---|---|---|---|---|
| HRTF | **생성자에서 'HRTF' 강제** | equalpower 기본(수동 변경) | 기본 HRTF | 옵션 지정 |
| 씬 동기화 | **자동** (Object3D add) | 수동 | 수동 | 자동 |
| 크로스페이드 | setVolume은 0.01s 고정 — **자체 GainNode 필요** | 완전 자유 | fade() 내장 | ramp 지원 |
| 유지보수 | 활발 (r184+) | 표준 | **~3년 정체** | 활발(엔진 전환 필요) |

근거: three.js가 HRTF 설정과 panner 위치 자동 동기화라는 가장 귀찮은 두 가지를 해결. `.gain`/`.panner`/`.context` 모두 public이라 순수 Web Audio 자유도 유지. Howler는 3D 동기화 자작 필요+정체. **Omnitone/Resonance Audio Web SDK는 2026-04 아카이브 — 신규 채택 금지.**

## ② PositionalAudio 실무 확정 사항

- **HRTF가 이미 기본** (소스: `this.panner.panningModel = 'HRTF'`) — 추가 작업 없음.
- **distanceModel은 three.js가 미설정 → 브라우저 기본 `'inverse'` 상속. 반드시 `'linear'`로 명시 변경 권장**:
  - inverse/exponential은 점근적이라 음량이 절대 0에 도달하지 않음 → 음원 4~8개가 배경에 누적 잡음처럼 깔림.
  - linear는 maxDistance에서 깨끗이 0 — "음원 예산" 통제 가능. 예: refDistance 4~8, maxDistance = 공간 대각선보다 크게(경계 불연속 은폐), rolloffFactor 1.
  - 임의 곡선이 필요하면: `rolloffFactor 0`으로 panner는 방향(HRTF)만 담당 + 거리 감쇠는 자체 GainNode 커브.
- **알려진 이슈**:
  - three.js #15422 (Chrome, 미해결): start/stop 반복 + panner 갱신 반복 시 점진적 성능 저하 → **음원은 계속 켜두고 gain 0으로 무음화, `if (!sound.isPlaying) return;` 가드**.
  - #20920: 음원 초근접 시 스터터 → refDistance 충분히 크게.
  - `setVolume()` 시간상수 0.01s 고정 → 느린 페이드는 반드시 자체 GainNode.
  - HRTF는 소스당 컨볼루션(최고비용 노드군) → **정위 음원은 전부 모노로 준비**. 데스크톱 4~8개는 무리 없음 [실측 권장].
  - `setMediaElementSource()` 사용 시 `hasPlaybackControl=false` — setLoop/play/pause 무동작.
- **크로스페이드 원칙**: `gain.value=` 직접 대입 금지(클릭) → `setValueAtTime`+`linearRampToValueAtTime`. 등파워는 `setValueCurveAtTime`+cos/sin. `exponentialRamp`는 0 불가. **모든 스케줄링은 `ctx.currentTime` 기준** (rAF/setTimeout 기준 금지 — 백그라운드에서 깨짐).

## ③ 루프·백그라운드 재생

**AudioBuffer 루프**: `loop=true`는 스펙상 샘플 정확 무갭. 갭의 원인은 코덱 — **MP3는 인코더 딜레이/패딩으로 루프 부적합**. 배포는 **OGG Vorbis/Opus**, 제로 크로싱 트림.

**메모리**: 디코딩된 버퍼 = 샘플레이트 × 4byte × 채널 × 초. **스테레오 44.1kHz 5분 ≈ 101 MiB → 금지.** MDN도 45초 미만 권장.

**MediaElementSource**: 백그라운드 지속은 되지만 **무갭 루프 불가**(HTMLMediaElement loop 갭, Firefox bug 654787) → **이 프로젝트에서 사용 금지.**

**권장 구성 — 다층 짧은 루프**:
- 배경 앰비언스: 30~90초 스테레오 루프 1개 + 서로 다른 길이의 보조 레이어 2~3개(예 37s/53s/71s)를 다른 오프셋으로 동시 재생 → 최소공배수가 길어 수십 분간 반복 비지각, 메모리 수십 MB 고정.
- 정위 음원 4~8개: 모노 짧은 루프.

**백그라운드 지속 — 확정 사실**:
- 데스크톱 Chrome/Edge/Firefox에서 **가청 AudioContext는 탭 숨김에도 자동 중단되지 않음**. Chrome은 가청 탭을 타이머 스로틀링·freezing에서 면제.
- ⚠️ 널리 인용되는 "탭 숨기면 suspend된다"는 Chrome 샘플 페이지 동작은 **데모 자체가 넣은 visibilitychange 코드** — **이 패턴을 절대 넣지 말 것.** 아무것도 안 하면 요구 충족.
- 단 rAF는 백그라운드에서 완전 정지 → **크로스페이드·스케줄러를 rAF에 매달면 얼어붙음**. 오디오 클럭 스케줄 또는 setInterval 룩어헤드(가청 탭은 스로틀 면제), AudioWorklet도 지속.
- 방어 코드: `ctx.onstatechange`에서 running 아니면 resume 재시도 + 게이트에서 초기 `resume()`. (macOS Safari 최소화 시 정지 WebKit #231105 등)

## ④ 앱 구조 — 권장: 순수 TypeScript + Vite (React/R3F 미도입)

근거: DOM UI 표면적 3개(게이트/설정/일시정지)는 정적 HTML+클래스 토글로 충분. R3F는 "이미 React를 쓸 때"의 선택. 오디오 정밀 제어(클럭 스케줄링, 노드 수명 관리)는 React 생명주기와 상성 나쁨. three.js 단독 gzip 155~182KB에 React 스택 ~97KB 추가할 근거 없음.

```
src/
  main.ts        // 부트스트랩, rAF 루프 소유
  core/ store.ts(초소형 pub/sub 또는 nanostores) · settings.ts(localStorage) · sceneState.ts(상태 머신)
  scene/         // three.js — store 구독만, DOM 모름
  audio/         // Web Audio 그래프 — ctx.currentTime 스케줄러
  ui/            // DOM 오버레이 — store 구독/발행, three 모름
```
- **단일 방향 규칙**: UI는 store에 write, 3D는 read. 상호 직접 참조 금지.
- DOM은 canvas 위 절대배치 오버레이, 평소 `pointer-events:none`. WebGL 안에 UI 그리지 말 것(텍스트·접근성).
- Vite: `assetsInlineLimit: 0`으로 오디오 인라인 방지.

## ⑤ 설정·상태 관리

**설정(localStorage)**: 단일 키 JSON(`…:settings:v1`) + 스키마 버전 필드. 읽기 시 검증·클램프 필수(FOV NaN → 검은 화면), try/catch + 인메모리 폴백(시크릿 모드), 쓰기 디바운스 ~300ms. 첫 방문 기본값은 `prefers-reduced-motion` 존중.

**씬 상태 머신**: 4상태에 XState 과함 — union 타입 + 전이 테이블:
```ts
type SceneState = 'gate' | 'corridor' | 'hall' | 'paused';
```
- 각 상태 onEnter/onExit 훅에서 **오디오 크로스페이드 트리거** — 전이와 믹싱을 한곳에서.
- `paused`는 직전 상태를 기억하는 **오버레이**로 모델링(previous 필드).

## 실행 결정 3줄 요약
1. three.js PositionalAudio(HRTF 기본) + 자체 GainNode 믹서. distanceModel `'linear'` 명시.
2. 30~90초 OGG/Opus 다층 루프 AudioBuffer. MP3·MediaElementSource·5분 통짜 버퍼 금지.
3. 백그라운드는 아무것도 안 하면 지속 — visibilitychange→suspend 금지, 스케줄링은 오디오 클럭 위에.

## 출처 (핵심)
- three.js 소스: PositionalAudio.js·Audio.js (raw.githubusercontent.com/mrdoob/three.js/dev)
- https://github.com/mrdoob/three.js/issues/15422 · /issues/20920
- https://webaudio.github.io/web-audio-api/#PannerNode · MDN PannerNode.distanceModel
- https://github.com/WebAudio/web-audio-api/discussions/2505 (MP3 갭) · https://bugzilla.mozilla.org/show_bug.cgi?id=654787
- https://developer.chrome.com/blog/background_tabs · /blog/timer-throttling-in-chrome-88
- https://bugs.webkit.org/show_bug.cgi?id=231105
- https://padenot.github.io/web-audio-perf/ · https://github.com/spotify/web-audio-bench
- https://github.com/resonance-audio/resonance-audio-web-sdk/issues/12 (아카이브)
- https://www.creativedevjobs.com/blog/react-three-fiber-vs-threejs
