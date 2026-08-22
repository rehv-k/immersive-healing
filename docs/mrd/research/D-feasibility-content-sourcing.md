# 조사 D — 웹 3D 실현 사례·콘텐츠 수급 (MRD 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트
> 표기: **[확인]** / **[부분확인]** / **[추정]**

---

## 1. "걸어다니는 3D 공간 + 대형 영상 상영" 웹 사례

### 결론
**형태 자체는 시장에서 여러 번 검증된 패턴.** 다만 "Three.js 자체 웹 + 힐링 목적 단일 몰입 경험"은 빈 자리. 기존 사례는 (a) 전시 SaaS(작품 나열형) 또는 (b) 소셜 메타버스(다중접속형)이며, **1인 몰입·감상 목적의 시네마틱 경험은 희소.**

### 사례군
- **A. 전시 SaaS** [확인]: Kunstmatrix/artspaces(상업 갤러리용, 유료), Artsteps(무료, 이미지·비디오·3D 배치), 국내 WithSpace·XRHUB·브이리얼 등 — 국내에도 카테고리 형성됨.
- **B. 브라우저 3D + 영상 스크린 + 공간 오디오 (최근접)** [확인]:
  - **Frame (framevr.io)**: 브라우저 즉시 실행, 360/일반 영상·3D 모델·셰이더 + **공간화 오디오**. 최대 300명. → 목표 기술 조합이 **이미 상용으로 작동 중임을 증명.**
  - **Spatial.io**: 웹/모바일/VR, 공간 오디오 + falloff.
- **C. 부정적 시그널 — Mozilla Hubs 종료** [확인]: 2018 출시 브라우저 WebXR 소셜 공간(영상 스크린·공간 오디오 지원) → **2024.5.31 Mozilla 운영 종료**, 커뮤니티 이관. "설치 불필요"에도 VRChat 수준 트랙션 실패. → **"웹 3D 공간" 기술 자체는 차별점이 아니다. 소셜/범용 방향은 실증된 실패 경로. 단일 목적(힐링)+완성 콘텐츠가 리스크 낮음.**
- **D. 개발자 데모 대중화** [확인]: freeCodeCamp 3D 갤러리 정규 튜토리얼, three.js 포럼 쇼케이스 다수(3D 시네마 "Vinema 3D" 포함). **WASD+마우스 룩이 장르 표준 조작계.**

### 사용자 반응 데이터 — 정직하게 약함 [부분확인]
- 유통되는 수치("가상 투어 체류 8~12분 증가", "67% 방문 의향")는 SEO 블로그 출처 — **MRD 인용 비권장.**
- 신뢰 가능 신호: **museum fatigue** — 관람 종료 시점 체류시간 시작 대비 **34% 감소** → **몰입 경험은 짧고 밀도 높게** 설계 근거.

---

## 2. 웹 공간 오디오(HRTF) — 브라우저에서 성립하는가

### 결론: **성립. 표준 API만으로 가능, 상용 사용 중.** 유일한 실질 제약은 동시 HRTF 음원 수.

**핵심 사실 [확인]**
- Web Audio API `PannerNode`가 `panningModel="HRTF"` 표준 지원 (IRCAM Listen DB 기반 바이노럴 합성, MDN 명시). **HRTF가 기본 모드.**
- 상용: Frame, Spatial.io 등 브라우저 서비스 운영 중.

**제약 [확인]**
1. **가장 비싼 노드** — ConvolverNode와 HRTF PannerNode. 음원 이동 시 보간 추가.
2. **HRTF 세트 1종뿐** (Chrome/Firefox 공통) → in-head localisation, 고도 인지 빈약, 전후 혼동.
3. 브라우저별 성능·체감 편차.
4. 저사양 대안: 짧은 리버브 + equal-power 패너 + 거리 감쇠.

**Resonance Audio [부분확인]**: Unity SDK 2022-12 아카이브, 유지보수 불활발 [추정]. → **신규 의존 리스크. 표준 PannerNode(HRTF) + Three.js `PositionalAudio`로 충분.** 앰비소닉 필요 시에만 Omnitone/JSAmbisonics 검토.

