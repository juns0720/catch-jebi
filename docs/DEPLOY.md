# 배포와 외부 서비스 연결

작성일: 2026-11-04

## 현재 상태

| 항목 | 상태 |
|---|---|
| GitHub | https://github.com/juns0720/catch-jebi (main) |
| Vercel | 프로젝트 `catch-jebi`, GitHub 연결됨, 프로덕션 https://catch-jebi.vercel.app |
| `/api/og`, `/c` | 배포됨. OG 이미지 콜드 3초, 캐시 후 50ms |
| Kakao Developers | 앱 "Catch The Jebi" (앱 ID 1637686). JS SDK 도메인·리다이렉트 URI 등록됨, 카카오 로그인 ON, 동의항목(닉네임·프로필 사진 필수) 설정됨. 프로덕션에서 카카오톡 공유 친구 선택 화면 확인됨 (2026-11-05) |
| Supabase | 기존 `study-note` 프로젝트 공유 (ref `qgalikbkzqnzzwceqdpt`). `jebi_` 테이블·뷰·RPC 적용됨, Edge Function `jebi-submit-run` 배포됨, 제출→리더보드 확인됨 |
| Umami | 웹사이트 "Catch The Jebi" 등록됨. Website ID는 Vercel 환경변수에 설정됨 |

## 환경변수 (Vercel)

| 키 | 값 | 상태 |
|---|---|---|
| `VITE_SITE_URL` | https://catch-jebi.vercel.app | 설정됨 |
| `VITE_KAKAO_JS_KEY` | Kakao 플랫폼 키 > JavaScript 키 (공개용 클라이언트 키) | 설정됨 (`--type config`, 2026-11-05) |
| `VITE_KAKAO_REST_KEY` | Kakao 플랫폼 키 > REST API 키 (카카오 로그인 client_id, 인가 URL에 노출되는 값) | 설정됨 |
| `KAKAO_REST_API_KEY` | 같은 값. `api/kakao-token`이 토큰 교환에 쓴다 | 설정됨 |
| `KAKAO_CLIENT_SECRET` | 콘솔 REST API 키 카드의 "카카오 로그인 클라이언트 시크릿 활성화"를 켤 때만 | 미설정 (활성화 OFF 상태) |
| `VITE_GOOGLE_CLIENT_ID` | Google Cloud 프로젝트 `catch-jebi` > 인증 > 클라이언트 > 웹 클라이언트 ID (공개용) | 설정됨 (2026-11-05) |
| `VITE_SUPABASE_URL` | https://qgalikbkzqnzzwceqdpt.supabase.co | 설정됨 |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon public (공개용 키) | 설정됨 (`--type config`) |
| `VITE_UMAMI_WEBSITE_ID` | Umami > Websites > Website ID | 설정됨 |
| `VITE_UMAMI_SCRIPT_URL` | https://cloud.umami.is/script.js | 설정됨 |

키는 Vercel 대시보드 Settings → Environment Variables에서 Production/Preview/Development 전부에 넣는다.
로컬은 `vercel env pull .env.local`로 받는다. 키를 넣은 뒤에는 재배포가 필요하다 (`vercel --prod` 또는 push).

## 남은 수동 단계

### 1. Supabase (기존 프로젝트 `study-note` 공유, ref `qgalikbkzqnzzwceqdpt`)
무료 한도 때문에 새 프로젝트 대신 study-note 프로젝트 안에 넣는다. 이 앱의 객체는 전부 `jebi_` 접두어라 다른 테이블과 섞이지 않는다.
단, Auth는 프로젝트 단위라 카카오 로그인 사용자가 study-note의 auth.users에 함께 쌓인다.

완료된 것 (2026-11-05): CLI 로그인·link, `supabase db query --remote -f supabase/migrations/0001_init.sql`로 스키마 적용, `supabase functions deploy jebi-submit-run --no-verify-jwt`, anon 키 Vercel 설정. 합성 기록을 제출해 percentile/rank와 리더보드 뷰까지 확인한 뒤 테스트 행은 지웠다.

스키마를 다시 적용하거나 함수를 다시 배포할 때:
```
npx supabase db query --remote --yes -f supabase/migrations/0001_init.sql
npx supabase functions deploy jebi-submit-run --no-verify-jwt --yes
```

완료된 것 (2026-11-05): Authentication → URL Configuration의 Redirect URLs에 `https://catch-jebi.vercel.app/challenge/**`, `http://localhost:5173/challenge/**` 추가됨 (Site URL은 study-note 것 그대로).

Kakao provider (2026-11-05): "Kakao enabled" ON, REST API Key·Client Secret 입력됨, "Allow users without an email" ON.
단, Supabase 기본 OAuth 흐름은 `account_email` 스코프를 항상 요청하는데 이메일 동의항목은 비즈 앱(사업자 등록)에서만 쓸 수 있어 KOE205로 막힌다.
그래서 앱은 provider의 OAuth 흐름 대신 **id_token 흐름**을 쓴다: 브라우저가 kauth.kakao.com/oauth/authorize(client_id=REST 키, scope `openid profile_nickname profile_image`, nonce)로 갔다가 `/challenge/?code=`로 돌아오면 `/api/kakao-token`이 코드를 id_token으로 바꾸고 `supabase.auth.signInWithIdToken({ provider: 'kakao' })`로 세션을 만든다. provider 설정에서 실제로 쓰이는 건 enabled 와 Client ID(aud 검증)뿐이다.

