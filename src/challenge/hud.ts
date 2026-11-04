// 플레이 HUD (SPEC 10.2). 캔버스에는 숫자를 그리지 않으므로 전부 DOM.
import type { LevelDef, TierInfo } from '@/types';
import { badgeSvg } from '@/ui/badges';
import { fmtSec, h, setMuteIcon } from './ui';

export interface HudGhost { name: string; ms: number; taunt: string; }

export interface HudOpts {
  level: LevelDef;
  tier: TierInfo;
  ghost: HudGhost | null;
  muted: boolean;
  onQuit(): void;
  onToggleMute(): void;
}

export interface Hud {
  el: HTMLElement;
  reset(): void;
  tick(elapsedMs: number, remainingMs: number): void;
  setBlanks(n: number): void;
  setMisses(n: number): void;
  setMuted(m: boolean): void;
  destroy(): void;
}

const DANGER_MS = 5000;
const clamp01 = (x: number) => Math.min(1, Math.max(0, x));

export function createHud(root: HTMLElement, o: HudOpts): Hud {
  const par = o.level.parMs;
  const g = o.ghost;

  const badge = h('span', { class: 'hud-badge', 'aria-hidden': 'true' });
  badge.innerHTML = badgeSvg(o.tier.id, 36);

  const timeEl = h('span', { class: 'hud-time' }, '0.0');
  const barFill = h('i', null);
  const bar = h('div', { class: 'hud-bar', role: 'presentation' }, barFill);

  let ghostFill: HTMLElement | null = null;
  let ghostBar: HTMLElement | null = null;
  let ghostBox: HTMLElement | null = null;
  if (g) {
    ghostFill = h('i', null);
    const marker = h('b', { class: 'hud-marker' });
    marker.style.left = `${clamp01(g.ms / par) * 100}%`;
    ghostBar = h('div', { class: 'hud-bar ghost', role: 'presentation' }, ghostFill, marker);
    ghostBox = h('div', { class: 'hud-ghost' },
      h('span', { class: 'hud-ghost-label' }, `${g.name} ${fmtSec(g.ms)}초`),
      ghostBar);
  }

  const timerBox = h('div', { class: 'hud-chip hud-timer' },
    h('div', { class: 'hud-time-row' }, timeEl, h('span', { class: 'hud-par' }, `/ ${fmtSec(par)}초`)),
    bar,
    ghostBox);

  const blankEl = h('b', null, '0');
  const missEl = h('b', null, '0');
  const counts = h('div', { class: 'hud-chip hud-counts', 'aria-live': 'off' },
    '꽝 ', blankEl, h('span', { class: 'sep' }, '·'), '헛손질 ', missEl);

  const muteBtn = h('button', { class: 'btn ghost icon hud-btn', type: 'button', onclick: () => o.onToggleMute() });
  setMuteIcon(muteBtn, o.muted);

  // 포기: 한 번 누르면 확인 상태로 바뀌고 2초 안에 다시 눌러야 포기된다
  let quitTimer = 0;
  const quitBtn = h('button', { class: 'btn ghost hud-btn hud-quit', type: 'button' }, '포기');
  quitBtn.addEventListener('click', () => {
    if (quitBtn.classList.contains('arm')) { window.clearTimeout(quitTimer); o.onQuit(); return; }
    quitBtn.classList.add('arm');
    quitBtn.textContent = '정말 포기?';
    quitTimer = window.setTimeout(() => { quitBtn.classList.remove('arm'); quitBtn.textContent = '포기'; }, 2000);
  });

  const pop = h('div', { class: 'hud-pop', 'aria-live': 'polite' });

  const el = h('div', { class: 'hud' },
    h('div', { class: 'hud-chip hud-level' }, badge,
      h('div', null, h('b', null, `레벨 ${o.level.level}`), h('span', null, o.tier.name))),
    g ? h('div', { class: 'hud-chip hud-banner' }, `${g.name}의 기록 ${fmtSec(g.ms)}초${g.taunt ? ` · ${g.taunt}` : ''}`) : null,
    timerBox,
    counts, quitBtn, muteBtn, pop);
  root.append(el);

  let danger = false;
  let lost = false;
  const setDanger = (on: boolean) => {
    if (on === danger) return;
    danger = on;
    timerBox.classList.toggle('danger', on);
  };

  return {
    el,
    reset() {
      lost = false;
      setDanger(false);
      timeEl.textContent = '0.0';
      barFill.style.transform = 'scaleX(1)';
      if (ghostFill) ghostFill.style.transform = 'scaleX(0)';
      ghostBox?.classList.remove('lost');
      blankEl.textContent = '0';
      missEl.textContent = '0';
      pop.textContent = '';
      pop.classList.remove('show');
    },
    tick(elapsedMs, remainingMs) {
      timeEl.textContent = fmtSec(Math.min(elapsedMs, par));
      barFill.style.transform = `scaleX(${clamp01(remainingMs / par).toFixed(4)})`;
      setDanger(remainingMs <= DANGER_MS);
      if (g && ghostFill) {
        ghostFill.style.transform = `scaleX(${clamp01(elapsedMs / par).toFixed(4)})`;
        if (!lost && elapsedMs > g.ms) {
          lost = true;
          ghostBox?.classList.add('lost');
          pop.textContent = '졌다';
          pop.classList.remove('show');
          void pop.offsetWidth; // 애니메이션 재시작
          pop.classList.add('show');
        }
      }
    },
    setBlanks(n) { blankEl.textContent = String(n); },
    setMisses(n) { missEl.textContent = String(n); },
    setMuted(m) { setMuteIcon(muteBtn, m); },
    destroy() {
      window.clearTimeout(quitTimer);
      el.remove();
    },
  };
}
