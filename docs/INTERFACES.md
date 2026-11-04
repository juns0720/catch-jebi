# 모듈 계약 (INTERFACES)

병렬 구현을 위한 파일 소유권과 모듈 API. `src/types.ts`가 타입의 원본이다. 여기 적힌 시그니처를 바꾸지 말 것.
공통 규칙: 바닐라 TypeScript, 프레임워크 없음, 테스트 파일 작성 안 함, `pnpm typecheck` 통과가 완료 기준.
스타일은 `src/styles/tokens.css`의 CSS 변수만 쓴다. 폰트는 Google Fonts 링크 (Song Myung, Gowun Dodum).

## 소유권

| 담당 | 파일 |
|---|---|
| A 제비뽑기 | `index.html`, `src/lottery/**` |
| B 엔진 | `src/game/engine.ts`, `src/game/render.ts`, `src/game/juice.ts`, `src/game/birds.ts` (자유) |
| C 오디오·뱃지·이미지 | `src/game/audio.ts`, `src/ui/badges.ts`, `src/ui/shareImage.ts` |
| D 챌린지 UI | `challenge/index.html`, `src/challenge/**`, `src/ui/slip.ts`, `src/ui/share.ts`, `src/data/storage.ts`, `m/index.html`, `src/mobile/**` |
| E 백엔드 | `api/**`, `supabase/**`, `src/data/supabase.ts`, `src/data/analytics.ts`, `public/fonts/**` |
| 공용 (수정 금지) | `src/types.ts`, `src/game/levels.ts`, `src/styles/tokens.css`, `vite.config.ts`, `package.json` |

다른 담당의 모듈을 import할 때는 아래 시그니처만 믿고 쓴다. 그 모듈이 아직 없으면 빌드가 깨지는 건 정상이고 통합 때 맞춘다.
단, 자기 모듈은 **반드시 아래 시그니처 그대로** export 한다.

---

## B. `src/game/engine.ts`

```ts
import type { GameOptions, GameHandle } from '@/types';
export function createGame(opts: GameOptions): GameHandle;
```

책임
- 캔버스 크기/DPR 관리 (ResizeObserver), 렌더 루프, 포인터 입력 전부 엔진 안에서 처리.
- 원본 아티팩트(`docs/reference/original-artifact.html`)의 제비 물리·회피·예측·버둥거림·`nerves()` 로직을 그대로 가져오되 레벨 파라미터(`LevelDef`)로 구동.
- 제비 중 1마리가 당첨 (`winPersonality(level)` 사용). `winHint`만큼 쪽지 색을 `--gold`와 섞는다.
- `start()` 호출 전: 제비 없이 하늘만 그린다 (`ready` 이벤트). `start()`에서 제비가 양옆에서 진입하고 타이머 시작.
- 꽝 잡음: 타이머 계속. 1초간 캔버스 위에 작은 쪽지 펼침(꽝 글자), 그동안 클릭은 `blocked`. 그 제비는 화면 오른쪽 전선으로 날아가 앉아 펼친 쪽지를 들고 있음 (전선 제비). 전선은 오른쪽 상단에 그린다.
- 당첨 잡음: 150ms 히트스톱 후 `catchWin` → `end`(cleared=true).
- 기준 시간(`parMs`) 초과: `fail` → 제비들이 1.2초 동안 양옆으로 빠져나감 → `end`(cleared=false, timeMs=parMs).
- 남은 5000ms 진입 시 `lastSeconds` 1회.
- 헛손질: 빈 곳 / 회피 / 탈출. 연속 streak 관리. `poopAfter` 연속이면 제비똥: 가까운 꽝 제비가 급강하, 커서 위치에 반경 60px 얼룩 (최대 3개, 20초 후 소멸). 얼룩 클릭 3회면 제거(`wipe`, 헛손질 아님). 얼룩 아래의 제비는 흐리게.
- 누적 헛손질 3/7/15/30에서 `taunt` 이벤트 (문구는 SPEC 3.6). 기존 팝업('휙!','어림없지','놓쳤다!')도 캔버스에 그린다.
- 쪽지 바꿔치기(`swapEveryMs` 있을 때): 주기마다 `swap: warn`(1초 예고, 두 제비가 서로를 향해 기움) → `swap: cross`(0.4초 교차, 둘 다 못 잡음, 클릭은 miss) → 당첨이 상대 제비로 이동 → `swap: done`. 전선 제비는 후보 제외.
- 화면 흔들림: 헛손질 2px, 연속일수록 최대 6px. 히트스톱: 꽝 60ms, 당첨 150ms. `reducedMotion`이면 둘 다 끔.
- `tapLog`에 모든 클릭 기록. `RunResult.stamps`는 엔진이 계산: `win`(cleared), `poop`(accuracy<0.5), `nolbu`(misses>=15), `heungbu`(cleared && blanks===0), `gangnam`(!cleared), `close`(cleared && parMs-timeMs<=1000). `record`는 안 붙인다.
- `tick` 이벤트는 매 프레임이 아니라 100ms마다.
- 캔버스 안에는 HUD 숫자를 그리지 않는다 (HUD는 D가 DOM으로). 캔버스에는 세계, 팝업 문구, 꽝 쪽지 펼침만.