**실무 설계 가이드 [추정 — 근거 기반]**
- 동시 HRTF 음원 **4~8개 제한**, 배경 앰비언스는 스테레오 채널.
- 힐링 콘텐츠는 음원 급이동이 적어 보간 비용 부담 낮음 — 오히려 유리한 케이스.
- **헤드폰 착용 권고 UI 사실상 필수** (바이노럴은 스피커에서 무너짐).

---

## 3. 무료 일몰/자연 영상 소스

### 3-1. 일반 4K: **수급 매우 풍부** [확인]

| 소스 | 수량 | 저작자 표시 | 상업 이용 |
|---|---|---|---|
| Pexels | sunset 4K 다수, 매일 추가 | 불필요 | 가능 |
| Pixabay | 16,000+ 클립 | 불필요 | 가능 |
| Mixkit | 자연 4K/HD | 별도 확인 필요 [추정] | — |

**금지 조항 (공통 유형) [확인]**
- Pexels: 원본 무수정 물리 상품 판매 금지, 타 스톡 플랫폼 재배포 금지, 인물 부정적 묘사·보증 암시·상표 사용 금지.
- Pixabay: **창작적 수정 없는 원본 판매·배포 금지**, 상표 노출 콘텐츠 상업 사용 금지, 제3자 IP 확인 책임은 이용자.

> ⚠️ **프로젝트 직결 리스크**: 두 라이선스 모두 "원본 그대로 재배포/판매" 금지. 3D 공간 스크린 상영은 "수정·통합된 작품"으로 볼 여지가 크나, **유료화 시점 법률 검토 필요.** 영상 다운로드 제공·영상 감상 자체를 상품화하는 형태는 회색지대. [추정 — 법적 판단 아님]

### 3-2. 360/equirectangular: **여기가 진짜 병목** [확인 — 직접 검증]

- Pixabay "360" 비디오 검색 약 36건, **대부분 드론샷·제품 회전이며 진짜 equirectangular 아님** (직접 확인).
- 대량 보유처는 전부 유료: Getty 1,593개, Pond5 6,600+, Dreamstime 559, DepositPhotos 1,220.
- 무료 대안: Videezy(4,000+ 표방, 무료 클립은 **attribution 필수**) [부분확인], Vecteezy 360 Nature 약 67건(매우 적음), Vimeo CC(360 한정 수량 미확인).
- **NASA**: 미국 내 원칙적 퍼블릭 도메인, 공공 전시·웹 사용 명시 허용, 출처 표기 요구, 로고는 PD 아님. → 우주/지구 소재 최적이나 **"지상의 일몰"에는 적합성 낮음.**

> **결론: 1호 콘텐츠(일몰)는 360이 아니라 일반 4K 평면 영상 기반이 수급상 압도적으로 안전.** 무료 고품질 360 일몰의 안정 수급 경로는 사실상 없음. 360은 (a) 유료 스톡 (b) Videezy 크레딧 감수 (c) 자체 촬영 (d) 생성형 중 택일.

---

## 4. 무료 앰비언트/자연 사운드 소스

### 결론: **수급 가능. 라이선스 필터링을 운영 프로세스화할 것.** [확인]

**Freesound 라이선스**

| 라이선스 | 저작자 표시 | 상업 이용 |
|---|---|---|
| CC0 | 불필요 | 가능 |
| CC-BY | **필수** | 가능 |
| CC-BY-NC | 필수 | **불가** |

권장 표기(공식): "This [work] uses these sounds from freesound: [title] by [username] (URL) licensed under [license]" — 다수일 경우 크레딧 페이지 URL로 대체 가능(Freesound가 attribution 리스트 페이지 제공).

**운영 시사점 [추정 — 근거 기반]**
- **CC-BY-NC는 처음부터 배제** (유료화 시 전면 교체 비용).
- 현실적 절충: **CC0 우선 + 필요 시 CC-BY + 앱 내 크레딧 페이지 상시 운영.**
- 주의: 라이선스는 CC0인데 설명란에서 크레딧 요구하는 케이스 존재 — 설명란도 확인.
- 보완 소스: Pixabay Sound Effects(표시 불필요), BBC Sound Effects(라이선스 미확인 [추정]).

