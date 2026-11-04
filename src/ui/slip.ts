// 결과 쪽지 오버레이 (DOM). tokens.css의 .slip/.stamp/.btn을 쓰고, 오버레이 전용 스타일은 첫 호출 때 <style>로 주입한다.
import { STAMP_LABEL, TIERS } from '@/types';
import type { RunResult, Stamp, Tier } from '@/types';
import { badgeSvg } from '@/ui/badges';

export interface SlipActions { retry(): void; next(): void | null; shareKakao(): void; copyLink(): void; saveImage(): void; openRank(): void; }
export interface SlipOpts {
  result: RunResult; tier: Tier; isRecord: boolean; bestMs: number | null;
  ghost?: { name: string; ms: number } | null; percentile?: number | null;
  nicknamePrompt?: { onSubmit(n: string): Promise<string | null> } | null;
  loginPrompt?: { onClick(): void } | null;
  actions: SlipActions; hasNext: boolean;
}
export interface SlipPrompts {
  nicknamePrompt?: { onSubmit(n: string): Promise<string | null> } | null;
  loginPrompt?: { onClick(): void } | null;
}
/** INTERFACES의 { close, setPercentile }에 setPrompts를 더한 상위 타입. 쪽지를 연 뒤 비동기로 순위가 오면 프롬프트를 추가할 때 쓴다. */
export interface SlipHandle {
  close(): void;
  setPercentile(p: number | null): void;
  setPrompts(p: SlipPrompts): void;
}

const NICK_RE = /^[가-힣ㄱ-ㅎㅏ-ㅣA-Za-z0-9 ]{2,10}$/;
const ARM_DELAY_MS = 700; // 결과가 뜨는 순간 연타하던 클릭이 버튼에 꽂히는 것을 막는다

const CSS = `
.rs-veil { position: fixed; inset: 0; z-index: 60; display: grid; padding: 16px; overflow-y: auto; background: var(--veil); }
.rs-sheet { width: min(480px, 100%); margin: auto; display: grid; gap: 14px; padding: 16px; background: var(--surface); color: var(--fg); border: 1px solid var(--line); border-radius: 18px; font-family: var(--font-body); }
.rs-slip { padding: 26px 18px 20px; }
.rs-body { width: 100%; display: grid; gap: 10px; justify-items: center; text-align: center; }
.rs-badge { width: 72px; height: 72px; line-height: 0; }
.rs-badge svg { width: 100%; height: 100%; }
.rs-tier { margin: 0; font-family: var(--font-display); font-size: 20px; }
.rs-time { margin: 0; font-family: var(--font-display); font-size: clamp(44px, 12vw, 64px); line-height: 1.05; font-variant-numeric: tabular-nums; }
.rs-time.fail { font-size: clamp(22px, 6vw, 30px); line-height: 1.3; text-wrap: balance; }
.rs-note { margin: 0; font-size: 14px; opacity: .72; font-variant-numeric: tabular-nums; }
.rs-stats { margin: 0; font-size: 16px; font-variant-numeric: tabular-nums; }
.rs-ghost { margin: 0; font-family: var(--font-display); font-size: 20px; padding: 2px 10px; border-bottom: 2px solid currentColor; }
.rs-pct { margin: 0; min-height: 1.5em; font-family: var(--font-display); font-size: 18px; }
.rs-stamps { display: flex; flex-wrap: wrap; justify-content: center; align-items: center; row-gap: 6px; padding: 6px 8px 0; }
.rs-stamps .stamp { margin-left: -6px; }
.rs-stamps .stamp:first-child { margin-left: 0; }
.rs-prompts { display: grid; gap: 10px; }
.rs-prompts:empty { display: none; }
.rs-nick { display: grid; gap: 8px; padding: 12px; border: 1px dashed var(--line); border-radius: 12px; }
.rs-nick p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
.rs-input { width: 100%; font: inherit; font-size: 16px; color: var(--fg); background: var(--bg); border: 1px solid var(--line); border-radius: 10px; padding: 10px 12px; }
.rs-input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.rs-err { min-height: 0; color: var(--danger); font-size: 13px; }
.rs-err:empty { display: none; }
.rs-ok { margin: 0; text-align: center; font-size: 14px; color: var(--muted); }
.rs-actions { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.rs-actions .btn { width: 100%; }
.rs-actions .wide { grid-column: 1 / -1; }
.rs-actions .btn.ghost { border-radius: 12px; }
.rs-actions .btn:disabled, .rs-nick .btn:disabled { opacity: .6; cursor: default; }
`;

