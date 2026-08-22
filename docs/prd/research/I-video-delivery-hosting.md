# 조사 I — 영상 전송·호스팅·인코딩 (PRD 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 요금은 공식 요금 페이지 기준

## 0. 트래픽 전제 (4분 일몰 영상, H.264 30fps)

| 렌디션 | 비트레이트 | 4분 크기 |
|---|---|---|
| 2160p | 16 Mbps | ~480 MB |
| 1440p | 9 Mbps | ~270 MB |
| 1080p | 5.5 Mbps | ~165 MB |
| 720p | 3 Mbps | ~90 MB |

1뷰 ≈ 219 MB (렌디션 분포 가정) → 1,000뷰/월 ≈ 220 GB, 10,000뷰/월 ≈ 2.2 TB.

## ① 전송 방식 비교 — 결론: 프로그레시브 MP4 승

| | (a) 해상도별 MP4 + 1회 선택 | (b) HLS/DASH 적응형 | (c) 관리형(Stream/Mux) |
|---|---|---|---|
| 끊김 없는 루프 | **최상** (캐시 상주, 이중 video 스왑 가능) | **취약** — hls.js 루프 버그(#3986, #6890), MSE 재시작 갭 구조적 | (b) 문제 상속 |
| 비디오 텍스처 궁합 | **최상** | iOS 네이티브 HLS의 WebGL 텍스처 블랙 이력(WebKit #179417 등) | 동일 + 벤더 플레이어 우회 필요 |
| 1인 구현 복잡도 | **최저** | 중~상 | 중 |
| 비용 | **최저** (R2 결합 시 ~$0) | 유사 | 뷰당 과금 (CF Stream 전송 $1/1,000분) |

**판단 근거**: 자산이 사실상 1개(고정 길이) + 재생 패턴이 "1회 로드 → 무한 루프" = ABR의 이득이 없고 ABR의 최약점(루프 이음새 + WebGL 텍스처)에 정확히 해당.

## ② 호스팅 비용 (2026 공식 요금)

| 서비스 | 무료 티어 | 비고 |
|---|---|---|
| **Cloudflare R2** | 스토리지 10GB-월, Class B 1,000만/월, **에그레스 전액 무료** | **최적.** 프로덕션은 r2.dev 금지 → **커스텀 도메인 필수** |
| Cloudflare Pages | 정적 자산 요청 무제한 무료 | 파일당 **25 MiB 상한** → 영상 불가, 사이트 셸 전용 |
| Bunny CDN Standard | 월 최소 $1 | 아시아 $0.03/GB, **서울 PoP 보유** |
| Bunny CDN Volume | $0.005/GB | 서울 없음, 도쿄 최근접 |
| Backblaze B2 | 10GB 무료 | Bunny/Cloudflare 파트너 CDN 에그레스 무료 |
| GitHub Pages | — | **부적합** (사이트 1GB 상한, 100GB/월) |
| Vercel Hobby | 100GB/월 | **부적합** (~450뷰에서 소진 + 30일 정지, 비상업 조항) |
| Netlify Free | ~15GB/월 | **부적합** (~68뷰) |
| Mux | 전송 10만 분/월 무료 | 넉넉하나 저장 10개 제한·락인·hls.js 필요 |

**월 비용**: R2+커스텀 도메인 = **$0** (1,000~10,000뷰 모두, 도메인비 제외). Bunny Volume ~$1~11.

**약관**: Cloudflare 현행 Service-Specific Terms에서 **R2 등 Cloudflare 서비스에 호스팅된 콘텐츠는 CDN 영상 제한의 명시적 예외** — R2 커스텀 도메인 영상 서빙은 무료 플랜에서 허용.

## ③ 권장 조합

```
사이트 셸(HTML/JS)      → Cloudflare Pages
영상 MP4 4종 렌디션     → Cloudflare R2 + 커스텀 도메인
glTF/Draco·KTX2·오디오  → 동일 R2 버킷
전송                    → 프로그레시브 MP4 + 로드 시 1회 적응 선택
```
필수 설정: Edge TTL 1년 + `Cache-Control: immutable`, Tiered Cache, CORS(`crossorigin="anonymous"`), 압축 자산 이중 압축 금지.

**한국 레이턴시 [추정]**: Cloudflare 무료 플랜의 서울(ICN) 라우팅 미보장 — LAX 라우팅 사례 보고(2026에도). 이 워크로드는 순차 다운로드라 RTT 영향은 TTFB에 한정. 완화: (A) 720p 선재생 → 목표 렌디션 백그라운드 프리페치 후 스왑 (B) 영상만 Bunny 서울($0.03/GB) (C) Bunny Volume 도쿄($0.005/GB). **M0에서 한국발 실측 후 결정, 선제 이전 불필요.**

## ④ 인코딩 권장

| 렌디션 | H.264 Profile@Level | 목표/maxrate/bufsize |
|---|---|---|
| 2160p | High@5.1 | 16M / 20M / 32M |
| 1440p | High@5.0 | 9M / 12M / 20M |
| 1080p | High@4.0 | 5.5M / 7M / 12M |
| 720p | High@3.1 | 3M / 4M / 7M |

FFmpeg 핵심 옵션 (1080p 예):
```bash
ffmpeg -i master.mov -an \
  -vf "scale=1920:1080:flags=lanczos,format=yuv420p" \
  -c:v libx264 -profile:v high -level:v 4.0 -preset slower -crf 19 \
  -maxrate 7M -bufsize 12M \
  -x264-params "keyint=60:min-keyint=60:scenecut=0:open_gop=0:aq-mode=3:aq-strength=1.1:deblock=-1,-1" \
  -r 30 -fps_mode cfr -color_primaries bt709 -color_trc bt709 -colorspace bt709 \
  -movflags +faststart out_1080p.mp4
```
- **`-an` 오디오 제거 필수** — AAC 인코더 프라이밍(~21ms)이 MP4 루프 갭의 원흉. 오디오는 별도 파일 + Web Audio 루프.
- `aq-mode=3` — 일몰 하늘 그라데이션 **밴딩 억제**의 핵심. 10-bit는 브라우저 HW 디코딩 호환성 때문에 금지 — 밴딩 심하면 마스터에 미세 디더.
- 2초 클로즈드 GOP(keyint=60@30fps), 총 프레임을 GOP 배수로 트림.
- AV1: 후순위 (Safari 커버리지 부족 + R2에선 절감 인센티브 없음, Bunny 전환 시 1080p 이하 검토). HEVC: 스킵.

## ⑤ 끊김 없는 루프 — 채택 조합

1. **루프-세이프 마스터** (끝 1초를 앞 1초와 크로스페이드해 사전 인코딩) — 반드시 적용
2. **이중 `<video>` A/B 스왑** + 두 VideoTexture — 본편 권장
3. **`requestVideoFrameCallback`** 으로 마지막 프레임 감지(스왑 트리거 정밀화)
4. **셰이더 크로스페이드** (uMix 0.2~0.5s) — 스왑 은폐
5. **오디오 분리 + `AudioBufferSourceNode.loop`** — 샘플 정확 루프

렌디션 선택 스케치: 3D 스크린의 화면상 픽셀 폭 × DPR + deviceMemory/hardwareConcurrency/downlink 힌트로 1회 결정. 기본 1080p, 조건 충족 시 1440p/2160p 승격, downlink<6Mbps면 720p.

## ⑥ 에셋 호스팅 헤더

glTF/GLB+Draco(`model/gltf-binary`), KTX2(`image/ktx2`) — immutable, 재압축 금지. 오디오는 **Opus(.webm) 우선**(프라이밍이 컨테이너 명시라 정확 디코드). 전 자산 CORS.

## 출처 (핵심)
- https://developers.cloudflare.com/r2/pricing/ · /r2/buckets/public-buckets/ · /pages/platform/limits/
- https://www.cloudflare.com/service-specific-terms-application-services/ · https://blog.cloudflare.com/updated-tos
- https://bunny.net/pricing/ · https://bunny.net/network/
- https://github.com/video-dev/hls.js/issues/3986 · /issues/6890
- https://bugs.webkit.org/show_bug.cgi?id=179417 · =215908
- https://developer.mozilla.org/en-US/docs/Web/API/HTMLVideoElement/requestVideoFrameCallback
- https://developer.apple.com/documentation/http-live-streaming/hls-authoring-specification-for-apple-devices
- https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
- https://vercel.com/docs/limits/fair-use-guidelines · https://www.netlify.com/pricing/ · https://www.mux.com/pricing
- 한국 라우팅: https://community.cloudflare.com/t/zone-consistently-routed-to-lax-colo-instead-of-nearest-icn-edge-for-korean-traffic/943630
