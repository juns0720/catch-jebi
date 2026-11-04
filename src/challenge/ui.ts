// 챌린지 페이지 공용 DOM 헬퍼
import { tierOfLevel } from '@/types';
import type { Progress, TierInfo } from '@/types';

export type Child = Node | string | null | undefined | false;
export type Attrs = Record<string, string | number | boolean | null | undefined | ((e: any) => void)>;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of kids) if (c != null && c !== false) el.append(c);
  return el;
}

export const fmtSec = (ms: number): string => (ms / 1000).toFixed(1);

/** 클리어한 최고 레벨. 없으면 0 */
export function maxCleared(p: Progress): number {
  let m = 0;
  for (const k of Object.keys(p.best)) m = Math.max(m, Number(k));
  return m;
}

/** 플레이어 티어 = 최고 클리어 레벨 기준 (SPEC 5.1) */
export function playerTier(p: Progress): TierInfo {
  return tierOfLevel(Math.max(1, maxCleared(p)));
}

const ICON_ON = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z" fill="currentColor"/><path d="m16 9 5 6"/><path d="m21 9-5 6"/></svg>';

/** 음소거 토글 버튼 안쪽(아이콘) 갱신 */
export function setMuteIcon(btn: HTMLElement, muted: boolean): void {
  btn.innerHTML = muted ? ICON_OFF : ICON_ON;
  btn.setAttribute('aria-pressed', muted ? 'true' : 'false');
  btn.setAttribute('aria-label', muted ? '소리 켜기' : '소리 끄기');
  btn.title = muted ? '소리 켜기' : '소리 끄기';
}

let toastTimer = 0;
export function toast(msg: string, ms = 2200): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), ms);
}
