# 조사 F — 멀미 저감·감각 안전·접근성 (RFP 보강 조사 원문)

> 조사일: 2026-08-22 / 조사 주체: Opus 5 리서치 에이전트 / 대상: 스크린 기반(비-VR) 1인칭 3D 힐링 경험

---

## 0. 요약 결론

- **비-VR 모니터 1인칭에서도 멀미는 높은 비율로 발생한다.** 콘솔 게임 실험 발생률 42~56%, 데스크톱 시뮬레이터(n=363) 평균 SSQ 39.23 (여성 53.44 / 남성 28.04 — 여성 감수성 약 2배).
- **멀미는 힐링 목적을 직접 파괴한다.** 360° 자연 산책 실험에서 카메라 흔들림 큰 조건 멀미 46% vs 안정화 16%. 멀미 점수는 부정적 정서 증가(rho=0.50)·피로 증가(rho=0.63)·즐거움 감소(rho=-0.48)와 상관. → **멀미 저감은 접근성 옵션이 아니라 핵심 기능 요구사항.**
- 단, 안정화만으로 정서의 유의한 개선은 없었음 — **멀미 제거는 힐링의 필요조건이지 충분조건이 아님.** "멀미 없음"은 성공 기준이 아니라 하한선(gate).
- 업계 표준 저감 세트는 정립돼 있음: FOV 조절 / 헤드밥·카메라 셰이크 off / 모션블러 off / 감도·반전 / 이동속도 / 자동 카메라 이동 off.

## 1. 발생 기전·유발 요인·유병률

- **감각충돌 이론**: 시각은 자기운동감(vection)을 보고하는데 전정기관은 정지를 보고 → 불일치가 멀미 유발. 데스크톱은 HMD보다 덜하나 물리적 운동 단서가 전혀 없어 유발적.
- **주요 유발 요인** (Microsoft XAG 117 명시): 카메라 FOV, **헤드밥**, **모션 블러**, 자동 카메라 각도 변경, 반복적 화면 움직임. GAG 추가: 색수차, 마우스 스무딩, 카메라 셰이크/틸트, 플레이어 입력 없는 카메라 이동.
- **FOV**: GAG 권장 기본값 — TV 60°, **모니터 90°**. 낮은 FOV는 어안 효과 감소로 멀미 완화 (Halo Infinite UI 안내).
- 선형·각가속도가 5~10분 내 유의한 멀미 증상 유발 (Hu et al. SIGGRAPH Asia 2019 — 본문 접근 제한, [추정]).

| 근거 | 조건 | 수치 |
|---|---|---|
| Stoffregen et al. 2008, n=40 | 콘솔 게임 최대 50분 | 발생률 **42~56%** |
| Frontiers in VR 2025, n=363 | 데스크톱 운전 시뮬레이터 | 평균 SSQ **39.23** (여 53.44 / 남 28.04) |
| PMC6839361, n=50 | 360° 자연 산책, 카메라 안정성 비교 | 멀미 **46% vs 16%** (p=0.039) |

주의: "웹 브라우저 WASD 1인칭 전시 관람" 자체의 유병률 데이터는 존재하지 않음 — "인접 조건에서 40% 이상 보고됨"으로 서술이 안전.

## 2. 업계 표준 comfort 옵션

**Microsoft Xbox Accessibility Guideline 117**: 카메라 셰이크·헤드밥·모션 블러를 쓰지 않거나 끌 수 있게 / 조절 가능한 FOV / 수평·수직 감도 개별 조절 / 자동 카메라 이동 비활성화 / 시점 선택.

**대표 사례**: Halo Infinite(블러·셰이크 등 0~100% 개별 슬라이더 + FOV 안내 문구), Cyberpunk 2077(additive camera motion 조절), Elder Scrolls Online(헤드밥 슬라이더), Sea of Thieves(오토센터 on/off+속도), Minecraft(FOV 110°까지).

