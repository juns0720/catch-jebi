// 도전장 생성 모달: 도발 문구 선택(기본 5개 + 직접 입력 20자) → 카카오톡 / 링크 복사
import { TAUNTS } from '@/types';
import { fmtSec, h } from './ui';

export interface TauntChoice { m: number; mx?: string; }
export interface ShareModalOpts {
  level: number;
  timeMs: number;
  cleared: boolean;
  last: TauntChoice;
}
export interface ShareModalResult extends TauntChoice { action: 'kakao' | 'link'; }

const CUSTOM_MAX = 20;

export function pickChallengeTaunt(root: HTMLElement, o: ShareModalOpts): Promise<ShareModalResult | null> {
  return new Promise((resolve) => {
    let choice = o.last.m >= 0 && o.last.m < TAUNTS.length ? o.last.m : o.last.m === -1 && o.last.mx ? -1 : 0;
    const name = `taunt-${Math.random().toString(36).slice(2, 7)}`;

    const radios: HTMLInputElement[] = [];
    const rows = TAUNTS.map((t, i) => {
      const r = h('input', { type: 'radio', name, value: String(i) });
      r.checked = choice === i;
      radios.push(r);
      return h('label', { class: 'taunt-row' }, r, h('span', null, t.replace('{t}', fmtSec(o.timeMs))));
    });

    const custom = h('input', {
      class: 'taunt-input', type: 'text', maxlength: CUSTOM_MAX, placeholder: '직접 입력 (20자)', 'aria-label': '직접 입력한 도발 문구',
    });
    const customRadio = h('input', { type: 'radio', name, value: '-1' });
    customRadio.checked = choice === -1;
    if (choice === -1) custom.value = o.last.mx ?? '';
    radios.push(customRadio);
    const customRow = h('label', { class: 'taunt-row custom' }, customRadio, custom);

    const err = h('p', { class: 'modal-err', role: 'alert' });
    const select = (i: number) => { choice = i; };
    radios.forEach((r) => r.addEventListener('change', () => { if (r.checked) select(Number(r.value)); }));
    custom.addEventListener('focus', () => { customRadio.checked = true; select(-1); });
    custom.addEventListener('input', () => { customRadio.checked = true; select(-1); err.textContent = ''; });

    const finish = (action: 'kakao' | 'link' | null) => {
      if (!action) { cleanup(); resolve(null); return; }
      if (choice === -1) {
        const text = custom.value.trim().replace(/\s+/g, ' ').slice(0, CUSTOM_MAX);
        if (!text) { err.textContent = '도발 문구를 적어 주세요'; custom.focus(); return; }
        cleanup(); resolve({ action, m: -1, mx: text });
        return;
      }
      cleanup(); resolve({ action, m: choice });
    };

    const kakaoBtn = h('button', { class: 'btn primary', type: 'button', onclick: () => finish('kakao') }, '카카오톡으로 보내기');
    const linkBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => finish('link') }, '링크 복사');
    const closeBtn = h('button', { class: 'btn ghost', type: 'button', onclick: () => finish(null) }, '닫기');

    const sheet = h('div', { class: 'modal-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-labelledby': 'shareTitle' },
      h('h2', { id: 'shareTitle', class: 'modal-title' }, '도전장 보내기'),
      h('p', { class: 'modal-sub' }, `레벨 ${o.level} · ${o.cleared ? `${fmtSec(o.timeMs)}초` : `기준 시간 ${fmtSec(o.timeMs)}초 안에 클리어`}`),
      h('fieldset', { class: 'taunt-set' }, h('legend', null, '도발 문구'), ...rows, customRow),
      err,
      h('div', { class: 'modal-actions' }, kakaoBtn, linkBtn, closeBtn),
    );
    const veil = h('div', { class: 'modal-veil' }, sheet);
    veil.addEventListener('mousedown', (e) => { if (e.target === veil) finish(null); });
    veil.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); finish(null); return; }
      if (e.key === 'Enter' && e.target === custom) { e.preventDefault(); finish('kakao'); return; }
      if (e.key === 'Tab') {
        const f = Array.from(veil.querySelectorAll<HTMLElement>('button, input'));
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
    function cleanup() { veil.remove(); }
    root.append(veil);
    kakaoBtn.focus({ preventScroll: true });
  });
}
