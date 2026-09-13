# Immersive Healing — 에이전트 컨텍스트 (CLAUDE.md)

## 1. 프로젝트 개요

웹 1인칭 몰입 힐링 전시 MVP — 1호 콘텐츠 「일몰」. 방문자가 게이트→복도→**타원 몰입 홀**(입구 제외 벽 전체가 하나의 연속 스크린, 바닥·천장이 반사 — 국중박 실감1관 참조, 조사 K)을 걸어 들어가 10분 하늘 순환(골든아워→별밤→새벽)과 공간 음향 속에서 쉬는 경험. 힐링(이완·휴식) 목적 단일 경험이며, 치유·효능 주장은 금지(PRD FR-90).

- 스택: TypeScript strict + Vite + three.js **0.185.1 정확 핀** + postprocessing 6.x + 자체 pub/sub + Web Audio(자체 GainNode 버스). React/R3F/XState/Howler 미도입.
- 문서 체인: docs/GOAL.md → mrd/MRD.md → rfp/RFP.md(v1.3) → prd/PRD.md(v1.2) → **srs/SRS.md(v1.3, 규범)** → **tc/**(시험). 개발 기록·역반영은 docs/dev/DEVLOG.md. 설계 결정은 docs/SDD.md.
- 현 단계: **v5 몰입 홀**(사용자 결정 2026-09-06 — 타원 랩어라운드 스크린·반사 바닥·10분 하늘 순환) 구현 완료, 테스트 35통과, 번들 ≤300KB. 다음: M0a 측정(반사 비용 포함) → M1 아트.

## 2. 디렉토리 구조 (주석 트리)

```
src/
  main.ts               # 부트스트랩 + ★rAF 루프 유일 소유(프레임 순서는 SRS §3.2 고정)
  types.ts              # AppState·Action·Settings 등 공용 타입(액션 유니언의 원천)
  core/                 # ★상태 전이·설정 write 전유 계층 — 브라우저 API 소유
    store.ts            # pub/sub — get/dispatch/publishSys/subscribe(immediate 기본 true)
    settings.ts         # localStorage 'ih:settings:v1' — 필드 단위 클램프·폴백 (TC-COR-04~12)
    sceneState.ts       # 상태 머신 6상태·허용 8전이 (TC-COR-01~03)
    inputSession.ts     # ★Pointer Lock·Fullscreen·visibility API 전유(다른 파일 호출 금지)
  scene/                # three.js — store 구독, sys.*만 발행
    renderer.ts         # WebGLRenderer + 후처리 체인. 톤매핑은 말단 1회(NoToneMapping)
    world.ts            # ★타원 몰입 홀 v5(연속 리본 스크린·반사 바닥/천장·복도) (SRS-SCN-25)
    hallGeometry.ts     # ★타원 호 길이 파노라마 좌표 순수 함수 (TC-SCN-08~11)
    skyCycle.ts         # ★10분 하늘 순환 순수 함수(골든→별밤→새벽, ≤5%/s) (TC-SCN-12~14)
    skyShader.ts        # 공유 GLSL panorama() + 공유 유니폼(벽·바닥·천장이 같은 하늘)
    surfaces.ts         # ★해석적 반사 바닥·천장 — 추가 렌더 패스 0 (SRS-SCN-26, D-11)
    player.ts           # 이동·시점(e.code + IME 가드, Q/E/R/F 키보드 시점, WalkRegion 충돌)
    screen.ts           # ★비디오 A/B 스왑 — <video loop> 금지, rVFC 게이팅 (SRS-VID-2~7) + 커버 맞춤
    gifTexture.ts       # ★GIF 상영(?gif) — ImageDecoder 지연 디코드·업로드 게이팅 (SRS-VID-9)
    panoMedia.ts        # ★360 에퀴렉트 매핑(?wrap) — 벽·반사 공유 유니폼 (SRS-VID-10)
    quality.ts          # 프리셋 적용·renderScale(재할당 금지 — viewport 부분 렌더)
    adaptation.ts       # ★적응 히스테리시스 순수 함수(45/55, 강등 최대2회·30s) (TC-QLT-01~06)
    renditionSelect.ts  # 렌디션 3종 선택 순수 함수 (TC-VID-01~06)
  audio/                # Web Audio — store 구독, sys.*만 발행
    graph.ts            # ★3단 버스 userVolume→duck→mute(+visibilityBus). ctx 생성 후 setContext
    ambience.ts         # 앰비언스 5레이어 합성(waves·wind·pad·nightAir·drone)
    phaseMix.ts         # ★태양 고도→레이어 게인 순수 함수(밤 총합 ≤ 낮) (TC-AUD-09~10)
    positional.ts       # 정위 음원 ≤8 — distanceModel='linear' 즉시 명시 + spatialBus 재배선
    scheduler.ts        # ctx.currentTime 기준 스케줄(rAF 비의존)
  ui/                   # DOM 오버레이 — store에 액션만 발행(scene/audio import 금지)
    gate.ts pauseMenu.ts settingsPanel.ts credits.ts hud.ts unsupported.ts
    debugOverlay.ts     # fps JSON 수집(M0 측정용)
    dom.ts              # DOM 헬퍼
  analytics/track.ts    # no-op 훅(도구 미정 — SRS §1.3)
  data/credits.json     # 크레딧 단일 대장(CC-BY·오픈소스 고지 원천)
  styles.css            # DOM 오버레이 스타일(:focus-visible·inert 규칙 포함)
scripts/
  check-arch.mjs        # ★의존 규칙·API 전유·데드 액션 기계 강제(빌드 게이트, TC-UI-07)
  check-size.mjs        # 번들 gzip ≤300KB 게이트
  check-licenses.mjs    # SPDX 허용목록 게이트
  generate-report.mjs   # ★TC 커버리지 리포트(vitest→JUnit→docs/tc 대조, orphan 게이트)
  gen-test-media.mjs    # 테스트 미디어 생성(ffmpeg-static)
tests/                  # Vitest 순수 함수 단위 시험 — 제목에 [TC-<COMP>-NN] 태깅 필수
docs/tc/                # TC 문서(권위) — TC_COR·QLT·VID·AUD·SCN·UI
docs/report/            # 근거·evidence — ci-report.md(자동 생성), M0 측정 보고서
```

## 3. 아키텍처 원칙 (Invariants — 최우선 준수, 위반 시 check-arch가 빌드 실패)

1. `ui/`는 store에 **액션만 발행**, `scene/`·`audio/`를 import 금지.
2. `scene/`·`audio/`는 `publishSys()`로 `sys.*`에만 발행. `ui/` import 금지.
3. 상태 전이·설정 write는 `core/` 전용(`store.coreSet`은 core 밖 사용 금지). Pointer Lock/Fullscreen/visibility API는 `core/inputSession.ts` 전유.
4. rAF 루프는 `main.ts` 단일 소유, 프레임 순서는 SRS §3.2 고정.
5. 요구·시험 ID(`SRS-<모듈>-NN`·`TC-<모듈>-NN`)는 **append-only** — 재배치·재사용 금지, 폐기는 취소선+대체 포인터.

## 4. 코딩 규칙

- TypeScript strict. 모듈 경계는 §3의 계층 규칙. 순수 로직(선택·판정·히스테리시스)은 DOM/three 비의존 순수 함수로 분리해 `tests/`에서 시험.
- 키 입력은 `KeyboardEvent.code` + `isComposing||keyCode===229` 가드. 방향키 상시 병행.
- 새 테스트는 제목에 `[TC-<COMP>-NN]` 완전형 ID 포함(복수 가능) + `scripts/generate-report.mjs`의 SUITES 등록 + `docs/tc/` 대응 문서에 정의. **orphan(문서에 없는 태그)은 리포트가 빌드를 깬다.**
- three는 0.185.1 정확 핀 — postprocessing peer `<0.186.0` 때문. 임의 업그레이드 금지.

## 5. 계약 표면 (ui→core / SRS §4 원천 — 실코드 기준 2026-09-06 대조)

| 액션 | 실제 발행처 | 의미 |
|---|---|---|
| `skipCorridor` | hud | 복도 스킵 |
| `exitRequested` | pauseMenu | 나가기(exiting 전이) |
| `reenterRequested` | main(credits 닫힘 흐름) | 게이트 복귀 |
| `settingsChanged {patch}` | settingsPanel/gate | 설정 부분 갱신(클램프는 core) |
| `muteToggled` | main(M 키) | 음소거(muteBus 0.15s 램프) |
| `openSettings`·`closeSettings`·`openCredits`·`closeCredits` | gate/pauseMenu/패널 | 오버레이 개폐 |
| `noticeRetried {id}`·`noticeDismissed {id}` | hud | 오류 알림 처리(`sys.notices` 채널) |

**콜백 경로 (액션 아님 — SRS-UI-3 v1.4 규범)**: 입장은 gate `onEnter(direct)` 콜백 → main `doEnter`(graph.resume → inputSession.requestLock → 전이), 일시정지 진입은 Esc → 브라우저 포인터락 해제 → inputSession의 `pointerlockchange` 관측 → core 내부 전이, 복귀는 pauseMenu `onContinue` 콜백(재잠금 요청). **액션이 아닌 이유는 규범**이다 — 액션 채널은 반환값이 없어 "잠금 거부 → 게이트 잔류"를 표현할 수 없고, `store.dispatch`가 재진입 시 마이크로태스크로 미뤄 SRS-COR-51의 제스처 문맥 요구를 깰 수 있다. **콜백 예외는 이 둘(제스처 요구 동작·쿨다운 조회)에 한정** — 나머지 ui→core 전달은 전부 액션. `enterRequested`·`pauseResume` 데드 액션은 2026-09-10 제거했고, 발행처 없는 액션은 `check-arch`가 빌드를 깬다(TC-UI-07). scene/audio → core 관측값은 `sys.*` 네임스페이스만.

## 6. 개발 명령어

```bash
npm run dev        # vite dev 서버
npm test           # vitest 단위 시험(35개, 전부 순수 함수)
npm run report     # ★TC 커버리지 리포트 → docs/report/ci-report.md (orphan 게이트)
npm run check      # check-arch + check-licenses
npm run typecheck  # tsc --noEmit
npm run build      # typecheck → vite build → 크기·라이선스·아키텍처·TC 리포트 게이트 전부
npm run gen:media  # 테스트 미디어 생성
```

## 7. 정책·동작 규칙 (결정 로그 — 되돌리기 전에 근거를 읽을 것)

**오디오 금지 규칙 (SRS-AUD, TC-AUD-01~08):**
- three의 `Audio.setVolume()`/`AudioListener.setMasterVolume()` 금지 — 자체 GainNode 버스(userVolume→duck→mute)만. 이유: three 볼륨 API는 버스 믹싱·램프 스케줄과 충돌.
- `gain.value` 직접 대입 금지 — `setValueAtTime`+`linearRampToValueAtTime`(클릭·팝 방지).
- MP3, `MediaElementSource`, 5분급 통짜 AudioBuffer 금지(메모리·루프 심 문제).
- **[탭 가시성 — 사용자 결정 2026-08-22]** `visibilitychange→ctx.suspend()` 절대 금지. 소리는 탭이 보일 때만: visibilityBus **게인** 페이드(숨김 0.25s→0, 복귀 0.6s→1)로 처리 — 클럭·스케줄은 계속 돈다. 반증된 대안: suspend()는 복귀 시 스케줄 전체가 어긋남.
- 오디오 스케줄을 rAF에 매달기 금지 — `ctx.currentTime` 기준(rAF는 스로틀·정지됨).
- PositionalAudio: 생성 즉시 `distanceModel='linear'` 명시 + gain을 spatialBus로 재배선. AudioContext는 graph.ts 생성 후 `THREE.AudioContext.setContext()`를 AudioListener 생성 전에 호출. 음원 상시 재생+개별 게인 0 소거(HRTF 노드 생성/파괴 비용 회피 — SRS-AUD-4 근거 참조).

**비디오 금지 규칙 (SRS-VID, TC-VID-07~10):**
- `<video loop>` 속성 금지 — 루프는 A/B 스왑 로직 소유(트리거 여유 0.5s, uMix 램프 0.25s).
- 텍스처 업로드는 rVFC 게이팅(`needsUpdate`는 rVFC에서만). rVFC 부재 시 currentTime 변화 감지 폴백+프리셋 1단 하향.
- 영상 파일에 오디오 트랙 금지(-an). 재생 실패는 계단식 폴백 최대 3단(720p)+세션 블랙리스트.

**렌더링·연출 (SRS-SCN·QLT, TC-SCN-03~05·TC-QLT-07):**
- 반사 광선이 스크린 밴드를 벗어나면 **검정 반환 금지** — 세로 좌표를 밴드 끝으로 클램프 + 감쇠(2026-09-11 "발밑 큰 반원" 원인). SRS-SCN-26.
- `RectAreaLight` 실사용 금지 — 영상 평균색 샘플링(2×2 캔버스 CPU, 주기 ≥250ms) + Point/SpotLight 근사.
- 씬 전환·밝기 변화는 0.5초 이상 페이드. 1초 3회 초과 섬광 금지(광과민 안전).
- renderScale 변경 시 렌더타겟 재할당 금지 — 최대 크기 1회 할당 + viewport 부분 렌더.
- 톤매핑은 파이프라인 말단 1회(렌더러 NoToneMapping + ToneMappingEffect ACES).
- **[타원 몰입 홀 — 사용자 결정 v5, 2026-09-06 · SDD D-10~12]** 홀은 타원(15×11m, 둘레 ≈82m), 입구 제외 벽 전체가 **하나의 연속 리본 스크린**(밴드 **0.2~8.2m**, 천장 9.4m — 2026-09-11 사용자 요청으로 6m→8m 상향). 진입 복도는 **12m**(같은 날 단축). **문턱 바닥은 동일 평면 겹침 금지** — 복도 슬래브·브릿지·홀 원반이 y=0에 셋 다 겹쳐 깊이 다툼(검은 줄무늬)을 냈고, 브릿지를 문 선에서 시작해 1cm 낮춰 해결. 파노라마 좌표는 각도가 아니라 **실제 호 길이**(장축 벽 늘어짐 방지). 바닥·천장은 **해석적 반사**(뷰 광선 대칭→타원 실린더 교차→같은 panorama() 평가) — 미러 카메라·추가 렌더 패스 금지(45fps 목표 위험, D-11 반증 기록). High 3탭/Low 1탭·천장 off는 프리셋 게이트. v4(직교 5세그먼트)는 Superseded — 되돌리지 말 것.
- **[360 랩어라운드 미디어 — SRS-VID-10]** `?wrap`은 소스를 에퀴렉트로 보고 **벽 전체**에 매핑한다. 가로 = **중심 기준 방위각**, 세로 = 눈높이 고도각(그 점의 실제 거리 사용) — 수평선이 눈높이에 온다. **미디어에 호 길이 매핑 금지**: 타원에서 같은 호 길이 ≠ 같은 각도라 정면 15% 압축·측면 16% 확대가 생긴다(절차 하늘의 SRS-SCN-25 호 길이 규칙과 의도적으로 다름 — 무늬는 안 드러나지만 사진은 드러난다). 타원에서 매개변수각 ≠ 방위각이므로 시작 기준도 환산할 것. `?map=arc`는 비교용. 미디어 유니폼은 **하늘 유니폼과 같이 공유 객체**로 벽·바닥·천장이 함께 읽는다(불일치 금지). 반사는 루프 교차 중 슬롯 A만 샘플링(3탭→6탭 방지, 의도된 허용 오차). 진입·이탈은 0.9s 페이드(하드 컷 금지). 소스는 `?video`/`?video=<url>`/`?gif=`/`?img=`(정지 파노라마) 공용이며 `?gain=`(노출 트림)·`?vrange=a,b`(밴드 크롭 마스터 선언)·`?flow=`(수면 애니메이션)·`?vfov=`(세로 압축 — 밴드가 360의 21%만 덮으므로 더 밀어넣는 의도된 압축)·`?map=band`(구가 아니라 **벽 전개도 9.68:1 띠 이미지**임을 선언, 잘림 0)로 보정한다. **상하 규약**: 모든 소스가 같은 flipY로 올라가야 한다 — 셰이더는 에퀴렉트 공간에서 계산 후 **마지막에 한 번만** 뒤집고, `ImageBitmap`은 `imageOrientation:'flipY'`로 만든다(안 맞추면 정지 이미지와 영상이 서로 뒤집힌다). **미디어 텍스처에 비등방 필터링 필수**(측면 벽 15m는 매우 비스듬하다), 밉맵은 정지 이미지에만. **수면 애니메이션은 수평선 아래(에퀴렉트 v>0.5)에만** 적용하고 **넓고 느린 너울**만 쓴다 — 하늘을 움직이거나 고주파 잔물결을 쓰면 사진이라는 게 드러난다. 조사 L 참조.
- **[미디어 소스 — SRS-VID-9]** 기본 상영은 **절차 GLSL 하늘**(영상도 이미지도 아님). `?video`는 `/media/sunset_*.mp4` 렌디션, `?gif`(또는 `?gif=<url>`, 기본 `/media/sunset.gif`)는 GIF 1개를 **전면 리본에만** 상영 — 둘 다 개발·검토용 플래그. GIF는 `ImageDecoder`로 프레임 1장씩 지연 디코드(전 프레임 상주 금지), 루프는 gifTexture가 소유, 업로드는 디코드 시에만. 영상·GIF 모두 **커버 맞춤**(uUvScale/uUvOffset)으로 종횡비 유지 — 늘려 붙이기 금지. `public/media/`는 gitignore 대상.
- **[홀 입장 위치 — SRS-SCN-24]** `corridor→hall` 전이 때 **도보 관람자의 위치를 옮기지 말 것**. `SPAWN_hall` 배치는 게이트 직행(`from === 'gate'`)과 `BOUNDS_viewing` 이탈 시에만. `TRIGGER_hallEntry`는 `BOUNDS_viewing` **내부**에 둔다 — 어긋나면 도보 도달마다 순간이동(2026-09-11: 4.05m)이 되어 "입장 순간 끊김"으로 보인다.
- **[하늘 시간 순환 — SRS-VID-8]** skyParams(t) 순수 함수, 주기 600s, t=0=t=600(무이음). 채널당 초당 변화 ≤5%·고도 ≤0.35°/s(TC-SCN-13이 전 주기 검증 — 키프레임 수정 시 이 상한 먼저 확인). 별·달은 시민박명(−3°) 전 금지. 시간은 corridor·hall·비일시정지에서만 진행. 벽·바닥·천장은 **하나의 공유 유니폼**을 읽는다(불일치 금지).
- **[호흡 리듬 빛 — SRS-COR-25]** breathGuide 설정(기본 off), hall·비일시정지에서만 바닥 uBreath 구동(주기 10s=분당 6회). 효능 주장 금지 — 문구는 '이완' 수준(FR-90).

- **[출력 트림 — 사용자 결정 2026-09-11]** 전체 음량은 `graph.ts`의 `OUTPUT_TRIM`(=0.1) **한 곳**에서만 보정한다(userVolumeBus에 곱). 레이어 게인표(DAY/NIGHT/CEILING)는 상대 믹스를 시험이 고정하므로 손대지 말 것.

**오디오 위상 연동 (SRS-AUD-9, TC-AUD-09~10):** 앰비언스 게인은 gainsForElevation(고도) 순수 함수만 — 레이어 상한표(GAIN_CEILING)·밤 총합 ≤ 낮 불변식이 시험으로 고정됨. 정위 음원은 벽면 앵커 5곳(전방=태양)·시각 정합.

**적응 정책 (TC-QLT-01~06):** 하향 임계 45fps(NFR-1 정렬)·3윈도우, 프리셋 강등은 scale 플로어에서만·최대 2회·30s 간격, **자동 상향은 renderScale만**(프리셋 상향은 수동 전용 — 감사 D6). 성능-품질 충돌 시 양보 순서: 화질 → 공간 장식 → fps(감사 D5).

**기타:** 설정은 localStorage 단일 키 `ih:settings:v1`, 필드 단위 클램프·폴백. UI 문구는 치료·치유·효능 주장 금지 — '이완/휴식' 수준만(PRD FR-90). 후보 필터·정량 합격선은 평가 전 lock(사후 조정 금지).

## 8. 보안·개인정보·라이선스

- 쿠키·영구 식별자·IP 저장 없음(분석 도구 미정, 훅 no-op — SRS-ANL).
- 커밋 금지: 대용량 미디어(렌디션 영상·오디오 원본), 비밀 키, `docs/report/` 날짜별 사본(ci-report.md만 유지).
- 미디어·폰트 라이선스는 `credits.json` 단일 대장 + SPDX 허용목록(check-licenses.mjs 게이트).

## 9. SDLC 문서-코드 동기화 규칙 (매 커밋 강제)

**권위**: 요구는 SRS(v1.1 baseline), 시험은 `docs/tc/` TC 문서. `docs/report/ci-report.md`는 특정 실행의 evidence일 뿐. 요구문서에 구현 상태(구현됨/미구현)를 쓰지 않는다 — 그건 리포트와 git이 안다.

| 코드 변경 | 같은 커밋에 갱신할 대상 |
|---|---|
| 동작·정책 변경(임계·순서·모드) | SRS 해당 절 + `docs/tc/` TC 문서 + 본 문서 §7 정책 메모 |
| 새 액션·sys 이벤트 | 본 문서 §5 표 + SRS §4 |
| 새 파일·모듈 | 본 문서 §2 트리 + 해당 SKILL.md |
| 새 테스트 파일 | `generate-report.mjs` SUITES 등록 + `[TC-…]` 태깅 + 대응 TC 문서 정의 |
| 설정 키 추가·변경 | 본 문서 §7 + `.claude/skills/` 해당 설정 표 |
| 새 매직넘버·임계값 | 근거를 `docs/report/` 또는 SDD 결정 기록에 남기고 링크 |

**커밋 규약**: `<type>(<scope>): 한국어 한 줄` + 본문(왜·어떻게) + 역정합한 문서 목록 + 검증 문구
`검증: 테스트 N passed; orphan 0.` — type = feat/fix/refactor/test/docs, scope = core/scene/audio/ui/docs/test.

**커밋 전 체크**: ① `npm run report` — TC-ID별 결과 ❌ 없음 + **orphan 0** ② `npm run check` ③ 새 동작이 SRS·TC에 반영됨 ④ 본 문서 §2·§5·§7이 코드와 일치.