---

## 5. 생성형 AI 몰입형 영상 — 확장 경로 성숙도

### 결론: **품질은 성숙했으나 공급자 리스크가 실증된 시장. 1호 콘텐츠에 의존 금지.**

**Sora 서비스 종료 [부분확인]**
- 2026-03-24 OpenAI 중단 발표 → **2026-04-26 웹/앱 종료, 2026-09-24 API 종료 예정.** 출시 6개월 미만 종료. Disney 파트너십 이탈 보도.
- → **생성형 영상 API는 1년 안에 사라질 수 있는 인프라.** 파이프라인을 특정 모델에 하드락 금지, **최종 영상 파일을 자산으로 보유.**

**모델 지형 [부분확인 — 블로그 출처, 수치 참고용]**
- Google Veo 3.1 (2025-10): 네이티브 동기화 오디오 강점, 1회 8초 캡.
- Runway Gen-4.5 (2025-12): 1분 멀티샷 단일 패스.
- Kling 3.0: 약 $0.10/초 가격 경쟁력.
- "Veo 4" 미출시. Google I/O 2026의 Gemini Omni 보도는 [추정 — 공식 확인 필요].

**월드 모델 (Genie 3) [확인 — DeepMind 공식]**
- 실시간 인터랙티브 월드 모델. Project Genie 외부 공개 (AI Ultra $250/월).
- → 손으로 만드는 "걸어다니는 3D 공간"이 3~5년 내 생성형으로 대체될 가능성. 현재는 가격·브라우저 실행 불가·연출 제어 불가로 비위협. 장기적으로 "AI 생성 공간의 큐레이션·연출 레이어" 포지셔닝 여지 [추정].

**성숙도 평가 [추정]**

| 용도 | 성숙도 |
|---|---|
| 평면 4K 짧은 클립 | 높음 — 지금 사용 가능 |
| 5~10분 연속 힐링 영상 | 낮음 (캡+스티칭+비용) |
| 360 equirectangular 생성 | 매우 낮음 (네이티브 지원 근거 없음) |
| 인터랙티브 3D 공간 생성 | 실험 단계 |

---

## 6. 웹 360/4K 영상 스트리밍 제약

### 6-1. 자동재생 정책 [확인]
- 음소거 자동재생은 항상 허용. **소리 있는 자동재생은 기본 차단** (Chrome: 클릭/MEI, Safari: 제스처+이력). iOS는 `playsinline` 필수.
- → **"입장하기" 클릭 = 오디오 컨텍스트 해제 게이트 필수** (AudioContext resume도 제스처 필요). 우회가 아니라 업계 표준 패턴. 헤드폰 안내와 결합해 온보딩 한 화면 해결 가능.

### 6-2. 코덱 [확인]
- **Chrome은 HEVC 디코딩 미지원** → H.264 또는 VP9/AV1 필요. 크로스브라우저는 듀얼 코덱 폴백.
- AV1: HEVC 대비 30~40% 비트레이트 절감, HW 디코딩 주류화.
- 실용 권고: **H.264(High) MP4 기본 + 가능 시 AV1 렌디션.** [추정 — 근거 기반]

### 6-3. 해상도/파일 크기 [확인]
- YouTube 권장: 1080p 8~12Mbps, 4K 30fps 35~45Mbps, 4K 60fps 68Mbps.
- **4K 45Mbps = 분당 약 340MB.** 5분 = 1.7GB → 원본 직배포 비현실적.
- 360의 구조적 문제: 시야 일부만 보므로 체감 4K에 원본 6~8K 필요, OMAF 디코딩 상한 4K → **360은 화질 대비 대역폭 효율이 근본적으로 나쁜 포맷.**