## C. `src/game/audio.ts`, `src/ui/badges.ts`, `src/ui/shareImage.ts`

```ts
// audio.ts — Web Audio 합성. 에셋 파일 없음. 처음 play 전 resume() 필요.
import type { AudioBus } from '@/types';
export function createAudio(): AudioBus;
```
- `heartbeat`는 1회 두근. 호출 쪽이 반복한다. `fanfare`는 당첨, `fail`은 하강음, `poop`은 철퍽, `wire`는 전선 출렁 짧은 띵.

```ts
// badges.ts — 64×64 기준 SVG 문자열. 색은 currentColor + CSS 변수(--bird, --seal, --belly, --gold) 사용.
import type { Tier } from '@/types';
export function badgeSvg(tier: Tier, size?: number): string;        // inline SVG markup
export function badgeDataUrl(tier: Tier, colors: { bird: string; seal: string; belly: string; gold: string }, size?: number): string; // 캔버스/OG용. CSS 변수 대신 실제 색을 넣은 data: URL
```
- 콘셉트: SPEC 5.1. chick=둥지 속 솜털 제비, town=전선 위 제비, gangnam=윤기+멋부린 깃, heungbu=다리에 실, gourd=박씨 물고 금빛 테두리. 원본 캔버스 제비 실루엣 언어(검은 몸, 붉은 부리, 밝은 배).

```ts
// shareImage.ts — 1080×1350 PNG. 쪽지 디자인. 폰트는 document.fonts에 로드된 Song Myung/Gowun Dodum 사용.
import type { RunResult, Tier } from '@/types';
export interface ShareImageOpts { nickname: string | null; tier: Tier; siteUrl: string; ghostName?: string; ghostMs?: number; }
export async function renderResultImage(r: RunResult, o: ShareImageOpts): Promise<Blob>;
export function downloadBlob(blob: Blob, filename: string): void;
```
- 내용: 뱃지, "레벨 N · 티어명", 큰 시간(초, 소수 1자리), "꽝 n · 헛손질 n · 명중률 n%", 도장들(랜덤 각도로 겹침), 하단 siteUrl. 실패면 "강남행" 도장과 "레벨 N에서 제비에게 짐".

## D. 챌린지 UI

```ts
// src/ui/share.ts
import type { ChallengeParams } from '@/types';
export function buildChallengeUrl(p: ChallengeParams, siteUrl: string): string;   // `${siteUrl}/c?l=..&t=..&n=..&m=..&mx=..&r=..`
export function parseChallengeParams(search: string): ChallengeParams | null;
export function tauntText(p: ChallengeParams): string;                             // TAUNTS[m] ({t} → 초) 또는 mx
export function initKakao(jsKey: string): boolean;                                 // SDK 로드+init. 키 없으면 false
export function shareKakao(p: ChallengeParams, o: { siteUrl: string; imageUrl: string }): Promise<boolean>;
export function sendToMeKakao(url: string, o: { title: string; imageUrl: string }): Promise<boolean>; // 모바일 게이트 "나에게 보내기"
export async function copyText(t: string): Promise<boolean>;
```
- Kakao SDK: `https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js` integrity 없이 동적 로드. `Kakao.Share.sendDefault({objectType:'feed', ...})`. 버튼 제목 "도전 받기".

```ts
// src/data/storage.ts — localStorage. 키 prefix 'ctj:'
import type { Progress, RunResult } from '@/types';
export function loadProgress(): Progress;        // 없으면 생성 (deviceId = crypto.randomUUID())
export function saveProgress(p: Progress): void;
export function recordRun(r: RunResult): { progress: Progress; isRecord: boolean; unlockedNow: number | null };
```

