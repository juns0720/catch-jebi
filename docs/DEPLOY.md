# 배포와 외부 서비스 연결

작성일: 2026-11-04

## 현재 상태

| 항목 | 상태 |
|---|---|
| GitHub | https://github.com/juns0720/catch-jebi (main) |
| Vercel | 프로젝트 `catch-jebi`, GitHub 연결됨, 프로덕션 https://catch-jebi.vercel.app |
| `/api/og`, `/c` | 배포됨. OG 이미지 콜드 3초, 캐시 후 50ms |
| Kakao Developers | 앱 "Catch The Jebi" 생성됨 (앱 ID 1637686) |
| Supabase | 새 프로젝트 대신 기존 `study-note` 프로젝트 공유 (ref `qgalikbkzqnzzwceqdpt`). SQL·함수 배포는 CLI 로그인 대기 |
| Umami | 웹사이트 "Catch The Jebi" 등록됨. Website ID는 Vercel 환경변수에 설정됨 |

## 환경변수 (Vercel)

| 키 | 값 | 상태 |
|---|---|---|
| `VITE_SITE_URL` | https://catch-jebi.vercel.app | 설정됨 |
| `VITE_KAKAO_JS_KEY` | Kakao 플랫폼 키 > JavaScript 키 | **직접 입력 필요** |
| `VITE_SUPABASE_URL` | https://qgalikbkzqnzzwceqdpt.supabase.co | 설정됨 |
| `VITE_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public | CLI 링크 후 설정 |
| `VITE_UMAMI_WEBSITE_ID` | Umami > Websites > Website ID | 설정됨 |
| `VITE_UMAMI_SCRIPT_URL` | https://cloud.umami.is/script.js | 설정됨 |

키는 Vercel 대시보드 Settings → Environment Variables에서 Production/Preview/Development 전부에 넣는다.
로컬은 `vercel env pull .env.local`로 받는다. 키를 넣은 뒤에는 재배포가 필요하다 (`vercel --prod` 또는 push).

## 남은 수동 단계

### 1. Supabase (기존 프로젝트 `study-note` 공유, ref `qgalikbkzqnzzwceqdpt`)
무료 한도 때문에 새 프로젝트 대신 study-note 프로젝트 안에 넣는다. 이 앱의 객체는 전부 `jebi_` 접두어라 다른 테이블과 섞이지 않는다.
단, Auth는 프로젝트 단위라 카카오 로그인 사용자가 study-note의 auth.users에 함께 쌓인다.

1. 터미널에서 한 번 로그인 (브라우저가 열리고 승인만 하면 된다):
   ```
   npx supabase login
   ```
2. 그 다음은 명령으로 끝난다:
   ```
   npx supabase link --project-ref qgalikbkzqnzzwceqdpt
   npx supabase db push
   npx supabase functions deploy jebi-submit-run
   ```
   `db push`가 싫으면 SQL Editor에 `supabase/migrations/0001_init.sql`을 붙여넣어 실행해도 같다.
3. Settings → API의 anon key를 Vercel `VITE_SUPABASE_ANON_KEY`에. URL은 `https://qgalikbkzqnzzwceqdpt.supabase.co` (설정됨).
4. Authentication → Providers → Kakao: 켜고 Kakao REST API 키와 Client Secret 입력. 여기 표시되는 Callback URL을 복사.
5. Authentication → URL Configuration: Site URL은 study-note 것을 건드리지 말고, Redirect URLs에 `https://catch-jebi.vercel.app/challenge/**`, `http://localhost:5173/challenge/**`만 추가.

### 2. Kakao Developers (앱 1637686, 새 콘솔 기준)
새 콘솔은 플랫폼/도메인 설정이 "플랫폼 키" 페이지의 키 카드 안으로 들어갔다.
1. 앱 설정 → 플랫폼 키 → JavaScript 키 카드 → 더보기(⋯) → 수정:
   - 키 이름: `web`
   - JavaScript SDK 도메인: `https://catch-jebi.vercel.app`, `http://localhost:5173`
   - 카카오 로그인 리다이렉트 URI: Supabase Callback URL (Supabase 생성 후)
   - 저장. 그 JavaScript 키 값을 Vercel `VITE_KAKAO_JS_KEY`에.
2. 제품 설정 → 카카오 로그인: 활성화 ON, 동의항목 닉네임·프로필 사진 필수.
3. 앱 설정 → 어드민 키/보안에서 Client Secret 생성, 코드 활성화 ON. REST API 키(플랫폼 키 페이지)와 함께 Supabase Kakao provider에 입력.
4. 공유 카드 미리보기가 안 바뀌면 https://developers.kakao.com/tool/debugger/sharing 에서 캐시 초기화.

### 3. Umami
완료. 대시보드: https://cloud.umami.is/analytics/us/websites/335a580c-6920-44f2-866d-b60df1f3b88d

## 확인된 것 (2026-11-04)

- 로컬과 프로덕션 모두: 제비뽑기 페이지, 챌린지 홈, 레벨 1 플레이, 꽝 잡기와 전선 제비, 헛손질·제비똥·멘트, 기준 시간 실패 쪽지, 당첨 쪽지(당첨·신기록 도장), 레벨 2 해제, 랭킹 탭 빈 상태.
- `/c?l=3&t=21400&n=준서&m=2&r=58` → PC는 도전 받기 카드, 모바일(375px)은 `/m/` 안내 화면으로.
- `/api/og` PNG 생성 (쪽지 디자인, 도전장 도장).
- Supabase·Kakao·Umami 키가 없는 상태에서는 각 기능이 조용히 꺼진다 (오류 없음).
