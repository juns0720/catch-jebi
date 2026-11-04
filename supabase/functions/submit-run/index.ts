// Supabase Edge Function (Deno): 기록 제출 / 닉네임 설정.
// SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY 는 Supabase 가 자동 주입한다.
import { createClient } from 'npm:@supabase/supabase-js@2';
import { hasBadWord } from './badwords.ts';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const BAD_NICK = '제비가 그 이름은 못 물어가요';
const STAMPS = new Set(['win', 'record', 'poop', 'nolbu', 'heungbu', 'gangnam', 'close']);
const MIN_TAP_GAP_MS = 60;
const MIN_TIME_MS = 1500;
const MAX_TAPS = 3000;

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json; charset=utf-8' },
  });
}

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

/** 닉네임 검증. 통과하면 정리된 닉네임, 아니면 { error }. */
function checkNickname(v: unknown): { nickname: string } | { error: string } {
  if (typeof v !== 'string') return { error: '닉네임을 입력해 주세요' };
  const n = v.trim().replace(/\s+/g, ' ');
  const len = Array.from(n).length;
  if (len < 2 || len > 10 || !/^[가-힣ㄱ-ㅎㅏ-ㅣa-zA-Z0-9 ]+$/.test(n)) {
    return { error: '닉네임은 2~10자, 한글/영문/숫자/공백만 쓸 수 있어요' };
  }
  if (hasBadWord(n)) return { error: BAD_NICK };
  return { nickname: n };
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, error: 'method not allowed' }, 405);

  let body: unknown;
  try { body = await req.json(); } catch { return json({ ok: false, error: 'invalid json' }, 400); }
  if (!isObj(body)) return json({ ok: false, error: 'invalid body' }, 400);

  const url = Deno.env.get('SUPABASE_URL');
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !key) return json({ ok: false, error: 'server misconfigured' }, 500);
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  const deviceId = body.deviceId;
  if (typeof deviceId !== 'string' || deviceId.length < 8 || deviceId.length > 64) {
    return json({ ok: false, error: 'invalid deviceId' }, 400);
  }

  // ------------------------------------------------------------ nickname
  if (body.action === 'nickname') {
    const runId = body.runId;
    if (typeof runId !== 'string' || !/^[0-9a-f-]{36}$/i.test(runId)) return json({ ok: false, error: 'invalid runId' }, 400);
    const c = checkNickname(body.nickname);
    if ('error' in c) return json({ ok: false, error: c.error }, 400);
    const { data, error } = await db.from('runs')
      .update({ nickname: c.nickname })
      .eq('id', runId)
      .eq('device_id', deviceId)
      .select('id');
    if (error) return json({ ok: false, error: 'db error' }, 500);
    if (!data || data.length === 0) return json({ ok: false, error: 'run not found' }, 404);
    return json({ ok: true, id: runId });
  }

  // -------------------------------------------------------------- submit
  if (body.action !== 'submit') return json({ ok: false, error: 'unknown action' }, 400);

  const run = body.run;
  if (!isObj(run)) return json({ ok: false, error: 'invalid run' }, 400);

  const { level, cleared, timeMs, parMs, blanks, misses, accuracy, tapLog, stamps } = run;
  if (!isInt(level) || level < 1 || level > 15) return json({ ok: false, error: 'invalid level' }, 400);
  if (typeof cleared !== 'boolean') return json({ ok: false, error: 'invalid cleared' }, 400);
  if (!isInt(timeMs) || timeMs < 0 || timeMs > 3_600_000) return json({ ok: false, error: 'invalid timeMs' }, 400);
  if (!isInt(parMs) || parMs <= 0 || parMs > 3_600_000) return json({ ok: false, error: 'invalid parMs' }, 400);
  if (!isInt(blanks) || blanks < 0 || blanks > 1000) return json({ ok: false, error: 'invalid blanks' }, 400);
  if (!isInt(misses) || misses < 0 || misses > 100000) return json({ ok: false, error: 'invalid misses' }, 400);
  if (!Array.isArray(tapLog) || tapLog.length > MAX_TAPS) return json({ ok: false, error: 'invalid tapLog' }, 400);

  let nickname: string | null = null;
  if (body.nickname != null && body.nickname !== '') {
    const c = checkNickname(body.nickname);
    if ('error' in c) return json({ ok: false, error: c.error }, 400);
    nickname = c.nickname;
  }

  // 조작 검증. 걸리면 거부하지 않고 flagged=true 로 저장 (리더보드에서는 제외).
  let flagged = false;
  if (tapLog.length < blanks + (cleared ? 1 : 0)) flagged = true;
  if (timeMs > parMs) flagged = true;
  if (cleared && timeMs < MIN_TIME_MS) flagged = true;

  let prev = -Infinity;
  let lastT = 0;
  for (const t of tapLog) {
    if (!Array.isArray(t) || !isNum(t[0])) { flagged = true; break; }
    const result = t[3];
    lastT = Math.max(lastT, t[0]);
    if (result === 'wipe' || result === 'blocked') continue; // 집계 대상 아님
    if (t[0] - prev < MIN_TAP_GAP_MS) { flagged = true; break; }
    prev = t[0];
  }
  if (lastT > timeMs + 200) flagged = true;

  const cleanStamps = Array.isArray(stamps)
    ? stamps.filter((s): s is string => typeof s === 'string' && STAMPS.has(s)).slice(0, 7)
    : [];
  const acc = isNum(accuracy) ? Math.min(Math.max(accuracy, 0), 1) : null;
  const clientVersion = typeof body.clientVersion === 'string' ? body.clientVersion.slice(0, 32) : null;

  const { data: row, error: insErr } = await db.from('runs').insert({
    device_id: deviceId,
    nickname,
    level,
    time_ms: timeMs,
    par_ms: parMs,
    cleared,
    blanks,
    misses,
    accuracy: acc,
    stamps: cleanStamps,
    taps: tapLog,
    input: 'pc',
    client_version: clientVersion,
    flagged,
  }).select('id').single();
  if (insErr || !row) return json({ ok: false, error: 'db error' }, 500);

  // 실패/플래그 기록은 순위를 계산하지 않는다.
  if (!cleared || flagged) return json({ ok: true, id: row.id });

  const base = () => db.from('runs')
    .select('id', { count: 'exact', head: true })
    .eq('level', level).eq('cleared', true).eq('flagged', false);
  const [total, slower, faster] = await Promise.all([
    base(),
    base().gt('time_ms', timeMs),
    base().lt('time_ms', timeMs),
  ]);
  if (total.error || slower.error || faster.error) return json({ ok: true, id: row.id });

  // 내 기록은 이미 total 에 포함돼 있다. 나를 뺀 사람들 중 나보다 느린 비율.
  const others = (total.count ?? 1) - 1;
  const percentile = others <= 0 ? 100 : Math.round(((slower.count ?? 0) / others) * 1000) / 10;
  const rank = (faster.count ?? 0) + 1;
  return json({ ok: true, id: row.id, percentile, rank });
});