```ts
// src/ui/slip.ts — 결과 쪽지 오버레이 (DOM). tokens.css의 .slip/.stamp 사용
import type { RunResult, Tier } from '@/types';
export interface SlipActions { retry(): void; next(): void | null; shareKakao(): void; copyLink(): void; saveImage(): void; openRank(): void; }
export interface SlipOpts { result: RunResult; tier: Tier; isRecord: boolean; bestMs: number | null; ghost?: { name: string; ms: number } | null; percentile?: number | null; nicknamePrompt?: { onSubmit(n: string): Promise<string | null> } | null; loginPrompt?: { onClick(): void } | null; actions: SlipActions; hasNext: boolean; }
export function showResultSlip(root: HTMLElement, o: SlipOpts): { close(): void; setPercentile(p: number | null): void };
```

`challenge/index.html` + `src/challenge/main.ts` (컨트롤러)
- 진입 시 `!matchMedia('(pointer: fine)').matches || innerWidth < 900` → `location.replace('/m/' + location.search)`.
- 화면 상태: `home` → `play` → (결과 쪽지) → `home`/`play`.
- home: 타이틀 "Catch The Jebi", 현재 티어 뱃지, "레벨 N 시작" 큰 버튼, 레벨 선택(해제된 것만), 내 최고 기록, 박씨 제비 n명(`fetchHallOfFame`), 랭킹 탭(레벨별/종합, `fetchLeaderboard`), 카카오 로그인 버튼(세션 있으면 닉네임 표시), 음소거 토글, "제비뽑기로" 링크.
- play: 캔버스 풀스크린, HUD DOM 오버레이 (좌상단 레벨·뱃지, 우상단 타이머 + 기준 시간 바, 도전장이면 친구 기록 바, 하단 꽝·헛손질, 좌하단 포기, 우하단 음소거). 남은 5초 붉게 + heartbeat 반복.
- 도전장 수신(`parseChallengeParams`): home 생략하고 바로 해당 레벨 play. 상단에 "{n}의 기록 {t}초 · {도발}". 친구 시간 넘기면 바 붉게 + "졌다" 팝업. 결과 쪽지에 이겼다/졌다. "되돌려 보내기"는 도전장 생성(도발 선택 모달) 흐름.
- 결과: `recordRun` → `submitRun`(E) → 쪽지 표시. 상위 20%면 닉네임 입력 프롬프트, 상위 1%면 로그인 프롬프트.
- 공유 이미지 URL: `${siteUrl}/api/og?` + 동일 파라미터.
- 분석 이벤트: `track()`(E) 호출 지점은 SPEC 9장.
- 환경변수: `import.meta.env.VITE_SITE_URL`, `VITE_KAKAO_JS_KEY`.

`m/index.html` + `src/mobile/main.ts`
- SPEC 4.2. 도전장 파라미터 있으면 친구 기록과 도발 표시. 버튼: 링크 복사, 카카오톡 나에게 보내기, "제비뽑기는 폰에서도 돼요 →"(`/`). `mobile_gate_view`, `mobile_send_to_me` 이벤트.

## E. 백엔드

```ts
// src/data/supabase.ts — anon 클라이언트. env 없으면 모든 함수가 {ok:false} / [] 로 조용히 실패.
import type { RunResult, LeaderboardRow, HallOfFameRow } from '@/types';
export function hasSupabase(): boolean;
export async function submitRun(r: RunResult, nickname: string | null, deviceId: string): Promise<{ ok: boolean; id?: string; percentile?: number; rank?: number; error?: string }>;
export async function setNickname(runId: string, deviceId: string, nickname: string): Promise<{ ok: boolean; error?: string }>; // 욕설이면 error 메시지
export async function fetchLeaderboard(level: number | 'overall', limit?: number): Promise<LeaderboardRow[]>;
export async function fetchHallOfFame(): Promise<HallOfFameRow[]>;
// 로그인은 Google만 (src/data/google.ts: GIS 버튼 → signInWithGoogleIdToken). 카카오 로그인은 2026-11-05에 뺐다.
export async function signInWithGoogleIdToken(token: string, nonce: string): Promise<'ok' | 'error'>;
export async function getSessionNickname(): Promise<string | null>;  // 로그인 유저면 kakao 닉네임
export async function signOut(): Promise<void>;
```
- insert는 Edge Function `submit-run` 경유 (service role). 클라이언트는 `supabase.functions.invoke('submit-run', { body })`.
- `percentile`: 같은 레벨 클리어 기록 중 내 기록보다 느린 비율 (0~100, 높을수록 좋음). 실패 기록은 percentile 없음.

