# 조사 H — 3D 렌더링 스택 비교 (PRD 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 수치는 GitHub·npm·Bundlephobia API 및 포럼 about.json에서 당일 직접 수집한 1차 데이터

## 버전 현황 (2026-08-22)
Three.js **r185**(`three@0.185.1`) · Babylon.js **9.22.1** (9.0은 2026-03) · PlayCanvas **2.21.4** · Godot **4.7.2** · Unity **6000.5.x**

## 기준 × 후보 비교표 (5점 만점)

| 기준 | Three.js | Babylon.js | PlayCanvas | Godot 웹 | Unity Web |
|---|---|---|---|---|---|
| 몰입 품질 상한 | 4.0 | **5.0** | 4.0 | 2.0 | 3.0 |
| 성능 하한 (Iris Xe) | **5.0** | 3.5 | 4.0 | 1.5 | 2.0 |
| HRTF 공간 오디오 | **5.0** | 4.0 | 3.0 | 1.5 | 1.0 |
| 4K 비디오 텍스처 | 4.0 | 4.0 | 4.0 | **1.0** | 2.0 |
| 1인 개발 학습곡선 | **5.0** | 4.0 | 3.0 | 3.5 | 4.0 |
| 번들·로딩 | **5.0** | 3.0 | 3.0 | 1.0 | 2.0 |
| 락인·지속성 | 4.0 | **4.5** | 3.0 | 4.0 | 2.5 |
| **합계 (35)** | **32.0** | 28.0 | 24.0 | 14.5 | 16.5 |

## 핵심 정량 데이터

| | npm 월 다운로드 | GitHub stars | 포럼 30일 활성 | 번들(gzip) |
|---|---|---|---|---|
| Three.js | **57,309,673** | 114,674 | **1,019명** | **182.4 KB**, 의존성 0 |
| Babylon.js | 1,440,580 (1/40) | 25,962 | 372명 | ~1.4MB 전체 / 최소 ~300KB [추정] |
| PlayCanvas | 292,692 (1/196) | 16,536 | 144명 | 590.7 KB |
| Godot 웹 | — | 115,971 | 3,081명(엔진 전체) | wasm ~20MB급 [추정] |

## 후보별 요점