function ensureStyle(): void {
  if (document.getElementById('rs-style')) return;
  const s = document.createElement('style');
  s.id = 'rs-style';
  s.textContent = CSS;
  document.head.appendChild(s);
}

type Child = Node | string | null | undefined | false;
function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number | boolean | null | undefined | ((e: any) => void)> | null,
  ...kids: Child[]
): HTMLElementTagNameMap[K] {
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

const sec = (ms: number): string => (ms / 1000).toFixed(1);
const rand = (a: number, b: number): number => a + Math.random() * (b - a);

/** 을/를 (한글 받침 판별. 한글이 아니면 '을(를)') */
function objectParticle(name: string): string {
  const c = name.trim().charCodeAt(name.trim().length - 1);
  if (c >= 0xac00 && c <= 0xd7a3) return (c - 0xac00) % 28 === 0 ? '를' : '을';
  return '을(를)';
}

export function showResultSlip(root: HTMLElement, o: SlipOpts): SlipHandle {
  ensureStyle();
  const r = o.result;
  const tierName = TIERS.find((t) => t.id === o.tier)?.name ?? '';
  let closed = false;
  let armed = false;
  const armTimer = window.setTimeout(() => { armed = true; }, ARM_DELAY_MS);
  const guard = (fn: () => void) => () => { if (armed && !closed) fn(); };

  /* ----- 쪽지 ----- */
  const stamps: Stamp[] = [...r.stamps];
  if (o.isRecord && !stamps.includes('record')) stamps.push('record');
  const stampEls = stamps.map((s, i) => {
    const el = h('span', { class: 'stamp' }, STAMP_LABEL[s]);
    // 토큰의 .stamp는 transform으로 -12deg를 건다. 개별 rotate/translate/scale 속성은 그 위에 얹힌다.
    el.style.setProperty('rotate', `${rand(-6, 16).toFixed(1)}deg`);
    el.style.setProperty('translate', `0 ${rand(-3, 5).toFixed(1)}px`);
    el.style.setProperty('scale', rand(0.94, 1.12).toFixed(2));
    el.style.animationDelay = `${(0.55 + i * 0.16).toFixed(2)}s`;
    return el;
  });

  const pctEl = h('p', { class: 'rs-pct', 'aria-live': 'polite' });
  const setPercentile = (p: number | null) => {
    if (p == null || !r.cleared) { pctEl.textContent = ''; return; }
    const top = Math.min(100, Math.max(1, Math.ceil(100 - p)));
    pctEl.textContent = `상위 ${top}%`;
  };

  let ghostEl: HTMLElement | null = null;
  let ghostNote: HTMLElement | null = null;
  if (o.ghost) {
    const won = r.cleared && r.timeMs < o.ghost.ms;
    ghostEl = h('p', { class: 'rs-ghost' }, won ? `${o.ghost.name}${objectParticle(o.ghost.name)} 이겼다` : `${o.ghost.name}에게 졌다`);
    ghostNote = h('p', { class: 'rs-note' }, `${o.ghost.name} ${sec(o.ghost.ms)}초${r.cleared ? ` · 나 ${sec(r.timeMs)}초` : ''}`);
  }

  const body = h('div', { class: 'rs-body' },
    h('div', { class: 'rs-badge', 'aria-hidden': 'true' }),
    h('p', { class: 'rs-tier' }, `레벨 ${r.level} · ${tierName}`),
    r.cleared
      ? h('p', { class: 'rs-time' }, `${sec(r.timeMs)}초`)
      : h('p', { class: 'rs-time fail' }, '제비들이 강남으로 돌아갔어요'),
    r.cleared
      ? (!o.isRecord && o.bestMs != null ? h('p', { class: 'rs-note' }, `내 최고 기록 ${sec(o.bestMs)}초`) : null)
      : h('p', { class: 'rs-note' }, `기준 시간 ${sec(r.parMs)}초를 넘겼어요`),
    h('p', { class: 'rs-stats' }, `꽝 ${r.blanks} · 헛손질 ${r.misses} · 명중률 ${Math.round(r.accuracy * 100)}%`),
    ghostEl, ghostNote,
    pctEl,
    h('div', { class: 'rs-stamps' }, ...stampEls),
  );
  body.querySelector('.rs-badge')!.innerHTML = badgeSvg(o.tier, 72);
  setPercentile(o.percentile ?? null);

  const slip = h('div', { class: 'slip open rs-slip' }, body);

  /* ----- 버튼 줄 ----- */
  const a = o.actions;
  const retryBtn = h('button', { class: `btn primary${o.hasNext ? '' : ' wide'}`, type: 'button', onclick: guard(() => a.retry()) }, '다시 하기');
  const nextBtn = o.hasNext
    ? h('button', { class: 'btn primary', type: 'button', onclick: guard(() => { a.next(); }) }, '다음 레벨')
    : null;
  const kakaoLabel = o.ghost ? `${o.ghost.name}에게 되돌려 보내기` : '카카오톡 공유';
  const actions = h('div', { class: 'rs-actions' },
    retryBtn, nextBtn,
    h('button', { class: 'btn ghost', type: 'button', onclick: guard(() => a.shareKakao()) }, kakaoLabel),
    h('button', { class: 'btn ghost', type: 'button', onclick: guard(() => a.copyLink()) }, '링크 복사'),
    h('button', { class: 'btn ghost', type: 'button', onclick: guard(() => a.saveImage()) }, '이미지 저장'),
    h('button', { class: 'btn ghost', type: 'button', onclick: guard(() => a.openRank()) }, '랭킹'),
  );

  /* ----- 닉네임 / 로그인 프롬프트 ----- */
  const prompts = h('div', { class: 'rs-prompts' });
  let nickShown = false;
  let loginShown = false;

  const renderNick = (np: NonNullable<SlipPrompts['nicknamePrompt']>) => {
    nickShown = true;
    const input = h('input', {
      class: 'rs-input', type: 'text', maxlength: 10, placeholder: '닉네임 (2~10자)',
      autocomplete: 'off', spellcheck: 'false', 'aria-label': '닉네임',
    });
    const err = h('p', { class: 'rs-err', role: 'alert' });
    const btn = h('button', { class: 'btn primary', type: 'button' }, '닉네임 남기고 랭킹에 올리기');
    const box = h('div', { class: 'rs-nick' },
      h('p', null, '이름을 남기면 랭킹에 올라가요. 안 남겨도 기록은 집계돼요.'),
      input, err, btn,
    );
    const submit = async () => {
      if (closed || btn.disabled) return;
      const v = input.value.trim().replace(/\s+/g, ' ');
      if (!NICK_RE.test(v)) { err.textContent = '2~10자, 한글·영문·숫자만 쓸 수 있어요'; input.focus(); return; }
      err.textContent = '';
      btn.disabled = true; input.disabled = true;
      let msg: string | null;
      try { msg = await np.onSubmit(v); } catch { msg = '저장하지 못했어요. 잠시 후 다시 해 주세요'; }
      if (closed) return;
      if (msg) { err.textContent = msg; btn.disabled = false; input.disabled = false; input.focus(); return; }
      box.replaceWith(h('p', { class: 'rs-ok' }, `랭킹에 올렸어요 · ${v}`));
    };
    btn.addEventListener('click', () => { void submit(); });
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); void submit(); } });
    prompts.append(box);
  };

  const renderLogin = (lp: NonNullable<SlipPrompts['loginPrompt']>) => {
    loginShown = true;
    prompts.append(h('button', { class: 'btn ghost', type: 'button', onclick: () => lp.onClick() }, '카카오 로그인하고 기록 지키기'));
  };

  const setPrompts = (p: SlipPrompts) => {
    if (closed) return;
    if (p.nicknamePrompt && !nickShown) renderNick(p.nicknamePrompt);
    if (p.loginPrompt && !loginShown) renderLogin(p.loginPrompt);
  };
  setPrompts({ nicknamePrompt: o.nicknamePrompt, loginPrompt: o.loginPrompt });

  /* ----- 오버레이 ----- */
  const sheet = h('div', { class: 'rs-sheet', role: 'dialog', 'aria-modal': 'true', 'aria-label': '결과 쪽지' }, slip, prompts, actions);
  const veil = h('div', { class: 'rs-veil' }, sheet);
  // ESC로 닫지 않는다. Tab만 쪽지 안에서 돈다.
  veil.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const f = Array.from(veil.querySelectorAll<HTMLElement>('button:not([disabled]), input:not([disabled]), a[href]'));
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  root.append(veil);
  retryBtn.focus({ preventScroll: true });

  return {
    close() {
      if (closed) return;
      closed = true;
      window.clearTimeout(armTimer);
      veil.remove();
    },
    setPercentile,
    setPrompts,
  };
}
