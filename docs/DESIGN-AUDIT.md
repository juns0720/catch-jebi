# Catch The Jebi 디자인 감사

작성일 2026-11-05. 대상은 프로덕션(https://catch-jebi.vercel.app)의 랜딩 `/`, 챌린지 홈·플레이·결과 쪽지·도전장 인트로·랭킹 탭, 모바일 안내 `/m/`.
스크린샷(라이트·다크, 1280px·375px)과 소스 코드를 함께 봤다. 기준은 다섯 스킬: Hallmark(anti-AI-slop 감사), Vercel Web Interface Guidelines, Emil Kowalski 디자인 엔지니어링, ui-ux-pro-max 우선순위 체크리스트, frontend-design(정체성·카피).

## 0. 한 줄 요약

정체성은 또렷하고 AI 템플릿 티가 거의 없다. 흥부전 제비·전선·쪽지·도장·"강남행" 같은 주제에서 나온 비주얼과 송명×고운돋움 페어링이 한 언어로 묶여 있다. 부족한 건 "손맛" 마감과 몇 가지 깨진 디테일이다. 눌림 피드백이 primary 버튼에만 있고, 타이머 바가 layout 속성을 애니메이션하고, 랜딩 OG 이미지가 404이고, 느린 기록에 "상위 100%"가 찍힌다.

Hallmark 6축 자기평가(1~5): Philosophy 4 · Hierarchy 3 · Execution 3 · Specificity 5 · Restraint 4 · Variety 4. 3 이하인 Hierarchy와 Execution이 이번 수정의 과녁이다.

## 1. Hallmark 감사 (anti-pattern punch list)

구조 지문: 랜딩은 "캔버스 스테이지 + 우측 설정 패널"(Workbench형), 챌린지는 "살아 있는 하늘 위 중앙 로비 카드". 센터 히어로 + 3카드 + CTA + 푸터의 AI 템플릿이 아니다. 보라 그라디언트, Inter 단일 폰트, 3컬럼 피처 그리드, 아이콘 타일 카드, 사이드 스트라이프 카드, 그라디언트 헤드라인, 이탤릭 헤더, 아이브로우 라벨 모두 없음.

### Critical
없음.

### Major
1. **Centred everything** — 챌린지 홈 카드가 제목·탭·티어·CTA·메타·규칙까지 전부 중앙 정렬. `src/challenge/challenge.css:31` `.home-head { text-align: center }`, `:54` `.home-hall`, `src/challenge/home.ts:95-108`. 로비라서 중앙이 자연스럽지만 위계가 평평하다. **Fix:** 제목과 "레벨 N 시작"만 중앙, 티어 행·메타·규칙 문단은 좌측 정렬. 배지를 키우면(§5) 자연스럽게 좌측 축이 생긴다.
2. **Bounce/elastic easing** — `src/styles/tokens.css:57,59` stampIn `cubic-bezier(.3, 1.6, .5, 1)`, `src/challenge/challenge.css:159` endPop `cubic-bezier(.3, 1.5, .5, 1)`. 도장 "쾅"은 종이에 찍히는 물성 연출이라 의도된 overshoot으로 인정. **Fix:** 엔딩 팝만 overshoot을 1.5에서 1.2로 낮추고 시작 scale을 .4에서 .85로.
3. **Soft grey shadow(SaaS 카드 키트)** — `challenge.css:29` `.home-card` `box-shadow: 0 16px 40px rgba(0,0,0,.16)`. 하늘 위 유리 카드에 회색 그림자. 쪽지의 `tokens.css:50` 그림자는 종이 그림자로 정당. **Fix:** 카드 그림자를 하늘 톤으로 틴트: `0 16px 40px color-mix(in srgb, var(--accent) 22%, transparent)`.
4. **Tracked-out label** — `challenge.css:33` `.home-head p { letter-spacing: .08em }` "제비 잡기" 부제. 한글 자간 벌림은 관공서 안내문 느낌이 난다. **Fix:** 자간 0, 부제 문구 자체를 바꾼다(§5 카피).

### Minor
5. **'→' appended to links** — `index.html:21` "제비 잡기 챌린지 →", `src/challenge/home.ts:58` "← 제비뽑기로", `src/mobile/main.ts` "제비뽑기는 폰에서도 돼요 →". **Fix:** 화살표를 빼거나 한 종류의 SVG 아이콘으로 통일.
6. **Middle-dot meta strings** — "레벨 1 · 새끼제비", "꽝 5 · 헛손질 149 · 명중률 4%", "기준 시간 40.0초 · 제비 9마리 · 아직 기록이 없어요" (`src/ui/slip.ts:146,155`, `home.ts:104-105`, `index.html:21`). 가운뎃점은 한글 정서법이라 허용되지만 한 화면에 6줄이면 메타 문자열 템플릿처럼 읽힌다. **Fix:** 결과 쪽지 통계는 3칸(숫자 위, 라벨 아래)으로 펼친다. 홈 메타는 한 줄만 남긴다.
7. **Glassmorphism** — `challenge.css:28` `.home-card` `backdrop-filter: blur(8px)`, `:83` HUD 칩 blur(4px). 살아 움직이는 하늘 위 오버레이라 깊이 전달이라는 목적이 있다. 유지.
8. **Radial bloom** — `challenge.css:154` `.ending` 금색 radial-gradient. 레벨 15 1회성 축하 연출이라 허용.
9. **랭킹 탭 정렬 혼재** — 빈 상태 안내문은 중앙, "명예의 전당" 소제목은 좌측(`src/challenge/rank.ts`). **Fix:** 둘 다 좌측.

**0 critical · 4 major · 5 minor**

## 2. Vercel Web Interface Guidelines (file:line)

### index.html
- index.html:10 - `og:image="/og-default.png"` → **404** (`public/`에 파일 없음). 랜딩을 카톡·슬랙에 붙이면 미리보기가 깨진다. `/api/og?l=1&t=0&n=Catch%20The%20Jebi&m=0` 같은 기본 카드로 바꾸거나 PNG 추가
- index.html:5 - `<meta name="theme-color">` 없음. 라이트 `#e9eee8`, 다크 `#0e141d`를 `media` 속성으로 두 개
- index.html:14 - Google Fonts preconnect ✓. 제목 폰트 preload 없어 송명체 FOUT. Google Fonts URL은 preload 불가하니 서브셋 셀프호스팅으로(§6-10)
- index.html:47-55 - radiogroup 라벨 ✓, textarea `<label>` ✓, 칩 버튼 `<button>` ✓
- 랜딩은 모바일에서도 열리는데 버튼·칩에 `touch-action: manipulation` 없음, `.chip:hover`(lottery.css:54)에 `@media (hover: hover)` 게이트 없음

### challenge/index.html
- challenge/index.html:5 - theme-color 없음
- challenge/index.html:18 - canvas `role="img"` + aria-label ✓. 조작이 포인터 전용이고 키보드 대안이 없다. 게임 본질상 예외로 두되, 홈 규칙 문단에 "마우스 전용"을 한 번 적는다

### src/styles/tokens.css
- tokens.css:41 - `.btn.primary { transition: transform .12s }` easing 미지정(기본 `ease`). 명시적 ease-out
- tokens.css:43-44 - `.btn.ghost` hover `border-color` 전환 0ms, `:active` 없음
- tokens.css:60 - reduced-motion ✓

### src/challenge/challenge.css
- challenge.css:97 - `.hud-bar i { transition: width .1s linear }` → layout 속성을 60fps로 애니메이션. `transform: scaleX()` + `transform-origin: left`
- challenge.css:49 - `.lv-btn:hover` hover 게이트 없음(PC 전용 페이지라 영향 작음)
- challenge.css:134 - `.modal-veil`, slip.ts:31 `.rs-veil` 스크롤 가능한데 `overscroll-behavior: contain` 없음
- challenge.css:16-18 - `.home` 스크롤 영역 위에 고정 `.home-top`. `scroll-padding-top` 없어 키보드 포커스가 상단 바에 가려질 수 있음
- challenge.css:144 - `.taunt-input:focus { outline: none }` → `:145` `:focus-within` 링으로 대체 ✓
- challenge.css:176 - `.toast` transition 속성 명시 ✓

### src/ui/slip.ts
- slip.ts:132 - 백분위 `top = ceil(100 - p)`: 꼴찌면 **"상위 100%"** 노출(스크린샷 확인). 50% 밖이면 숨기거나 "뒤에서 N%"로
- slip.ts:178 - 닉네임 input 보이는 `<label>` 없음(aria-label + placeholder만). 작은 라벨 추가
- slip.ts:178 - `autocomplete="off"`, `spellcheck=false`, `maxlength` ✓
- slip.ts:231-240 - dialog `role`/`aria-modal`/포커스 트랩 ✓. ESC 비활성은 의도. 700ms 클릭 가드 동안 포커스된 "다시 하기"에 Enter를 쳐도 무반응이라 "안 눌리는 버튼"처럼 느껴짐 → 가드 동안 `disabled`를 걸고 0.7s 뒤 푼다
- slip.ts:128,141 - 도장 `aria-hidden` 없음(장식이 아니라 결과이므로 OK), `rs-pct` aria-live ✓
- 숫자 포맷 `toFixed(1)` 하드코딩. 단일 로케일이라 실질 문제 없음

### src/challenge/hud.ts
- hud.ts:61 - 카운트 `aria-live="off"`(의도) ✓, :77 팝업 `aria-live="polite"` ✓
- hud.ts:69-75 - 포기 2단계 확인 ✓
- hud.ts:120 - `void pop.offsetWidth` 강제 리플로우로 keyframe 재시작 → WAAPI `el.animate()`로

### src/challenge/sharemodal.ts
- `<label>`로 라디오 래핑 ✓, 직접 입력 aria-label ✓, ESC·바깥 클릭 닫기 ✓, 포커스 트랩 ✓

### src/mobile/mobile.css
- mobile.css:2 - `100dvh` ✓, safe-area ✓

### 공통
- 아이콘 버튼 aria-label ✓ (`ui.ts:43`). `<img>` 없음(SVG 인라인·캔버스) ✓. `user-scalable` 제한 없음 ✓. `transition: all` 없음 ✓. 대체 없는 `outline: none` 없음 ✓. 빈 상태 카피 전부 있음 ✓. 긴 닉네임 ellipsis ✓ (`challenge.css:69`)

## 3. Emil Kowalski 렌즈: 손맛

빈도 기준 판단. 레벨 시작·재시도·결과 쪽지는 하루 수십 번 보는 UI라 300ms 아래로. 레벨 15 엔딩은 1회성이라 지금 길이(0.9s+)를 허용한다.

| Before | After | Why |
| --- | --- | --- |
| `.btn.primary { transition: transform .12s }` (tokens.css:41) | `transition: transform 140ms cubic-bezier(.23, 1, .32, 1)` | 기본 `ease`는 밋밋하다. 강한 ease-out이 "듣고 있다"는 느낌을 준다 |
| `.btn.ghost`, `.chip`, `.lv-btn`, `.home-tab`, `.taunt-row`에 `:active` 없음 | `:active { transform: scale(.97) }` 같은 토큰 | 누를 수 있는 모든 것이 눌려야 한다. 지금은 primary만 눌린다 |
| `.hud-bar i { transition: width .1s linear }` (challenge.css:97) | `transform: scaleX(v); transform-origin: left; transition: transform 100ms linear` | layout 대신 compositor. 매 틱 width 재계산 제거 |
| `endPop from { scale(.4) }` + `cubic-bezier(.3,1.5,.5,1)` (challenge.css:159,168) | `from { scale(.85); opacity: 0 }` + overshoot 1.2 | 아무것도 없던 데서 튀어나오지 않게. 바운스는 절제 |
| `.toast` 진입 = 퇴장 200ms 기본 ease (challenge.css:176) | 진입 220ms ease-out, 퇴장 140ms, `translateY(8px)` | 퇴장은 진입보다 빠르게 |
| 쪽지 unfold .55s + 도장 .35s(지연 .55s) = 도장까지 0.9s (tokens.css:56-57) | unfold .45s, 도장 지연 .4s, 총 0.75s | 매 판 보는 화면. 0.15s만 줄여도 체감이 다르다 |
| `.hud-pop.show` keyframes + `offsetWidth` 리플로우 재시작 (hud.ts:120) | `pop.animate([...], { duration: 1600, easing })` | 중단 가능하고 리플로우 해킹이 사라진다 |
| `.rs-veil` 즉시 등장 (slip.ts:31) | `@starting-style { opacity: 0; transform: translateY(6px) }` 160ms | 결과 시트가 "툭" 나타나는 걸 막는다. 모달이라 `transform-origin`은 center 유지 |
| 꽝 잡으면 1초 손 묶임(게임 룰) | 룰 유지. 커서만 1초 `not-allowed` + HUD 칩 살짝 흔들림 | 페널티라는 걸 손이 아니라 눈으로도 알게 |
| `.hud-timer.danger .hud-time` 1s 무한 pulse (challenge.css:105) | 유지. reduced-motion에서 꺼짐 ✓ | 마지막 5초 긴장감은 목적이 분명하다 |

쪽지가 펼쳐지는 unfold 애니메이션과 도장 overshoot은 이 사이트의 "기억에 남는 한 가지"다. 줄이지 말고 타이밍만 다듬는다.

## 4. ui-ux-pro-max 우선순위 점검

| 우선순위 | 항목 | 결과 |
| --- | --- | --- |
| 1 접근성 | 텍스트 대비 | 라이트: muted 4.84, fg 13.5, accent-fg 11.4, seal-on-paper 4.54 — 통과. 다크: muted 6.9, accent-fg 10.5 통과. **다크 도장·당첨 글자 `--seal #e2584b` on paper `#ece2c8` = 2.84 실패.** `#b8362b`면 4.52, `#b03226`이면 4.89 |
| 1 접근성 | 포커스 링 | 전 컨트롤 `:focus-visible` 2px accent ✓ |
| 1 접근성 | 아이콘 버튼 라벨 | 음소거 버튼 aria-label·aria-pressed ✓ |
| 2 터치 | 타깃 크기 | 레벨 버튼 38px(PC 전용이라 허용). 랜딩 칩 ~30px 높이는 모바일에서도 열리므로 36px 이상으로 |
| 3 성능 | CLS·폰트 | 이미지 없음 CLS 0. 제목 폰트 FOUT. OG 폰트 9MB는 서버 전용이라 사용자 영향 없음 |
| 4 스타일 | 자동 추천 | 스킬이 "캐주얼 게임"에 Claymorphism + Fredoka/Nunito + 핑크·골드를 추천했다. 이 프로젝트의 정체성(전래동화·종이·먹색)과 정면 충돌하므로 **채택하지 않는다.** 추천 중 "soft press 200ms", "reward gold" 두 가지는 이미 있다 |
| 5 레이아웃 | 반응형 | 랜딩 375px 1열 스택 ✓, 가로 스크롤 없음 ✓. 챌린지는 900px 미만 게이트로 보냄(의도) |
| 6 타이포 | 본문 크기 | 본문 15px(16 권장, PC 전용이라 허용). 12px 텍스트 `.rank-row .dt`, `.hud-level span` 경계 |
| 7 애니메이션 | reduced-motion | 전 페이지 처리 ✓ |
| 8 폼 | 라벨·에러 | 닉네임 보이는 라벨 없음(§2). 에러 인라인 + 포커스 이동 ✓ |
| 9 내비 | URL 상태 | 홈 탭(플레이/랭킹) URL 미반영. `?tab=rank` 딥링크가 있어야 "랭킹 봐" 공유가 된다 |

## 5. frontend-design 렌즈: 정체성과 카피

**지금 잘 된 것.** 비주얼이 전부 주제에서 나왔다(흥부전 제비, 전선 위에 앉는 꽝 제비, 쪽지, 도장, 똥, "강남행"). 송명(명조 디스플레이) × 고운돋움(둥근 고딕 본문)은 역할이 분명한 두 패밀리다. 종이색 쪽지가 "과감함을 한 군데 쓰는" 요소다. 흔한 AI 디폴트 대조: 크림+테라코타 아님, 검정+형광 아님, 브로드시트 아님. 부분 해당은 SaaS 카드 키트(radius 18px 통일 + 회색 그림자)와 템플릿 크롬(가운뎃점 메타, → 링크)뿐.

**구조 제안 3가지.**
1. **챌린지 홈 카드를 쪽지 언어로.** 지금 홈은 유리 카드이고 쪽지가 아니다. 랜딩 결과·결과 쪽지·공유 이미지·도전장 인트로는 전부 종이인데 로비만 다른 재질이다. 카드 배경을 `--paper`로 바꾸거나 최소한 제목 블록만 쪽지 위에 얹는다.
2. **티어 배지를 히어로로.** 72px 배지와 24px 이름은 작다. "나 강남제비야"가 바이럴의 핵심 문장이므로 배지 120px, 이름 32px, 좌측 정렬, 레벨 그리드는 오른쪽 열로. 이것이 §1-1 중앙 정렬 문제도 같이 푼다.
3. **랜딩 패널 폭.** `lottery.css:9` 340px 고정이라 1440px 이상에서 하늘만 넓어지고 글줄은 짧다. `clamp(320px, 28vw, 420px)`.

**카피.** 전반 톤이 좋다("제비들이 강남으로 돌아갔어요", "손 속도 꽤 되시네요"). 고칠 것:
- "상위 100%" → 50% 밖이면 숨기거나 "뒤에서 N%".
- 챌린지 부제 "제비 잡기" → 제목과 뜻이 겹친다. 규칙을 한 줄로: "당첨 제비 한 마리를 기준 시간 안에".
- 랜딩 "눈 감고 한 마리 잡기" → 무엇이 일어나는지 모호. "아무 제비나 한 마리".
- 결과 쪽지 버튼 "랭킹" → "랭킹 보기"처럼 동사로. "다시 하기"·"다음 레벨"은 좋다.
- 홈 "최고 클리어 레벨 3"은 좋은 상태 문장. "아직 아무도 박씨를 물어오지 못했어요"는 빈 상태를 초대로 바꾼 좋은 예.

## 6. 우선순위 수정 목록

1~6번은 2026-11-05에 적용했다: `/api/og?site=1` 랜딩 카드, "뒤에서 N%" 분기, `--ease-out`·`--dur-*` 토큰과 전 pressable `:active scale(.97)`, 타이머 바 `scaleX`, 세 페이지 `theme-color`, 종이 위 붉은색 `--seal-ink`(다크 #b8362b). 토스트 진입/퇴장 비대칭과 쪽지 도장 타이밍(0.75s)도 함께.

| # | 수정 | 근거 | 예상 |
| --- | --- | --- | --- |
| 1 | `og-default.png` 404 해결 (api/og 기본 카드 또는 PNG) | §2 바이럴 핵심 경로 | 30분 |
| 2 | "상위 100%" 카피 분기 | §2, §5 | 10분 |
| 3 | 모션 토큰(`--ease-out`, `--dur-fast/base`) + 모든 누르는 요소 `:active scale(.97)` | §3 | 1시간 |
| 4 | 타이머 바 `scaleX` | §2, §3 | 20분 |
| 5 | `theme-color` 메타 3페이지 | §2 | 10분 |
| 6 | 다크 모드 `--seal` 대비(≥4.5) | §4 | 20분 |
| 7 | 챌린지 홈: 좌측 축 + 배지 확대 + 종이 재질 | §1, §5 | 2시간 |
| 8 | 랭킹 탭 `?tab=rank` | §4 | 30분 |
| 9 | hover 게이트·touch-action·overscroll-behavior | §2 | 30분 |
| 10 | 송명·고운돋움 서브셋 셀프호스팅 + preload | §2, §4 | 2시간 |

## 부록: 확인한 사실

- 대비 계산은 WCAG 상대휘도 공식으로 토큰 hex 값에서 직접 계산했다(§4 표).
- 결과 쪽지 캡처는 자동 플레이(캔버스 픽셀 스캔 + PointerEvent)로 레벨 1을 45.3초에 클리어해 얻었고, 그 기록(헛손질 149, 닉네임 없음)은 리더보드에서 지웠다.
- Hallmark 스탬프(`/* Hallmark · macrostructure … */`)와 `design.md`는 이 프로젝트에 없다. 토큰은 `src/styles/tokens.css`가 사실상 design system 역할을 한다.