### 6-4. 배포 방식·비용 [부분확인]
- 자체: FFmpeg 다중 해상도 → HLS + 오브젝트 스토리지 + CDN (MIME/CORS 설정), 재생은 hls.js.
- 관리형 단가(2026, 블로그 집계 — 공식 확인 권장): Cloudflare Stream 저장 $5/1,000분·월 + 전송 $1/1,000분, Mux 인코딩 $0.07/분 + 전송 $0.025/분.
- → 초기에는 Cloudflare Stream 또는 R2+CDN이 비용 예측성 최선. **"영상 전송 분수 × 동시 관람자 = 원가"** — 경험 길이는 비용 설계 변수.

### 6-5. 렌더러 — WebGPU는 아직 이름 [확인 — caniuse]
- WebGPU 글로벌 지원율 약 85.6%. Chrome/Edge 113+ 완전, **Firefox 기본 비활성**, Safari 26.0부터 partial.
- **권고: WebGL2 기본 타깃**, WebGPU는 향후 과제. "WebGPU 전면 베이스라인" 류 2026년 블로그 주장은 caniuse 실측과 불일치.

---

## 종합: MRD 반영 5가지 판단

1. **기술 실현 가능성은 이슈 아님** — Frame·Spatial.io가 상용으로 증명, 튜토리얼 수준까지 대중화. **차별화는 콘텐츠 연출과 목적의 단일성.**
2. **Mozilla Hubs 실패가 최대 교훈** — "브라우저 3D 공간"만으로 트랙션 불가. 힐링 단일 목적 + 완성 큐레이션이 방어 포지션.
3. **1호 콘텐츠는 360이 아닌 일반 4K** — 무료 360 일몰 수급 경로 사실상 없음, 일반 4K는 표시 불필요로 무제한급.
4. **"입장하기" 게이트는 필수 요구사항** — 자동재생 정책 + AudioContext + 헤드폰 안내를 한 화면에.
5. **생성형 AI는 확장 경로, 의존 대상 아님** — Sora 6개월 종료 실증. 최종 영상 파일 자산 보유 파이프라인.

**주의**: 2026년 기술 트렌드 블로그 상당수가 1차 자료와 불일치 — 인용 수치는 caniuse·MDN·공식 문서·라이선스 원문으로 재확인 권장.

---

## 출처

**웹 3D 사례**
- https://learn.framevr.io/features · https://www.spatial.io/categories/art-galleries
- https://roadtovr.com/mozilla-hubs-shutdown-web-xr/ · https://www.uploadvr.com/mozilla-hubs-shutdown/
- https://artspaces.kunstmatrix.com/en · https://www.freecodecamp.org/news/build-3d-art-gallery-with-threejs/
- https://discourse.threejs.org/t/virtual-cinema-with-p2p-mesh-share-screen-broadcast/90046
- https://withspace.com/ · https://www.xrhub.co.kr/guide.html
- https://pmc.ncbi.nlm.nih.gov/articles/PMC12251933/ (museum fatigue)

**공간 오디오**
- https://developer.mozilla.org/en-US/docs/Web/API/PannerNode/panningModel
- https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Web_audio_spatialization_basics
- https://wac.ircam.fr/pdf/demo/wac15_submission_16.pdf · https://padenot.github.io/web-audio-perf/
- https://github.com/resonance-audio/resonance-audio

**콘텐츠 소스·라이선스**
- https://www.pexels.com/license/ · https://pixabay.com/service/license-summary/
- https://www.videezy.com/free-video/360-video · https://support.videezy.com/hc/en-us/articles/115002135672
- https://nasa.gov/nasa-brand-center/images-and-media
- https://freesound.org/help/faq/ · https://freesound.org/home/attribution/

**생성형 AI**
- https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation
- https://www.emarketer.com/content/openai-discontinue-sora-app-disney-exits-partnership
- https://deepmind.google/models/veo/ · https://deepmind.google/blog/genie-3-a-new-frontier-for-world-models/

**스트리밍·렌더러**
- https://developer.chrome.com/blog/autoplay · https://support.google.com/youtube/answer/1722171
- https://www.dacast.com/blog/best-video-codec/ · https://dl.acm.org/doi/fullHtml/10.1145/3335053 (OMAF)
- https://caniuse.com/webgpu · https://leanopstech.com/blog/mux-vs-cloudflare-stream-vs-cloudfront-2026/
