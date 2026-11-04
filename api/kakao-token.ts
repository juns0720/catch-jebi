// 카카오 인가 코드 → id_token 교환. 브라우저는 kauth.kakao.com/oauth/token 을 직접 못 부르므로(CORS) 여기서 대신 한다.
// 받은 id_token 은 클라이언트가 supabase.auth.signInWithIdToken({ provider: 'kakao' }) 에 넘긴다.
// 이메일 동의항목(비즈 앱 필요)이 없어서 Supabase 의 기본 OAuth 흐름(account_email 스코프 고정)을 못 쓰는 것에 대한 우회.
export const config = { runtime: 'edge' };

const ALLOWED_LOCAL = 'http://localhost:5173/';

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== 'POST') return json({ error: 'method' }, 405);
  const restKey = process.env.KAKAO_REST_API_KEY;
  const secret = process.env.KAKAO_CLIENT_SECRET; // 콘솔에서 "클라이언트 시크릿 활성화" 를 켰을 때만 필요
  if (!restKey) return json({ error: 'not-configured' }, 503);

  let body: { code?: unknown; redirectUri?: unknown };
  try { body = await req.json(); } catch { return json({ error: 'bad-json' }, 400); }
  const code = typeof body.code === 'string' ? body.code : '';
  const redirectUri = typeof body.redirectUri === 'string' ? body.redirectUri : '';
  if (!code || code.length > 512) return json({ error: 'bad-code' }, 400);

  const origin = new URL(req.url).origin;
  if (!(redirectUri.startsWith(origin + '/') || redirectUri.startsWith(ALLOWED_LOCAL))) {
    return json({ error: 'bad-redirect' }, 400);
  }

  const form = new URLSearchParams({ grant_type: 'authorization_code', client_id: restKey, redirect_uri: redirectUri, code });
  if (secret) form.set('client_secret', secret);

  let r: Response;
  try {
    r = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8' },
      body: form.toString(),
    });
  } catch {
    return json({ error: 'kakao-unreachable' }, 502);
  }
  const j = await r.json().catch(() => ({})) as { id_token?: string; error?: string; error_description?: string; error_code?: string };
  if (!r.ok || !j.id_token) {
    return json({ error: j.error_description || j.error || 'token', code: j.error_code ?? null }, 400);
  }
  return json({ id_token: j.id_token });
}