`supabase/migrations/0001_init.sql`
- `runs` 테이블 (SPEC 8.1 + `par_ms`, `cleared`, `accuracy`, `stamps text[]`, `input text default 'pc'`), RLS: anon select는 뷰로만.
- 뷰 `leaderboard_level` (cleared and not flagged, 레벨별 time_ms 순, nickname null이면 '이름 없는 제비'), RPC `leaderboard_overall()` (device_id 또는 user_id 기준 max level → min time), 뷰 `hall_of_fame` (level 15 cleared, created_at 순, first 플래그).
- 로그인 시 같은 device_id의 runs에 user_id 채우는 RPC `claim_runs(device_id)` (authenticated만).

`supabase/functions/submit-run/index.ts` (Deno)
- body `{ action: 'submit', run: RunResult, nickname, deviceId, clientVersion }` 또는 `{ action: 'nickname', runId, deviceId, nickname }`.
- 검증 (SPEC 8.2): tapLog 길이 ≥ blanks+(cleared?1:0), 연속 탭 간격 ≥ 60ms, timeMs ≤ parMs, timeMs ≥ 1500, level 1~15. 실패면 flagged=true로 저장.
- 닉네임: 2~10자, 한글/영문/숫자/공백. `badwords.ts`의 목록으로 정규화(공백·특수문자 제거, 자모 분리 복원 시도) 후 검사. 걸리면 400 `{ error: '제비가 그 이름은 못 물어가요' }`.
- CORS 허용. 응답 `{ ok, id, percentile, rank }`.

`api/og.ts` (Vercel Edge, `@vercel/og`)
- 쿼리 `l,t,n,m,mx,r`. 1200×630. 쪽지 디자인(종이색 `#f3ead3`, 잉크 `#2b2317`, 도장 `#c0392b`). 내용: "{n}의 도전장", "레벨 {l} · {티어명}", 큰 "{t/1000}초", 도발 문구, "도전장" 도장, 하단 "Catch The Jebi".
- 폰트: `public/fonts/SongMyung-Regular.ttf`, `GowunDodum-Regular.ttf`를 `fetch(new URL('../public/fonts/..', import.meta.url))`로 로드. 폰트는 https://github.com/google/fonts 의 `ofl/songmyung`, `ofl/gowundodum`에서 받는다 (OFL).
- `Cache-Control: public, max-age=86400`.

`api/c.ts` (Vercel Edge)
- `/c?...` → HTML. `<meta property="og:title|og:description|og:image|og:url">`, `twitter:card=summary_large_image`, 그리고 `<meta http-equiv="refresh" content="0;url=/challenge/?{같은 쿼리}">` + `<script>location.replace(...)</script>`. og:image는 `${origin}/api/og?{쿼리}`.
- 쿼리 값은 HTML 이스케이프.

```ts
// src/data/analytics.ts — Umami
import type { AnalyticsEvent } from '@/types';
export function initAnalytics(): void;   // VITE_UMAMI_WEBSITE_ID 있으면 script 삽입 (data-website-id, defer). 없으면 no-op
export function track(e: AnalyticsEvent, props?: Record<string, string | number | boolean>): void;  // window.umami?.track
```

## A. 제비뽑기 (`index.html`, `src/lottery/main.ts`)

- `docs/reference/original-artifact.html`을 Vite 페이지로 이식. 기능·디자인 동일. 스타일은 tokens.css를 import하고 페이지 고유 스타일만 `src/lottery/lottery.css`.
- 추가: 상단 헤더 오른쪽에 "제비 잡기 챌린지 →" 링크(`/challenge/`). 모든 제비를 잡았을 때 캔버스 아래 안내 대신 결과 패널 하단에 "손 속도 꽤 되시네요. 챌린지 해보실래요?" 버튼(`/challenge/?from=cta`). 이 버튼 클릭에 `track('challenge_enter', {from:'cta'})`, 헤더 링크는 `{from:'menu'}`. 페이지 진입 `track('landing_view')`, 모두 잡으면 `track('lottery_done')`.
- `<title>Catch The Jebi · 살아있는 제비뽑기</title>`, OG 기본 메타(og:title, og:description "강남 갔던 제비들이 쪽지를 물고 돌아왔어요", og:image `/og-default.png`는 나중에).
- 모바일에서도 그대로 동작해야 한다 (원본이 그렇다).
