# 조사 B — 경쟁/대체재 분석 (MRD 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 방법: 웹 검색 및 원문 확인
> 표기: 확인된 사실은 그대로, 추론·미검증은 **(추정)** / **(미검증)** 명시

---

## 1. 유튜브 360/VR 영상 (박물관·자연·힐링)

### 무엇인가
360도 파노라마 영상을 브라우저 드래그 또는 헤드셋으로 시청. 자연·명상·박물관 투어 카테고리가 두터우며, 사실상 "무료 몰입 영상"의 기본값 플랫폼.

### 핵심 한계 (공간감/몰입/힐링 관점)

| 항목 | 내용 |
|---|---|
| 해상도 | 360도 구 전체에 해상도 분산 → 4K 360의 체감 시야는 약 720p. 8K 업로드 허용해도 재생은 4K 상한 + 강한 압축 |
| 공간 사운드 | 1차 앰비소닉(1st-order) 상한. 정위감 뭉개짐 |
| 이동 자유도 | 카메라 위치 고정 = 시선만 회전(3DoF). "걸어다니는 공간감" 원천 불가 |
| 제작 품질 | 스티칭 아티팩트, 시차 오류, 손떨림 만연 |
| 플랫폼 의지 | 2015–2018 적극 지원 → 이후 방치. iOS Cardboard 종료, AV1 전환 시 5K/6K→4K 축소 |
| 경험 성격 | 완전 수동적 시청. 관람자의 선택·발걸음·머무름 없음 |

### 시사점
접근성 최강(무료·무설치)이자 몰입도 최약(고정 시점·저정위 사운드). **경쟁 축은 화질이 아니라 자유 이동(6DoF)과 정위 사운드** — 유튜브가 구조적으로 못 따라오는 축.

---

## 2. 템플릿형 가상 갤러리 플랫폼

| 서비스 | 무엇 | 강점 | 약점 (몰입/힐링 관점) | 가격 |
|---|---|---|---|---|
| **Artsteps** | 웹 3D 전시 제작·공개 | 무료 진입, 교육·개인작가 표준, 무설치 | **조작감 악명** — "거의 항해 불가능", 벽 끼임, 로딩 느림, 저해상도, "초보 Unity 씬" 룩, 배치 틀어짐 버그 | 무료 + 프리미엄 (요금 세부 미검증) |
| **Kunstmatrix** | 상업 갤러리용 가상 전시 | 포토리얼 룸, 판매 연동 | **판매 도구**이지 체험물 아님. 정적 화이트큐브 | 전시 단위/월 구독 |
| **Spatial** | 멀티유저 3D 월드 | 한때 가상 갤러리 대표주자 | **2026.7.27 Creator Platform Free/Pro 종료** — 사유: "개방형 멀티플레이 3D 월드 호스팅 비용 급증". 엔터프라이즈만 유지 | Free/Pro 소멸 |
| **OnCyber** | NFT 3D 쇼룸 | 무료 생성 | NFT/크립토 문맥 결속 → 힐링 관람객과 불일치 | 기본 무료 |
| **국내** (갤러리360, WithSpace, XRHUB, ARTOGO 등) | 기관·기업용 온라인 전시관 구축 | B2B 구축 대행 | 대부분 360 파노라마+핫스팟 또는 템플릿 룸. 홍보 목적, 정서 체험 설계 아님 | 견적형 B2B (추정) |

### 시사점
- 이 카테고리는 "작품을 벽에 거는 도구"이지 "공간을 체험시키는 작품"이 아님 — 목적함수가 다름.
- **Artsteps 최다 불만이 이동 조작감** → 부드러운 WASD+카메라 감각이 실제 미충족 니즈.
- Spatial 무료 티어 철수의 양면: (a) 무료 3D 월드 공급 공백 = 기회, (b) 멀티플레이 호스팅 비용의 지속불가능성 경고 → **싱글플레이어 + 정적 CDN이 비용 방어선.**

---

## 3. 고급 웹 몰입 경험 (에이전시/스튜디오 WebGL)

| 스튜디오 | 성격 | 대표성 |
|---|---|---|
| Active Theory | 대규모 실시간 WebGL | Google·Nike·Netflix 캠페인, Awwwards SOTD |
| Resn | 캐릭터·유머 인터랙티브 | Awwwards Site of the Year 복수 수상 |
| Immersive Garden / Unseen / Locomotive | 스크롤 시네마틱 3D | Awwwards 수상 다수 |

