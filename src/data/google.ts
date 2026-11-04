// Google 로그인: Google Identity Services 버튼 → id_token → supabase.auth.signInWithIdToken.
// 클라이언트 ID 만 있으면 되고 시크릿이 필요 없다. VITE_GOOGLE_CLIENT_ID 가 없으면 버튼이 안 그려진다.
import { signInWithGoogleIdToken } from './supabase';

const GIS_URL = 'https://accounts.google.com/gsi/client';
const CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;

interface GisButtonOptions { theme?: string; size?: string; text?: string; shape?: string; width?: number; locale?: string }
interface Gis {
  accounts: {
    id: {
      initialize(o: { client_id: string; callback(r: { credential: string }): void; nonce?: string; ux_mode?: string; itp_support?: boolean }): void;
      renderButton(el: HTMLElement, o: GisButtonOptions): void;
      disableAutoSelect(): void;
    };
  };
}
const gis = (): Gis | undefined => (window as unknown as { google?: Gis }).google;

let ready: Promise<boolean> | null = null;
let nonce = '';
const listeners = new Set<(r: 'ok' | 'error') => void>();

export function canGoogleLogin(): boolean {
  return !!CLIENT_ID;
}

/** 로그인 결과를 받을 콜백. 해제 함수를 돌려준다 */
export function onGoogleLogin(fn: (r: 'ok' | 'error') => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function randomNonce(): string {
  const b = new Uint8Array(16);
  crypto.getRandomValues(b);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return Array.from(new Uint8Array(d), (x) => x.toString(16).padStart(2, '0')).join('');
}

function load(): Promise<boolean> {
  if (ready) return ready;
  if (!CLIENT_ID) return (ready = Promise.resolve(false));
  ready = new Promise<boolean>((resolve) => {
    const init = async () => {
      const g = gis();
      if (!g) { resolve(false); return; }
      try {
        nonce = randomNonce();
        // Google 에는 해시를 보내고, Supabase 에는 원문을 보낸다 (Supabase 가 해시해서 비교)
        const hashed = await sha256Hex(nonce);
        g.accounts.id.initialize({
          client_id: CLIENT_ID!,
          nonce: hashed,
          itp_support: true,
          callback: (r) => { void handleCredential(r.credential); },
        });
        resolve(true);
      } catch { resolve(false); }
    };
    if (gis()) { void init(); return; }
    const s = document.createElement('script');
    s.src = GIS_URL;
    s.async = true;
    s.defer = true;
    s.onload = () => { void init(); };
    s.onerror = () => { ready = null; s.remove(); resolve(false); };
    document.head.appendChild(s);
  });
  return ready;
}

async function handleCredential(token: string): Promise<void> {
  const used = nonce;
  const r = await signInWithGoogleIdToken(token, used);
  // 한 번 쓴 nonce 는 버린다. 다음 버튼 클릭을 위해 다시 initialize 가 필요하므로 ready 를 비운다
  ready = null;
  listeners.forEach((fn) => fn(r));
}

/** 컨테이너 안에 Google 버튼을 그린다. 설정이 없거나 로드 실패면 컨테이너를 비워 둔다 */
export async function mountGoogleButton(el: HTMLElement, o: GisButtonOptions = {}): Promise<boolean> {
  if (!(await load())) return false;
  const g = gis();
  if (!g || !el.isConnected) return false;
  el.replaceChildren();
  g.accounts.id.renderButton(el, { theme: 'outline', size: 'large', text: 'signin_with', shape: 'pill', locale: 'ko', ...o });
  return true;
}

export function googleSignedOut(): void {
  try { gis()?.accounts.id.disableAutoSelect(); } catch { /* 무시 */ }
}
