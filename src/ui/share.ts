// 도전장 URL, 카카오 공유, 클립보드. INTERFACES.md D절 시그니처 그대로 + 보조 export (getSiteUrl, buildOgUrl, challengeTitle).
import { TAUNTS } from '@/types';
import type { ChallengeParams } from '@/types';
import { MAX_LEVEL } from '@/game/levels';

const KAKAO_SDK_URL = 'https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js';
const NAME_MAX = 20;
const TAUNT_MAX = 20;

/* ---------- 도전장 URL ---------- */

function secText(ms: number): string {
  return (ms / 1000).toFixed(1);
}

function queryOf(p: ChallengeParams): string {
  const q = new URLSearchParams();
  q.set('l', String(p.l));
  q.set('t', String(Math.round(p.t)));
  q.set('n', p.n || '친구');
  q.set('m', String(p.m));
  if (p.m === -1 && p.mx) q.set('mx', p.mx);
  if (p.r != null && Number.isFinite(p.r)) q.set('r', String(Math.round(p.r)));
  return q.toString();
}

/** `${siteUrl}/c?l=..&t=..&n=..&m=..&mx=..&r=..` */
export function buildChallengeUrl(p: ChallengeParams, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/c?${queryOf(p)}`;
}

/** 카카오 feed 이미지와 OG용. `${siteUrl}/api/og?` + 동일 파라미터 */
export function buildOgUrl(p: ChallengeParams, siteUrl: string): string {
  return `${siteUrl.replace(/\/+$/, '')}/api/og?${queryOf(p)}`;
}

export function getSiteUrl(): string {
  const env = import.meta.env.VITE_SITE_URL as string | undefined;
  return (env && env.trim() ? env.trim() : location.origin).replace(/\/+$/, '');
}

export function parseChallengeParams(search: string): ChallengeParams | null {
  const q = new URLSearchParams(search);
  const l = Number.parseInt(q.get('l') ?? '', 10);
  const t = Number.parseInt(q.get('t') ?? '', 10);
  if (!Number.isFinite(l) || l < 1 || l > MAX_LEVEL) return null;
  if (!Number.isFinite(t) || t <= 0 || t > 3_600_000) return null;
  const n = (q.get('n') ?? '').trim().slice(0, NAME_MAX) || '친구';
  const mx = (q.get('mx') ?? '').trim().slice(0, TAUNT_MAX);
  let m = Number.parseInt(q.get('m') ?? '', 10);
  if (!Number.isFinite(m)) m = mx ? -1 : 0;
  if (m < -1 || m >= TAUNTS.length) m = mx ? -1 : 0;
  if (m === -1 && !mx) m = 0;
  const out: ChallengeParams = { l, t, n, m };
  if (m === -1) out.mx = mx;
  const r = Number.parseInt(q.get('r') ?? '', 10);
  if (Number.isFinite(r) && r >= 0 && r <= 100) out.r = r;
  return out;
}

/** TAUNTS[m] ({t} → 초) 또는 mx */
export function tauntText(p: ChallengeParams): string {
  if (p.m >= 0 && p.m < TAUNTS.length) return TAUNTS[p.m].replace('{t}', secText(p.t));
  return p.mx ?? '';
}

/** `${n}의 도전장 · 레벨 ${l} · ${t/1000}초` */
export function challengeTitle(p: ChallengeParams): string {
  return `${p.n}의 도전장 · 레벨 ${p.l} · ${secText(p.t)}초`;
}

/* ---------- Kakao SDK ---------- */

interface KakaoSdk {
  init(key: string): void;
  isInitialized(): boolean;
  Share: { sendDefault(settings: Record<string, unknown>): void };
}
const getKakao = (): KakaoSdk | undefined => (window as unknown as { Kakao?: KakaoSdk }).Kakao;

let kakaoKey = '';
let kakaoReady: Promise<boolean> | null = null;

function loadKakao(): Promise<boolean> {
  if (kakaoReady) return kakaoReady;
  kakaoReady = new Promise<boolean>((resolve) => {
    const finish = () => {
      const k = getKakao();
      if (!k) { resolve(false); return; }
      try {
        if (!k.isInitialized()) k.init(kakaoKey);
        resolve(k.isInitialized());
      } catch { resolve(false); }
    };
    if (getKakao()) { finish(); return; }
    const s = document.createElement('script');
    s.src = KAKAO_SDK_URL;
    s.async = true;
    s.onload = finish;
    s.onerror = () => { kakaoReady = null; s.remove(); resolve(false); };
    document.head.appendChild(s);
  });
  return kakaoReady;
}

/** SDK 로드+init. 키 없으면 false. 로드는 비동기로 진행되고 share 함수들이 완료를 기다린다. */
export function initKakao(jsKey: string): boolean {
  if (!jsKey) return false;
  kakaoKey = jsKey;
  void loadKakao();
  return true;
}

async function kakaoSend(settings: Record<string, unknown>): Promise<boolean> {
  if (!kakaoKey) {
    const env = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!env) return false;
    kakaoKey = env;
  }
  if (!(await loadKakao())) return false;
  try {
    getKakao()!.Share.sendDefault(settings);
    return true;
  } catch {
    return false;
  }
}

export function shareKakao(p: ChallengeParams, o: { siteUrl: string; imageUrl: string }): Promise<boolean> {
  const url = buildChallengeUrl(p, o.siteUrl);
  const link = { mobileWebUrl: url, webUrl: url };
  return kakaoSend({
    objectType: 'feed',
    content: {
      title: challengeTitle(p),
      description: tauntText(p),
      imageUrl: o.imageUrl,
      imageWidth: 1200,
      imageHeight: 630,
      link,
    },
    buttons: [{ title: '도전 받기', link }],
  });
}

/**
 * 모바일 게이트 "나에게 보내기". 카카오에는 나에게 보내기 전용 API가 없어서
 * 같은 feed를 공유 다이얼로그로 띄우고 사용자가 본인 채팅을 고르게 한다.
 */
export function sendToMeKakao(url: string, o: { title: string; imageUrl: string }): Promise<boolean> {
  const link = { mobileWebUrl: url, webUrl: url };
  return kakaoSend({
    objectType: 'feed',
    content: {
      title: o.title,
      description: 'PC에서 열어서 도전해 보세요',
      imageUrl: o.imageUrl,
      imageWidth: 1200,
      imageHeight: 630,
      link,
    },
    buttons: [{ title: 'PC에서 열기', link }],
  });
}

/* ---------- 클립보드 ---------- */

export async function copyText(t: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(t);
      return true;
    }
  } catch { /* 폴백으로 */ }
  try {
    const ta = document.createElement('textarea');
    ta.value = t;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:0;left:0;opacity:0;pointer-events:none';
    document.body.appendChild(ta);
    ta.select();
    ta.setSelectionRange(0, t.length);
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  } catch {
    return false;
  }
}
