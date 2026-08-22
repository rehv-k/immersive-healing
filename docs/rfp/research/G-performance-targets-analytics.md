# 조사 G — 성능 기준·저사양 대응·분석 도구 (RFP 보강 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 대상 하한: 외장 GPU 없는 노트북(Intel Iris Xe급 내장 그래픽)

---

## 1. 프레임레이트 목표 관행

- **Google RAIL**: 애니메이션 프레임 예산 10ms 이하(60fps 이론 예산 16ms 중 브라우저가 ~6ms 사용). 지각 사다리: 0–16ms 부드러움 / 100ms 즉각 / 1000ms+ 집중 이탈.
- **사실상의 티어 기준(detect-gpu)**: fps 임계 [0, 15, 30, 60] — **"30fps = 최소 수용선, 60fps = 목표"** 가 코드로 굳어진 관행. 주의: 벤치 데이터 소스가 **2025-12 이후 갱신 중단** → 미판정 GPU 대비 fallback 규칙 필요.
- **내장 그래픽 실측**: Iris Xe에서 드로우콜 1만 개 수준 데모가 ~30fps. 동일 씬이 업무용 노트북 20~30fps vs 게이밍 PC 200fps — 기기 편차 10배 이상이 정상.
- VR 연구의 120fps 임계는 HMD 조건 — 데스크톱 비-VR에 그대로 적용 부적절. 평균 fps보다 **프레임타임 일관성(스터터)** 이 몰입에 더 중요 [추정 — 인과 순위 직접 검증 논문 미확인].

**권장 기준치**: 하한 장비(1920×1080, DPR 1.0, 3분 연속 주행, 전원 연결) 평균 **≥45fps**, 1% low **≥30fps**, 50ms 초과 스파이크 3분당 ≤3회, 입력 반응 ≤100ms. 자동 품질 저하 개입 상태 합격 인정(적용 프리셋·render scale 로그 제출).

## 2. 로딩 시간 기준

- Google/SOASTA: 1→3초 이탈 확률 +32%, 1→5초 +90%, 1→10초 +123%. 모바일 53%가 3초 초과 시 이탈.
- **Core Web Vitals LCP**: 좋음 ≤2.5초 (75퍼센타일). **NN/g**: 10초 = 주의 유지 한계 — 초과 작업은 퍼센트 진행 표시 필수.
- 3D 웹(수십 MB)의 관행: "완전 로드"가 아니라 **단계별 도달 시간**으로 분해 — ① 로딩 화면 즉시 렌더(LCP ≤2.5초) ② 저품질로 먼저 진입, 고품질은 백그라운드 스트리밍 ③ `LoadingManager`로 실측 퍼센트 표시 ④ 뷰포트 우선 로드 + CDN.
- 용량 축소 표준: **Draco**(지오메트리), **KTX2/Basis**(텍스처 — 다운로드와 GPU 메모리 모두 절감, VRAM 최대 ~10배), `gltf-transform` 파이프라인.
- "로딩 화면을 경험의 일부로"는 관행이나 정량 근거 없음 [추정] — 힐링 경험에서는 로딩 구간을 호흡 유도·사운드 페이드인 온보딩으로 전용 가능.

**권장 기준치**: 첫 화면(로딩 씬) ≤2.5초 / 초기 페이로드 ≤15MB [협의치] / 체험 진입 가능 ≤10초 / 고품질 에셋은 백그라운드 스트리밍 / 3초 초과 로딩 시 실측 퍼센트 필수(스피너 단독 불가) / 재방문 ≤3초.

## 3. 저사양 대응 표준 기법

- **(a) 초기 자동 감지**: detect-gpu로 GPU 티어 판정 → 프리셋 자동 선택. **미판정 GPU는 Low에서 시작 후 런타임 상향.**
- **(b) 런타임 적응**: 평균 fps 샘플링 → 상·하한 마진(히스테리시스)을 둬 프리셋 핑퐁 방지 (drei `PerformanceMonitor`가 사실상 표준 구현).
- **(c) 동적 해상도(render scale)**: DPR 0.6~1.5 범위 자동 조정. 카메라 이동 중에만 일시 강등(정지 시 복원) 패턴이 몰입 경험에 특히 유효.
- **(d) 기타**: demand 렌더링, InstancedMesh, LOD, 에셋 재사용.
- WebGL 컨텍스트 손실(`webglcontextlost`) 처리 + WebGL 미지원 안내 화면 필수.

**권장**: 3단 프리셋(Low/Med/High, 차이를 표로 문서화) + 자동 감지 + 수동 오버라이드(localStorage 보존) + 디버그 오버레이(fps/프리셋/render scale/드로우콜 — 검수 수단).

## 4. 4K 비디오 텍스처의 내장 그래픽 성능

**결론: 병목은 디코딩이 아니라 GPU 업로드(프레임 복사).**