### 왜 일회성인가
1. **캠페인 종속** — 종료 시 사이트 소멸/방치, 재방문 이유 없음.
2. **감탄 소비형** — 클라이맥스 한 번 소비하면 끝. 업계 내부 비판: "3D 와우 모먼트의 시대는 끝나가고 있다", "모든 섹션이 히어로가 되려 해 숨 쉴 곳이 없다".
3. **정서 목적 부재** — 목표가 브랜드 전환이지 이완이 아님.
4. **자유 이동 부재 (추정)** — 대부분 스크롤/온레일 카메라. WASD 자유 보행형은 소수.
5. **접근 비용** — 고사양 GPU 전제, 수십 MB 로딩.

### 시사점
비주얼 퀄리티의 **벤치마크**로 삼되 경쟁 상대 아님. **"3분의 감탄"이 아니라 "20분의 체류"를 설계**한다는 것이 포지셔닝 문장.

---

## 4. 웹 기반 힐링/앰비언트 서비스

| 서비스 | 무엇 | 인기 근거 | 약점 (공간감/몰입) | 가격 |
|---|---|---|---|---|
| **Calm** (Scenes) | 명상 앱 내 자연 영상+사운드 배경 | 브랜드·콘텐츠 규모 | 2D 평면, 탐색 불가, 앱 종속·결제 장벽 | 연 $69.99–79.99 |
| **lofi.cafe** | 24/7 무료 로파이+앰비언트 | 계정·구독·광고 전무, 즉시 재생 | 정지 일러스트+오디오. 공간·이동·정위 없음 | 무료 (기부) |
| **WindowSwap** | 전 세계 창밖 10분 HD 영상 | 2020 팬데믹기 대규모 언론 호평 | 고정 창문 프레임, UGC 품질 편차 | 무료 + $5/월·$50/년 |
| **Drive & Listen** | 도시 대시캠 주행+현지 라디오 | 이동감+로컬리티 | 조수석 승객 — 방향 선택·하차 불가 | 무료 (추정) |
| **virtualvacation.us** | 도시 걷기·운전·라이브캠 | Similarweb 3개월 랭킹 상승, 전월 대비 트래픽 +25.51% | Street View 스티치 → 순간이동, 공간 사운드 없음 | 무료 (추정) |
| **Google Arts & Culture** | 500+ 기관 Street View 투어 | 압도적 콘텐츠 | "어지럽다"는 평(Artnews), 정적, 화질 편차 | 무료 |
| **itch.io HTML5 워킹심** | relaxing/calming 태그 브라우저 게임 | 무료, 실제 자유 보행 | 개인 제작 수준 비주얼·오디오, 웅장함 부재 | 무료 |
| **Museum of Other Realities** | VR 멀티유저 아트 뮤지엄 | 몰입도 최상급 | **헤드셋 필수 + Steam 설치** → 접근성 붕괴 | 약 $20 |

---

## 5. 직접 경쟁자 존재 여부 — 5요건 교차 검증

요건: ① 웅장한 공간감 ② 자유 이동(WASD/6DoF) ③ 공간(정위) 사운드 ④ 힐링 목적 ⑤ 무료 웹(무설치)

| 카테고리 | ① | ② | ③ | ④ | ⑤ |
|---|:--:|:--:|:--:|:--:|:--:|
| 유튜브 360 | △ | ✕ | △ | ○ | ○ |
| Artsteps/Kunstmatrix | ✕ | △ | ✕ | ✕ | ○/✕ |
| Spatial | △ | ○ | △ | ✕ | ✕ |
| OnCyber | △ | ○ | ✕(추정) | ✕ | ○ |
| 에이전시 WebGL | ◎ | ✕(추정) | △ | ✕ | ○(한시) |
| Calm/lofi.cafe | ✕ | ✕ | ✕ | ◎ | ✕/○ |
| WindowSwap/Drive&Listen | ✕ | ✕ | ✕ | ◎ | ○ |
| virtualvacation/GA&C | △ | △ | ✕ | △ | ○ |
| itch.io 워킹심 | ✕ | ◎ | △ | ○ | ○ |
| MoOR | ◎ | ◎ | ◎ | △ | ✕ |

