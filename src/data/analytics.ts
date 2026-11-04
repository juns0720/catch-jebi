// Umami 분석. VITE_UMAMI_WEBSITE_ID 가 없으면 전부 no-op. 개인정보는 보내지 않는다.
import type { AnalyticsEvent } from '@/types';

type Props = Record<string, string | number | boolean>;
type UmamiLike = { track: (name: string, props?: Props) => void };

const DEFAULT_SCRIPT = 'https://cloud.umami.is/script.js';
const MAX_QUEUE = 50;

let enabled = false;
let started = false;
const queue: Array<[string, Props | undefined]> = [];

function umami(): UmamiLike | undefined {
  return (window as unknown as { umami?: UmamiLike }).umami;
}

function flush(): void {
  const u = umami();
  if (!u) return;
  while (queue.length) {
    const [name, props] = queue.shift()!;
    try { u.track(name, props); } catch { /* 분석 실패는 무시 */ }
  }
}

export function initAnalytics(): void {
  if (started) return;
  const id = import.meta.env.VITE_UMAMI_WEBSITE_ID as string | undefined;
  if (!id) return;
  started = true;
  enabled = true;
  const s = document.createElement('script');
  s.defer = true;
  s.src = (import.meta.env.VITE_UMAMI_SCRIPT_URL as string | undefined) || DEFAULT_SCRIPT;
  s.setAttribute('data-website-id', id);
  s.addEventListener('load', flush);
  s.addEventListener('error', () => { enabled = false; queue.length = 0; });
  document.head.appendChild(s);
}

export function track(e: AnalyticsEvent, props?: Props): void {
  if (!enabled) return;
  const u = umami();
  if (u) {
    flush();
    try { u.track(e, props); } catch { /* 무시 */ }
    return;
  }
  if (queue.length < MAX_QUEUE) queue.push([e, props]);
}