- 비용 분해 사례(프레임당): 디코드 2.1ms + 포맷 변환 5.7ms + GPU 업로드 4.0ms = **약 11.8ms → 60fps 예산의 70%를 비디오 텍스처 하나가 소모.**
- 포맷/경로가 지배: `GL_RGB`→`GL_RGBA` 변경만으로 11fps→144fps 사례. 브라우저 편차 극단적(같은 4K60이 Chrome 60fps vs Firefox 93에서 ~5fps). **Windows(ANGLE/D3D)가 가장 취약** — 대상 하한 장비가 정확히 이 조건.
- WebGL2 정석: `texStorage2D`(할당)+`texSubImage2D`(갱신), 가능하면 제로카피 경로(WebCodecs VideoFrame).
- **다중 비디오 텍스처는 사실상 금지** — 2개째 추가 순간 fps 급락 보고.
- Iris Xe 디코드 능력 자체는 충분(AVC/HEVC/VP9/AV1 HW 디코드) — 문제는 텍스처 전달 단계. HDR/10bit는 추가 리스크.
- 현실적 상한 [추정]: 1080p30 안전 / 1440p30 대체로 가능 / 4K30+경량 씬 조건부(최적 경로 전제) / 4K60·다중 스트림 비권장.

**권장 기준치**: 동시 활성 비디오 텍스처 **1개 원칙** / 다중 해상도 소스(2160p/1440p/1080p/720p) 적응 선택, **하한 장비 기본값 1080~1440p, 4K는 성능 여유 확인 후 승격** / 소스 30fps 상한 / H.264 fallback + AV1(또는 HEVC) 효율 렌디션 / 화면 밖·일시정지 시 텍스처 갱신 중단 / Chrome·Edge·Firefox 3종 각각 성능 측정.

## 5. 개인정보 친화적 웹 분석 도구

| | Plausible | Umami | GoatCounter |
|---|---|---|---|
| 쿠키 | 없음 | 없음 | 없음 |
| 식별 | 일일 salt 해시(24h 회전·삭제), IP/UA 원본 미저장 | 익명 해시(알고리즘 미공개) | 집계만 저장 |
| 커스텀 이벤트 | 지원(퍼널 포함) | 지원 | **약함** |
| 셀프호스팅 | 오픈소스 가능 | 오픈소스 무료 | 무료, 단일 Go 바이너리 |

- "방문+체류"만이면 GoatCounter로 충분하나, 몰입 경험의 핵심 지표는 **도달 단계(진입·완주·이탈 지점)** = 커스텀 이벤트 필요 → **Plausible(셀프호스팅) 또는 Umami** 적합.
- Plausible의 salt 24시간 회전이 익명화 근거가 가장 명시적.
- 주의: ① 분석 도구가 IP를 안 남겨도 **웹서버/CDN 액세스 로그가 별도 개인정보** — IP 마스킹 또는 단기 파기 정책 필요. ② 국내법 관점 처리방침에 도구·수집 항목 명시가 안전 [추정 — 국내 규제 1차 자료 미확인]. ③ "가입 없는 익명 서비스"와 가장 깔끔한 조합은 셀프호스팅.

**권장**: 쿠키·영구 식별자 없는 구성(동의 배너 불필요) / 셀프호스팅 / 수집 화이트리스트(씬 진입, 세션 시간, 브라우저·OS, 국가; IP 원본·정밀 위치 금지) / 커스텀 이벤트(로딩 완료, 체험 시작, 완주, 이탈 지점, 적용 품질 프리셋) / 서버 로그 IP 마스킹·단기 파기.

## 출처
- https://web.dev/articles/rail · https://web.dev/articles/vitals
- https://github.com/pmndrs/detect-gpu
- https://ics.media/en/entry/250501/ (Iris Xe 실측)
- https://www.nngroup.com/articles/response-times-3-important-limits/
- https://business.google.com/ca-en/think/marketing-strategies/mobile-page-speed-new-industry-benchmarks/
- https://www.khronos.org/news/press/khronos-ktx-2-0-textures-enable-compact-visually-rich-gltf-3d-assets
- https://r3f.docs.pmnd.rs/advanced/scaling-performance
- https://github.com/bevyengine/bevy/discussions/10686 (비디오 텍스처 비용 분해)
- https://github.com/mrdoob/three.js/issues/28980
- https://discourse.threejs.org/t/how-to-optimize-video-performance-on-a-texture/4707
- https://bugzilla.mozilla.org/show_bug.cgi?id=1736923
- https://www.intel.com/content/www/us/en/developer/articles/technical/encode-and-decode-capabilities-for-7th-generation-intel-core-processors-and-newer.html
- https://plausible.io/data-policy · https://docs.umami.is/docs/faq · https://www.goatcounter.com/help/gdpr
