// Supabase anon 클라이언트. env 없으면 모든 함수가 조용히 실패값을 돌려준다.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RunResult, LeaderboardRow, HallOfFameRow } from '@/types';

const URL_ = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const KEY_ = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
const CLIENT_VERSION = '0.1.0';

let client: SupabaseClient | null = null;

export function hasSupabase(): boolean {
  return !!(URL_ && KEY_);
}

function sb(): SupabaseClient | null {
  if (!hasSupabase()) return null;
  if (!client) client = createClient(URL_!, KEY_!);
  return client;
}

/** FunctionsHttpError 의 응답 본문에서 error 문구를 꺼낸다. */
async function errorMessage(err: unknown): Promise<string> {
  try {
    const ctx = (err as { context?: unknown })?.context;
    if (ctx instanceof Response) {
      const j = await ctx.clone().json() as { error?: string };
      if (j?.error) return j.error;
    }
  } catch { /* 본문 없음 */ }
  return (err as { message?: string })?.message || 'error';
}

export async function submitRun(
  r: RunResult, nickname: string | null, deviceId: string,
): Promise<{ ok: boolean; id?: string; percentile?: number; rank?: number; error?: string }> {
  const c = sb();
  if (!c) return { ok: false, error: 'no-supabase' };
  try {
    const { data, error } = await c.functions.invoke('jebi-submit-run', {
      body: { action: 'submit', run: r, nickname, deviceId, clientVersion: CLIENT_VERSION },
    });
    if (error) return { ok: false, error: await errorMessage(error) };
    const d = data as { ok?: boolean; id?: string; percentile?: number; rank?: number; error?: string } | null;
    if (!d || d.ok === false) return { ok: false, error: d?.error ?? 'error' };
    return { ok: true, id: d.id, percentile: d.percentile, rank: d.rank };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'error' };
  }
}

export async function setNickname(runId: string, deviceId: string, nickname: string): Promise<{ ok: boolean; error?: string }> {
  const c = sb();
  if (!c) return { ok: false, error: 'no-supabase' };
  try {
    const { data, error } = await c.functions.invoke('jebi-submit-run', {
      body: { action: 'nickname', runId, deviceId, nickname },
    });
    if (error) return { ok: false, error: await errorMessage(error) };
    const d = data as { ok?: boolean; error?: string } | null;
    if (!d || d.ok === false) return { ok: false, error: d?.error ?? 'error' };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || 'error' };
  }
}

export async function fetchLeaderboard(level: number | 'overall', limit = 100): Promise<LeaderboardRow[]> {
  const c = sb();
  if (!c) return [];
  try {
    if (level === 'overall') {
      const { data, error } = await c.rpc('jebi_leaderboard_overall', { p_limit: limit });
      if (error || !data) return [];
      return data as LeaderboardRow[];
    }
    const { data, error } = await c.from('jebi_leaderboard_level')
      .select('id, nickname, level, time_ms, blanks, misses, created_at')
      .eq('level', level)
      .order('time_ms', { ascending: true })
      .limit(limit);
    if (error || !data) return [];
    return data as LeaderboardRow[];
  } catch {
    return [];
  }
}

export async function fetchHallOfFame(): Promise<HallOfFameRow[]> {
  const c = sb();
  if (!c) return [];
  try {
    const { data, error } = await c.from('jebi_hall_of_fame')
      .select('nickname, created_at, first')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data as HallOfFameRow[];
  } catch {
    return [];
  }
}

/* ---------- 카카오 로그인 (OIDC id_token) ----------
 * Supabase 기본 OAuth 흐름은 account_email 스코프를 항상 붙이는데, 이메일 동의항목은 비즈 앱에서만 쓸 수 있다.
 * 그래서 kauth 인가 → /api/kakao-token 에서 id_token 교환 → signInWithIdToken 으로 세션을 만든다. */
const KAKAO_REST_KEY = import.meta.env.VITE_KAKAO_REST_KEY as string | undefined;
const KAKAO_STATE_KEY = 'jebi_kakao_login';

interface PendingLogin { state: string; nonce: string; redirectUri: string; back: string }

