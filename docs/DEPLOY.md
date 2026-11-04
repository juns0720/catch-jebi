# 배포와 외부 서비스 연결

작성일: 2026-11-04

## 현재 상태

| 항목 | 상태 |
|---|---|
| GitHub | https://github.com/juns0720/catch-jebi (main) |
| Vercel | 프로젝트 `catch-jebi`, GitHub 연결됨, 프로덕션 https://catch-jebi.vercel.app |
| `/api/og`, `/c` | 배포됨. OG 이미지 콜드 3초, 캐시 후 50ms |
| Kakao Developers | 앱 "Catch The Jebi" 생성됨 (앱 ID 1637686) |
| Supabase | **미생성**. 조직의 무료 프로젝트 한도(2개) 초과 |
| Umami | 미등록 |

## 환경변수 (Vercel)

| 키 | 값 | 상태 |
|---|---|---|
| `VITE_SITE_URL` | https://catch-jebi.vercel.app | 설정됨 |
| `VITE_KAKAO_JS_KEY` | Kakao 플랫폼 키 > JavaScript 키 | **직접 입력 필요** |
| `VITE_SUPABASE_URL` | Supabase > Settings > API > Project URL | Supabase 생성 후 |
| `VITE_SUPABASE_ANON_KEY` | Supabase > Settings > API > anon public | Supabase 생성 후 |
| `VITE_UMAMI_WEBSITE_ID` | Umami > Websites > Website ID | Umami 등록 후 |
| `VITE_UMAMI_SCRIPT_URL` | https://cloud.umami.is/script.js | Umami 등록 후 |

키는 Vercel 대시보드 Settings → Environment Variables에서 Production/Preview/Development 전부에 넣는다.
로컬은 `vercel env pull .env.local`로 받는다. 키를 넣은 뒤에는 재배포가 필요하다 (`vercel --prod` 또는 push).

## 남은 수동 단계

### 1. Supabase
1. 조직의 기존 무료 프로젝트 중 하나를 일시정지(Pause)하거나, 유료 플랜으로 올린다.
2. New project: 이름 `catch-the-jebi`, 리전 Northeast Asia (Seoul).
3. SQL Editor에 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행.
4. Edge Function 배포 (터미널에서 한 번 로그인 필요):
   ```
   npx supabase login
   npx supabase link --project-ref <ref>
   npx supabase functions deploy submit-run
   ```
5. Settings → API의 Project URL과 anon key를 Vercel 환경변수에 넣는다.
6. Authentication → Providers → Kakao: 켜고 Kakao REST API 키와 Client Secret 입력. 여기 표시되는 Callback URL을 복사.
7. Authentication → URL Configuration: Site URL `https://catch-jebi.vercel.app`, Redirect URLs에 `https://catch-jebi.vercel.app/challenge/**`, `http://localhost:5173/challenge/**`.

### 2. Kakao Developers (앱 1637686)
1. 플랫폼 키 → JavaScript 키를 Vercel `VITE_KAKAO_JS_KEY`에.
2. Web 플랫폼(사이트 도메인) 등록: `https://catch-jebi.vercel.app`, `http://localhost:5173`.
3. 제품 설정 → 카카오 로그인: 활성화 ON, Redirect URI에 Supabase Callback URL 추가, 동의항목 닉네임·프로필 사진 필수.
4. 보안 → Client Secret 생성, 코드 활성화 ON. REST API 키와 함께 Supabase Kakao provider에 입력.
5. 공유 카드 미리보기가 안 바뀌면 https://developers.kakao.com/tool/debugger/sharing 에서 캐시 초기화.

### 3. Umami
1. https://cloud.umami.is → Websites → Add website: 이름 Catch The Jebi, 도메인 `catch-jebi.vercel.app`.
2. Website ID를 Vercel `VITE_UMAMI_WEBSITE_ID`에.

## 확인된 것 (2026-11-04)

- 로컬과 프로덕션 모두: 제비뽑기 페이지, 챌린지 홈, 레벨 1 플레이, 꽝 잡기와 전선 제비, 헛손질·제비똥·멘트, 기준 시간 실패 쪽지, 당첨 쪽지(당첨·신기록 도장), 레벨 2 해제, 랭킹 탭 빈 상태.
- `/c?l=3&t=21400&n=준서&m=2&r=58` → PC는 도전 받기 카드, 모바일(375px)은 `/m/` 안내 화면으로.
- `/api/og` PNG 생성 (쪽지 디자인, 도전장 도장).
- Supabase·Kakao·Umami 키가 없는 상태에서는 각 기능이 조용히 꺼진다 (오류 없음).
