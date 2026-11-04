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
    const { data, error } = await c.functions.invoke('submit-run', {
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
    const { data, error } = await c.functions.invoke('submit-run', {
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
      const { data, error } = await c.rpc('leaderboard_overall', { p_limit: limit });
      if (error || !data) return [];
      return data as LeaderboardRow[];
    }
    const { data, error } = await c.from('leaderboard_level')
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
    const { data, error } = await c.from('hall_of_fame')
      .select('nickname, created_at, first')
      .order('created_at', { ascending: true });
    if (error || !data) return [];
    return data as HallOfFameRow[];
  } catch {
    return [];
  }
}

export async function signInWithKakao(redirectTo: string): Promise<void> {
  const c = sb();
  if (!c) return;
  try {
    await c.auth.signInWithOAuth({ provider: 'kakao', options: { redirectTo } });
  } catch { /* 조용히 실패 */ }
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
    const { data, error } = await c.rpc('claim_runs', { p_device_id: deviceId });
    if (error) return { ok: false };
    claimed.add(key);
    return { ok: true, claimed: typeof data === 'number' ? data : undefined };
  } catch {
    return { ok: false };
  }
}