Google provider (2026-11-05 완료): `supabase/config.toml`의 `[auth.external.google]`(enabled, client_id)을 `npx supabase config push --yes`로 밀어 넣었다. config push는 선언된 항목만 바꾸고 study-note의 나머지 auth 설정은 건드리지 않는다 (`npx supabase config diff`로 먼저 확인). id_token 흐름이라 시크릿은 비어 있다.

### 2. Kakao Developers (앱 1637686, 새 콘솔 기준)
완료된 것 (2026-11-05):
- 플랫폼 키 → JavaScript 키 카드(⋯ → 수정): JS SDK 도메인 `https://catch-jebi.vercel.app`, `http://localhost:5173`, 카카오 로그인 리다이렉트 URI `https://qgalikbkzqnzzwceqdpt.supabase.co/auth/v1/callback`.
  - 리다이렉트 URI 입력란은 값을 치고 Enter를 눌러야 반영된다. 저장 버튼만 누르면 빈 값으로 저장됨.
- 제품 설정 → 카카오 로그인 → 일반: 상태 ON. 동의항목: 닉네임·프로필 사진 필수 동의.
- JavaScript 키는 Vercel `VITE_KAKAO_JS_KEY`에 넣고 재배포함.
- REST API 키 카드(⋯ → 수정): 카카오 로그인 리다이렉트 URI `https://catch-jebi.vercel.app/challenge/`, `http://localhost:5173/challenge/` (리다이렉트 URI는 키 카드별로 따로 등록된다). "카카오 로그인 클라이언트 시크릿 활성화"는 OFF (켜면 Vercel에 `KAKAO_CLIENT_SECRET`을 넣어야 한다).
- 카카오 로그인 → 일반: OpenID Connect 활성화 ON (id_token을 받기 위해 필요).
- `/api/kakao-token`에 가짜 코드를 보내면 KOE320(코드 없음)이 돌아온다 = 환경변수와 카카오 연결 정상.

남은 것: 실제 카카오 계정으로 로그인 흐름 한 번 확인 (동의 화면 → 돌아와서 "카카오 로그인 됐어요" 토스트, 헤더에 닉네임).

### 2-1. Google 로그인 (Google Cloud 프로젝트 `catch-jebi`) — 완료 (2026-11-05)
Google Identity Services 버튼 → id_token → `signInWithIdToken({ provider: 'google' })`. 클라이언트 ID만 있으면 되고 시크릿은 쓰지 않는다 (콘솔이 보여준 클라이언트 보안 비밀번호는 어디에도 저장하지 않았다).
- Google Auth Platform: 앱 이름 `Catch The Jebi`, 지원·연락처 이메일, 대상 외부, 홈페이지 `https://catch-jebi.vercel.app`, 개인정보처리방침 `https://catch-jebi.vercel.app/privacy.html` (`public/privacy.html`). 앱 게시 → 프로덕션 단계. 기본 스코프만 쓰므로 검수 불필요.
- 클라이언트 `catch-jebi web` (웹 애플리케이션): JavaScript 원본 `https://catch-jebi.vercel.app`, `http://localhost:5173`, `http://localhost`; 리디렉션 URI `https://qgalikbkzqnzzwceqdpt.supabase.co/auth/v1/callback` (지금 흐름엔 안 쓰임).
- 클라이언트 ID는 Vercel `VITE_GOOGLE_CLIENT_ID`와 `supabase/config.toml`에 있다. 없으면 Google 버튼이 그려지지 않을 뿐 다른 기능엔 영향 없다.
- 앱 게시 버튼은 브랜딩에 홈페이지·개인정보처리방침 URL이 있어야 활성화된다.
공유 카드 미리보기가 안 바뀌면 https://developers.kakao.com/tool/debugger/sharing 에서 캐시 초기화.

### 3. Umami
완료. 대시보드: https://cloud.umami.is/analytics/us/websites/335a580c-6920-44f2-866d-b60df1f3b88d

## 확인된 것 (2026-11-04)

- 로컬과 프로덕션 모두: 제비뽑기 페이지, 챌린지 홈, 레벨 1 플레이, 꽝 잡기와 전선 제비, 헛손질·제비똥·멘트, 기준 시간 실패 쪽지, 당첨 쪽지(당첨·신기록 도장), 레벨 2 해제, 랭킹 탭 빈 상태.
- `/c?l=3&t=21400&n=준서&m=2&r=58` → PC는 도전 받기 카드, 모바일(375px)은 `/m/` 안내 화면으로.
- `/api/og` PNG 생성 (쪽지 디자인, 도전장 도장).
- Supabase·Kakao·Umami 키가 없는 상태에서는 각 기능이 조용히 꺼진다 (오류 없음).