**Game Accessibility Guidelines**: FOV 적절한 기본값 설정(Basic) + 조절 수단(Intermediate) / 컨트롤 입력과 카메라 움직임의 불일치 회피 / 배경 움직임 off 옵션 / 게임 속도·감도 조절·키 리매핑(Motor Basic) / 깜빡임·반복 패턴 회피.

**연구 기반 추가**: 이동 중 주변부 비네트(FOV restrictor, Fernandes & Feiner 2016) — 몰입감 저하 없이 멀미 감소, 단 HMD 연구라 플랫스크린 전이는 [추정]. 카메라 안정화는 PMC6839361이 직접 근거.

## 3. `prefers-reduced-motion`

- CSS 미디어 피처, 2020년부터 전 브라우저 Baseline. OS 접근성 설정("동작 줄이기") 감지.
- **3D 캔버스에서는 JS로 존중해야 함**: `window.matchMedia('(prefers-reduced-motion: reduce)')` + `change` 리스너로 **런타임 변경도 반영** (web.dev 권고).
- **핵심 원칙(MDN): 제거가 아니라 대체** — 움직임 강도 낮은 대안으로 치환.
- WCAG SC 2.3.3 Animation from Interactions(AAA)의 표준 구현 기법.
- 적용안: reduce 감지 시 Comfort 프로필 자동 적용(헤드밥 0, 셰이크 0, 블러 off, 등속화, 자동 연출 off, 배경 애니메이션 감속) + UI에 알림·해제 노출 [추정 — 관행의 연장].

## 4. 감각 안전 (sensory safety)

