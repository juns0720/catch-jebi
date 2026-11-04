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

남은 것 (카카오 로그인용, 비밀 키 입력이라 사용자가 직접):
1. Kakao 콘솔 앱 설정 → 보안(어드민 키/보안)에서 Client Secret 생성, 코드 활성화 ON.
2. Supabase Authentication → Providers → Kakao: "Kakao enabled" ON, REST API Key(Kakao 플랫폼 키 페이지)와 Client Secret Code 입력, Save. Callback URL `https://qgalikbkzqnzzwceqdpt.supabase.co/auth/v1/callback`은 이미 Kakao 리다이렉트 URI에 등록돼 있다.

### 2. Kakao Developers (앱 1637686, 새 콘솔 기준)
완료된 것 (2026-11-05):
- 플랫폼 키 → JavaScript 키 카드(⋯ → 수정): JS SDK 도메인 `https://catch-jebi.vercel.app`, `http://localhost:5173`, 카카오 로그인 리다이렉트 URI `https://qgalikbkzqnzzwceqdpt.supabase.co/auth/v1/callback`.
  - 리다이렉트 URI 입력란은 값을 치고 Enter를 눌러야 반영된다. 저장 버튼만 누르면 빈 값으로 저장됨.
- 제품 설정 → 카카오 로그인 → 일반: 상태 ON. 동의항목: 닉네임·프로필 사진 필수 동의.
- JavaScript 키는 Vercel `VITE_KAKAO_JS_KEY`에 넣고 재배포함.

남은 것: 위 Supabase 절의 Client Secret 생성·입력.
공유 카드 미리보기가 안 바뀌면 https://developers.kakao.com/tool/debugger/sharing 에서 캐시 초기화.

### 3. Umami
완료. 대시보드: https://cloud.umami.is/analytics/us/websites/335a580c-6920-44f2-866d-b60df1f3b88d

## 확인된 것 (2026-11-04)

- 로컬과 프로덕션 모두: 제비뽑기 페이지, 챌린지 홈, 레벨 1 플레이, 꽝 잡기와 전선 제비, 헛손질·제비똥·멘트, 기준 시간 실패 쪽지, 당첨 쪽지(당첨·신기록 도장), 레벨 2 해제, 랭킹 탭 빈 상태.
- `/c?l=3&t=21400&n=준서&m=2&r=58` → PC는 도전 받기 카드, 모바일(375px)은 `/m/` 안내 화면으로.
- `/api/og` PNG 생성 (쪽지 디자인, 도전장 도장).
- Supabase·Kakao·Umami 키가 없는 상태에서는 각 기능이 조용히 꺼진다 (오류 없음).