### 결론
**5요건을 모두 충족하는 확인된 직접 경쟁자 없음.** 최근접: (a) Museum of Other Realities — 몰입 4요건 충족하나 헤드셋·유료로 탈락, (b) itch.io 무료 워킹심 — 접근성·자유이동 충족하나 웅장함·프로덕션 밸류 탈락. **경쟁 공백은 "몰입도 × 접근성" 교차점.**
단, 영어권 웹 검색 기반의 부재 증명으로 불완전 — "규모·완성도·지속 운영을 갖춘 사업적 경쟁자의 부재"로 서술 권장 (미홍보 개인 Three.js 작품은 산발 존재).

---

## 핵심 시사점 (MRD 반영)

1. **차별화 축은 화질이 아니라 행위권(agency)** — "움직일 수 있는 힐링"이 빈 슬롯.
2. **조작감이 곧 제품** — 카메라 관성·시야각·충돌 처리가 1순위 스펙.
3. **공간 사운드는 방어 가능한 해자** — PannerNode 기반 저비용·고체감 차별점.
4. **비용 구조를 멀티플레이로 끌고 가지 말 것** — 싱글 세션 + 정적 CDN (전략적 추론).
5. **수요는 실재·성장 중** — virtualvacation +25%, WindowSwap $50/년 성립 = 지불 의사 존재.
6. **수익화 스펙트럼** — lofi.cafe(기부) → WindowSwap($5/월) → Calm($70/년). 초기 유사 선례는 WindowSwap 모델.
7. **일회성 감탄 회피** — 재방문 훅(시간대/날씨 변화, 신규 씬)을 요구사항에 명시.

---

## 출처

**유튜브 360/VR**
- https://360labs.net/blog/does-youtube-still-care-about-immersive-video
- https://medium.com/visbit/why-do-all-the-360-vr-videos-today-look-so-pixelated-b1ab3cba6f95
- https://www.saritasa.com/insights/using-360-video-in-vr-the-good-the-bad-and-the-nauseating

**가상 갤러리**
- https://fliphtml5.com/guide/tools/virtual-exhibition-platforms/
- https://uackahmsc.wordpress.com/2021/01/08/artsteps/
- http://betterposters.blogspot.com/2021/06/poster-sessions-in-street-view-review.html
- https://www.kunstmatrix.com/en
- https://www.uploadvr.com/spatial-is-discontinuing-its-creator-platform-in-july/
- https://www.spatial.io/blog/spatial-creator-platform-sunsetting
- https://roadtovr.com/spatial-social-xr-enterprise-pivot/
- https://oncyber.io/about
- https://www.gallery360.co.kr/ · https://withspace.com/ · https://www.xrhub.co.kr/guide.html · https://artogo.co/service/exhibition/virtual

**에이전시 WebGL**
- https://www.awwwards.com/sites/active-theory-v4 · https://www.awwwards.com/awwwards/collections/webgl/
- https://www.psychoactive.co.nz/content-hub/best-webgl-interactive-3d-agencies
- https://www.utsubo.com/blog/award-winning-website-design-guide

**힐링/앰비언트 웹**
- https://carepaths.com/calm-app-pricing/ · https://loficafe.net/
- https://en.wikipedia.org/wiki/WindowSwap · https://www.smithsonianmag.com/smart-news/window-swap-180975334/
- https://virtualvacation.us/ · https://www.similarweb.com/website/virtualvacation.us/
- https://www.artnews.com/art-in-america/columns/virtual-museum-tours-google-1202682783/

**인접/참고**
- https://store.steampowered.com/app/613900/Museum_of_Other_Realities/
- https://itch.io/games/tag-relaxing/tag-walking-simulator · https://itch.io/games/html5/tag-calming
- https://discourse.threejs.org/t/here-after-all-a-walkable-memory-estate-in-the-browser/92995

**미확인/추가 검증 권장**: Artsteps 2026 현행 요금, OnCyber 2026 전략, Drive & Listen·virtualvacation 수익모델, 에이전시 작품 중 WASD 자유보행 사례 전수, 국내 플랫폼 요금·이동 방식.