**광과민성 — WCAG SC 2.3.1 (Level A, 필수)**
- 1초 내 3회 초과 섬광 금지 (또는 임계값 이하). 일반 섬광 임계: 상대 휘도 10% 이상 반대 방향 변화 + 어두운 쪽 <0.80. **포화 적색(#FF0000) 전이 금지**. 3Hz 이하 자동 통과. 위험대역 5~30Hz. 면적 예외: 10도 시야의 약 25% 이하.
- SC 2.3.2 (AAA): 예외 없이 금지 — 힐링 목적이면 이 수준 권장.
- 유병률: 광과민성 뇌전증 약 1/4000 — 절대 수는 작지만 결과 심각도(발작)가 커 무조건 준수.
- 검증 도구: PEAT는 무료지만 **상업 제작물 평가 사용 금지** — 상업용은 Harding FPA.

**소리 — WCAG SC 1.4.2 (Level A)**: 3초 초과 자동 재생 오디오는 정지 수단 또는 독립 볼륨 필수. W3C 선호 방식은 **사용자 행동으로 소리 시작**. 급작 소리(알람성·급격한 볼륨 점프) 배제, 점진적 크로스페이드 [업계 통념 수준, 추정].

**움직임 — WCAG SC 2.2.2 (Level A)**: 자동 시작 5초 초과 지속 움직임은 일시정지/정지/숨김 수단 필요 — 인트로 시네마틱, 자동 카메라 연출에 적용.

**W3C XAUR** (XR Accessibility User Requirements): REQ 15a(이동 속도 사용자 변경), REQ 16a(멀미 유발 인터랙션의 대안 제공), REQ 16b(깜빡임 최소화·끄기), REQ 3b(비필수 환경 콘텐츠 끄기/음소거).

## 5. 이동·조작 접근성 최소 세트

| # | 항목 | 근거 |
|---|---|---|
| 1 | 이동 속도 조절 (3단+) | XAUR REQ 15a, GAG |
| 2 | 마우스 감도 조절 (수평/수직 분리) | XAG 117 |
| 3 | Y축 시점 반전 토글 | 업계 표준 |
| 4 | 키 리매핑 (최소 WASD/방향키 프리셋) | GAG Motor/Basic |
| 5 | 키보드만으로 시점 회전+이동 가능 | WCAG 2.1.1 |
| 6 | 대체 이동 모드 (지점 워프 / 가이드 투어) | XAUR REQ 16a — 멀미의 근본 대안 |
| 7 | 마우스 스무딩/가속 off (기본 off) | GAG |
| 8 | Esc 즉시 커서 복귀 + 안내 | 웹 특유 [추정] |

## 6. 실질 적용 WCAG (캔버스 3D, 텍스트 거의 없음)

**필수 (Level A/AA, 실질 영향 큼)**: 2.3.1(섬광), 1.4.2(오디오 컨트롤), 2.2.2(움직임 정지), 2.1.1(키보드), 1.1.1(캔버스 대체 텍스트), 2.4.7·1.4.3·1.4.11(설정 UI 포커스·대비).
**권장 (AAA지만 사실상 필수)**: 2.3.3(인터랙션 애니메이션), 2.3.2(섬광 완전 배제).
**해당 없음 (과잉 요구 금지)**: 1.2.x 자막 세트(내레이션 없다면), 1.3.x 대부분, 3.x 대부분.
**WCAG 외 필수 참조**: XAUR REQ 15a/16a/16b/3b + GAG + XAG 117 (comfort의 구체 명세는 사실상 여기뿐).

## 7. RFP 요구사항용 최소 권장 세트 (결론 요약)

- **Comfort [필수]**: 설정 그룹(입장 전에도 접근 가능) / 헤드밥 슬라이더 기본 0 / 카메라 셰이크·부가 모션 기본 off / 모션 블러 기본 off / FOV 60~100° 슬라이더 기본 90° + 안내 문구 / 카메라 등속 옵션 / 자동 카메라 이동 off 가능 / 마우스 스무딩 기본 off. [권장]: 이동 중 비네트, 배경 애니메이션 강도 조절.
- **웹 표준 [필수]**: prefers-reduced-motion 감지 시 Comfort 프로필 자동 적용 + 해제 가능, 런타임 변경 반영, "제거가 아닌 대체".
- **감각 안전 [필수]**: WCAG 2.3.1 (권장 2.3.2 수준), 씬 전환·밝기 변화는 점진 페이드(0.5초+ [내부 기준]), 1.4.2(클릭으로 소리 시작 + 상시 음소거/볼륨), 급작 소리 배제, 2.2.2(연출 건너뛰기). [권장]: 섬광 검증 리포트, 광과민성·멀미 사전 고지.
- **조작 [필수]**: 이동속도/감도(수평·수직)/Y반전/키 리매핑/키보드 전용 관람 가능/Esc 안내. [권장]: 대체 이동 모드 1종, 온보딩 1화면("민감함/보통" 프리셋 선택).

## 출처
- https://journals.sagepub.com/doi/10.1518/001872008X250755 (Stoffregen 2008)
- https://www.frontiersin.org/journals/virtual-reality/articles/10.3389/frvir.2025.1547752/full (데스크톱 시뮬레이터 SSQ)
- https://pmc.ncbi.nlm.nih.gov/articles/PMC6839361/ (카메라 안정화·정서 상관)
- https://learn.microsoft.com/en-us/gaming/accessibility/xbox-accessibility-guidelines/117
- https://gameaccessibilityguidelines.com/full-list/
- https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion
- https://web.dev/articles/prefers-reduced-motion
- https://developer.mozilla.org/en-US/docs/Web/Accessibility/Guides/Seizure_disorders
- https://www.w3.org/WAI/WCAG22/Understanding/three-flashes-or-below-threshold.html
- https://www.w3.org/WAI/WCAG22/Understanding/audio-control.html
- https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html
- https://www.w3.org/WAI/WCAG22/Understanding/keyboard.html
- https://www.w3.org/TR/xaur/
- https://mida.umd.edu/peat/ · https://en.wikipedia.org/wiki/Harding_test
- https://www.semanticscholar.org/paper/c2378b9809763e862533c1edd2771b1b68fde5ad (Fernandes & Feiner 2016)

**조사 한계**: ACM 다수 문헌 본문 접근 불가([추정] 표기), 웹 1인칭 전시 관람 한정 유병률 데이터 부재, 힐링 특화 감각 안전 규범은 업계 통념 수준(수치는 프로젝트 내부 기준으로 정의 권장), prefers-reduced-motion의 3D 카메라 적용은 명문 규범 아닌 연역.
