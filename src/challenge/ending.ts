// 레벨 15 클리어 엔딩. 쪽지 대신 캔버스 위 DOM으로 5초: "박이 열렸어요" + 금빛 쪽지 입자(CSS 애니메이션)
import { h } from './ui';

const DURATION_MS = 5000;
const PARTICLES = 54;

export function playEnding(root: HTMLElement, reducedMotion: boolean): Promise<void> {
  return new Promise((resolve) => {
    const slips: HTMLElement[] = [];
    if (!reducedMotion) {
      for (let i = 0; i < PARTICLES; i++) {
        const s = h('i', { class: 'ending-slip' });
        s.style.setProperty('--x', `${(Math.random() * 100).toFixed(1)}%`);
        s.style.setProperty('--dx', `${(Math.random() * 160 - 80).toFixed(0)}px`);
        s.style.setProperty('--r', `${(Math.random() * 900 - 450).toFixed(0)}deg`);
        s.style.setProperty('--t', `${(2.6 + Math.random() * 2).toFixed(2)}s`);
        s.style.setProperty('--d', `${(Math.random() * 2.2).toFixed(2)}s`);
        s.style.setProperty('--s', `${(0.7 + Math.random() * 0.9).toFixed(2)}`);
        slips.push(s);
      }
    }
    const el = h('div', { class: `ending${reducedMotion ? ' still' : ''}`, role: 'status' },
      ...slips,
      h('div', { class: 'ending-text' },
        h('p', { class: 'ending-big' }, '박이 열렸어요'),
        h('p', { class: 'ending-sub' }, '레벨 15 클리어 · 박씨 제비')));
    root.append(el);
    window.setTimeout(() => {
      el.classList.add('out');
      window.setTimeout(() => { el.remove(); resolve(); }, 350);
    }, DURATION_MS - 350);
  });
}