function rand(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

export function canKakaoLogin(): boolean {
  return hasSupabase() && !!KAKAO_REST_KEY;
}

/** kauth 로 이동한다. 돌아오면 completeKakaoLogin() 이 마무리한다. back = 돌아온 뒤 복원할 전체 URL */
export async function signInWithKakao(back: string): Promise<void> {
  if (!canKakaoLogin()) return;
  const pending: PendingLogin = {
    state: rand(), nonce: rand(),
    redirectUri: location.origin + location.pathname, // 콘솔 REST API 키 카드에 등록된 URI 와 같아야 한다
    back,
  };
  try { sessionStorage.setItem(KAKAO_STATE_KEY, JSON.stringify(pending)); } catch { return; }
  const q = new URLSearchParams({
    client_id: KAKAO_REST_KEY!, redirect_uri: pending.redirectUri, response_type: 'code',
    scope: 'openid profile_nickname profile_image', state: pending.state, nonce: pending.nonce,
  });
  location.assign('https://kauth.kakao.com/oauth/authorize?' + q.toString());
}

/** 주소에 ?code&state 가 있으면 카카오 로그인 중. 부팅 직후 동기로 호출해 URL 을 원래대로 돌리고, 교환은 비동기로 진행한다. */
export function completeKakaoLogin(): Promise<'ok' | 'error'> | null {
  const q = new URLSearchParams(location.search);
  const code = q.get('code');
  const state = q.get('state');
  const err = q.get('error');
  if (!code && !err) return null;
  let pending: PendingLogin | null = null;
  try {
    const raw = sessionStorage.getItem(KAKAO_STATE_KEY);
    pending = raw ? JSON.parse(raw) as PendingLogin : null;
    sessionStorage.removeItem(KAKAO_STATE_KEY);
  } catch { /* 저장소 없음 */ }
  if (!pending || pending.state !== state) return null; // 우리가 보낸 요청이 아니다
  history.replaceState(null, '', pending.back);
  if (!code) return Promise.resolve('error');
  const c = sb();
  if (!c) return Promise.resolve('error');
  const { nonce, redirectUri } = pending;
  return (async () => {
    try {
      const r = await fetch('/api/kakao-token', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, redirectUri }),
      });
      const j = await r.json().catch(() => ({})) as { id_token?: string; error?: string };
      if (!r.ok || !j.id_token) return 'error';
      const { data, error } = await c.auth.signInWithIdToken({ provider: 'kakao', token: j.id_token, nonce });
      if (error || !data.user) return 'error';
      // GoTrue 가 카카오 클레임(nickname/picture)을 메타데이터에 안 옮겼으면 직접 채운다
      const m = (data.user.user_metadata ?? {}) as Record<string, unknown>;
      if (!['name', 'nickname', 'preferred_username'].some((k) => typeof m[k] === 'string' && (m[k] as string).trim())) {
        const claims = idTokenClaims(j.id_token);
        const nick = typeof claims.nickname === 'string' ? claims.nickname.trim() : '';
        if (nick) {
          const patch: Record<string, string> = { nickname: nick, name: nick };
          if (typeof claims.picture === 'string') patch.avatar_url = claims.picture;
          await c.auth.updateUser({ data: patch }).catch(() => { /* 메타데이터는 부가 정보 */ });
        }
      }
      return 'ok';
    } catch {
      return 'error';
    }
  })();
}

/** Google Identity Services 가 준 id_token 으로 세션을 만든다. nonce 는 GIS 에 해시로 보낸 것의 원문 */
export async function signInWithGoogleIdToken(token: string, nonce: string): Promise<'ok' | 'error'> {
  const c = sb();
  if (!c) return 'error';
  try {
    const { data, error } = await c.auth.signInWithIdToken({ provider: 'google', token, nonce });
    return error || !data.user ? 'error' : 'ok';
  } catch {
    return 'error';
  }
}

function idTokenClaims(token: string): Record<string, unknown> {
  try {
    const p = token.split('.')[1] ?? '';
    const b = p.replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(decodeURIComponent(Array.from(atob(b), (ch) => '%' + ch.charCodeAt(0).toString(16).padStart(2, '0')).join('')));
  } catch {
    return {};
  }
}

export async function getSessionNickname(): Promise<string | null> {
  const c = sb();
  if (!c) return null;
  try {
    const { data } = await c.auth.getSession();
    const m = data.session?.user?.user_metadata as Record<string, unknown> | undefined;
    if (!m) return null;
    for (const k of ['name', 'nickname', 'preferred_username']) {
      const v = m[k];
      if (typeof v === 'string' && v.trim()) return v.trim();
    }
    return null;
  } catch {
    return null;
  }
}

export async function signOut(): Promise<void> {
  const c = sb();
  if (!c) return;
  try { await c.auth.signOut(); } catch { /* 무시 */ }
}

const claimed = new Set<string>();

/** 세션이 있으면 같은 device_id 의 기록을 user_id 로 묶는다. 세션당 한 번만 호출된다. */
export async function claimRuns(deviceId: string): Promise<{ ok: boolean; claimed?: number }> {
  const c = sb();
  if (!c) return { ok: false };
  try {
    const { data: s } = await c.auth.getSession();
    const uid = s.session?.user?.id;
    if (!uid) return { ok: false };
    const key = uid + ':' + deviceId;
    if (claimed.has(key)) return { ok: true, claimed: 0 };
    const { data, error } = await c.rpc('jebi_claim_runs', { p_device_id: deviceId });
    if (error) return { ok: false };
    claimed.add(key);
    return { ok: true, claimed: typeof data === 'number' ? data : undefined };
  } catch {
    return { ok: false };
  }
}