### Three.js r185 — 잠정 1순위 (32.0)
- **HRTF가 기본값** (소스 확인: `PositionalAudio.js`에 `panningModel = 'HRTF'` 하드코딩) — 5개 후보 중 유일.
- 런타임이 가장 얇음 → Iris Xe 45fps 하한에 가장 유리. 저드로우콜 씬에서는 WebGL2 경로가 WebGPU보다 빠른 실측 존재(ICS MEDIA, r176).
- 후처리는 **pmndrs/postprocessing**(Zlib, 월 360만 다운로드)이 사실상 표준 — 단일 패스 머지, SelectiveBloom(스크린만), LUT 색보정, ACES 톤매핑, SMAA.
- **감점**: `RectAreaLight`는 그림자 미지원 + 텍스처 불가 → 스크린 스필 라이트는 "영상 평균색 샘플링 → 일반 라이트/에미시브+블룸" 근사로 (성능상으로도 이 편이 정답).
- 비디오 텍스처 주의: three.js는 비디오를 렌더 fps로 업로드(#13379) → **rVFC로 `needsUpdate` 게이팅 필수**.
- 리스크: 릴리스별 breaking change 문화 → **버전 핀 고정**으로 관리. WebGLRenderer 폐기 일정은 미명시, WebGPURenderer는 WebGL2 자동 폴백 제공.

### Babylon.js 9.22 — 근소한 2순위 (28.0)
- 몰입 품질 상한 1위: `DefaultRenderingPipeline` 통합 이미지 프로세싱, **9.0 Textured Area Light**("LED 패널이 어두운 공간을 비추는" 유스케이스와 정확히 일치), Clustered/Volumetric Lighting(WebGL2 지원 명시).
- 단 그 우위 기능들이 Iris Xe 45fps 하한에서 사용 가능한지 미검증 — 상한의 우위이지 하한의 우위가 아님.
- HRTF는 옵션(`spatialPanningModel: "HRTF"` 명시 필요, 기본 equalpower — 소스 확인).
- Apache-2.0, MS 후원, open issues 30(엄격한 관리) — 락인·지속성 최고점.
- **재평가 트리거**: M0에서 Three.js 조명 표현이 목표 미달이면 동일 씬을 Babylon으로 1일 재구현해 비교(V13).

### PlayCanvas — 3순위 (24.0)
- 소스 확인: `instance3d.js`가 `createPanner()` 후 `panningModel` 미설정 → **기본 equalpower, HRTF 미노출**(비공개 필드 우회 필요).
- 번들 3.2배, 커뮤니티 1/7. 최대 강점(에디터)을 이 프로젝트에서 쓸 일 없음. 에디터 무료 티어는 비공개 프로젝트 불가.

### Godot 4.7 웹 — 탈락 (기능 부적합)
- 공식 문서: 비디오는 **Ogg Theora 전용, 전량 CPU 디코딩, 웹 권장 상한 720p@30** → 4K 원천 불가.
- 웹은 Compatibility 렌더러만(볼류메트릭/SSAO/SSR 전부 미지원). HRTF 없음. wasm 수십 MB. COOP/COEP 헤더 필수(외부 CDN 제약).

### Unity 6 Web — 탈락 (기능 부적합)
- 공식 문서: 웹 AudioMixer는 **볼륨만 지원, 오디오 이펙트·스페이셜라이저 미지원** → HRTF 불가.
- VideoPlayer 프레임 정확도 미지원. WebGPU Experimental. 라이선스 정책 변동 이력(2023 Runtime Fee).

### React Three Fiber — 비채택
- React를 도입할 다른 이유가 전무(단일 정적 씬, DOM UI 3개). +~97KB gzip. 명령형 루프(포인터락·오디오·비디오 게이팅) 중심 구조에 선언적 레이어의 이점 없음.
- 단 `postprocessing` 라이브러리는 R3F 없이 그대로 사용, drei의 유용 구현은 바닐라로 이식 참고.

## M0 프로토타입 실측 검증 항목 (PRD로 이관)

**환경**: Iris Xe 하한 기준기(팬리스 포함), Chrome+Firefox, 1080p/1440p 디스플레이.

우선순위 1 (성립 여부):
- V1 4K 비디오 텍스처 업로드 비용 — 프레임당 <4ms (2160/1440/1080 3단 비교)
- V2 코덱별 HW 디코딩 확인(chrome://media-internals) — SW 디코딩이면 4K 즉시 포기, 1440p 하향
- V3 rVFC 게이팅 효과 — GPU 시간 30~50% 감소 확인
- V4 HRTF 실효성 — 1/4/8/16개 동시 CPU <5%, 아티팩트 없음, 정위 식별

우선순위 2 (튜닝): V5 블룸 비용 <3ms(선택적 블룸 비교) · V6 필레이트 한계(픽셀 예산 특정) · V7 그림자 전략(베이크 vs 실시간) · V8 컬러 파이프라인(영상 이중 톤매핑 금지) · V9 A/V 동기+CORS(드리프트 <40ms)

우선순위 3 (운영): V10 팬리스 20분 서멀 (후반 fps 하락 <15%) · V11 번들 gzip <300KB · V12 WebGPU 백업 경로 수치 확정 · V13 Babylon 재평가 트리거

**M0 종료 시 확정**: ① 영상 해상도·코덱 프로파일 ② 렌더 픽셀 예산·동적 스케일링 ③ 조명 방식 ④ 엔진 최종 확정 ⑤ Three.js 고정 버전.

## 출처 (핵심)
- 소스: three.js PositionalAudio.js·RectAreaLight.js, Babylon abstractSpatialAudio.ts, PlayCanvas instance3d.js (각 GitHub raw)
- https://threejs.org/docs/pages/WebGPURenderer.html · https://github.com/mrdoob/three.js/releases/tag/r185
- https://blogs.windows.com/windowsdeveloper/2026/03/26/announcing-babylon-js-9-0/
- https://docs.godotengine.org/en/stable/tutorials/animation/playing_videos.html · /tutorials/rendering/renderers.html
- https://docs.unity3d.com/6000.3/Documentation/Manual/webgl-audio.html
- https://github.com/mrdoob/three.js/issues/13379 · /issues/26183
- https://ics.media/en/entry/250501/ (Iris Xe 실측)
- https://github.com/pmndrs/postprocessing
- API: api.github.com, api.npmjs.org, bundlephobia.com, 각 포럼 about.json
