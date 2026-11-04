import type { Tier } from '@/types';

type Colors = { bird: string; seal: string; belly: string; gold: string };
interface BirdOpts { x: number; y: number; s: number; legs?: boolean; shine?: boolean; crest?: boolean; seed?: boolean; thread?: boolean; fluff?: boolean }

// 원본 drawBird의 언어: 검은 유선형 몸, 갈라진 꼬리, 붉은 얼굴, 밝은 배. 옆모습, 오른쪽을 본다. 중심 ≈ (30,33).
function bird(c: Colors, o: BirdOpts): string {
  const tx = o.x - 29.5 * o.s, ty = o.y - 33 * o.s;
  return `<g transform="translate(${tx} ${ty}) scale(${o.s})">`
    + (o.legs ? `<path d="M30 38v7M35 38v7" stroke="${c.bird}" stroke-width="1.6" stroke-linecap="round" fill="none"/>` : '')
    + (o.thread ? `<path d="M34 41l3 1M34 43l3 1M35 45q5 1 3 5t4 5" stroke="${c.seal}" stroke-width="1.3" stroke-linecap="round" fill="none"/>` : '')
    + `<path d="M20 31L4 25l7 8-7 8 16-4z" fill="${c.bird}"/>`
    + `<ellipse cx="32" cy="33" rx="15" ry="6.5" fill="${c.bird}"/>`
    + `<path d="M40 29Q27 29 11 42Q28 41 40 37z" fill="${c.bird}"/>`
    + `<ellipse cx="34" cy="36.2" rx="9" ry="3" fill="${c.belly}"/>`
    + `<circle cx="44" cy="30" r="5.5" fill="${c.bird}"/>`
    + `<ellipse cx="47.4" cy="31.4" rx="2.4" ry="2.6" fill="${c.seal}"/>`
    + `<path d="M48.5 29.2L55 30.6l-6.5 1.6z" fill="${c.bird}"/>`
    + `<circle cx="44.8" cy="28.4" r="1" fill="${c.belly}"/>`
    + (o.fluff ? `<path d="M40 25l-1-3M43 24.5v-3.5M46 25.5l1.5-3" stroke="${c.bird}" stroke-width="1.3" stroke-linecap="round"/>` : '')
    + (o.crest ? `<path d="M41 25.5Q40 19 47 20.5Q43 21.5 44 25.5z" fill="${c.bird}"/>` : '')
    + (o.shine ? `<path d="M22 28.8Q34 26 43 27.4M16 39Q26 33 36 31.5" stroke="${c.belly}" stroke-width="1.2" stroke-linecap="round" fill="none" opacity=".75"/>` : '')
    + (o.seed ? `<ellipse cx="56.4" cy="31" rx="3.2" ry="1.7" transform="rotate(8 56.4 31)" fill="${c.gold}"/><path d="M54.6 30.6q1.8-.6 3.4.2" stroke="${c.belly}" stroke-width=".7" fill="none" opacity=".8"/>` : '')
    + `</g>`;
}

const NEST = '#8a6a3f';
const spark = (x: number, y: number, r: number, fill: string) => {
  const q = r * 0.25;
  const pts = [[x, y - r], [x + q, y - q], [x + r, y], [x + q, y + q], [x, y + r], [x - q, y + q], [x - r, y], [x - q, y - q]];
  return `<path d="M${pts.map(p => p.join(' ')).join('L')}z" fill="${fill}"/>`;
};

function build(tier: Tier, c: Colors, size: number): string {
  let body = '';
  switch (tier) {
    case 'chick':
      body = bird(c, { x: 31, y: 33, s: 0.72, fluff: true })
        + `<path d="M8 40Q10 56 32 57Q54 56 56 40Q32 47 8 40z" fill="${NEST}" opacity=".9"/>`
        + `<path d="M6 41Q32 50 58 41M10 48Q32 55 54 48M14 53Q32 58 50 53M12 38l8 9M52 38l-8 9" stroke="${NEST}" stroke-width="2" stroke-linecap="round" fill="none"/>`;
      break;
    case 'town':
      body = `<path d="M2 45.5Q32 49 62 45.5" stroke="${c.bird}" stroke-opacity=".55" stroke-width="1.6" fill="none"/>`
        + bird(c, { x: 31, y: 31, s: 0.95, legs: true });
      break;
    case 'gangnam':
      body = bird(c, { x: 31, y: 34, s: 1, shine: true, crest: true }) + spark(12, 16, 5, c.gold) + spark(54, 49, 3.5, c.gold);
      break;
    case 'heungbu':
      body = bird(c, { x: 31, y: 28, s: 0.9, legs: true, thread: true });
      break;
    case 'gourd':
      body = `<circle cx="32" cy="32" r="29.5" fill="none" stroke="${c.gold}" stroke-width="3"/>`
        + `<circle cx="32" cy="32" r="25" fill="none" stroke="${c.gold}" stroke-width="1" opacity=".5"/>`
        + bird(c, { x: 31, y: 33, s: 0.78, seed: true });
      break;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}">${body}</svg>`;
}

const VARS: Colors = { bird: 'var(--bird)', seal: 'var(--seal)', belly: 'var(--belly)', gold: 'var(--gold)' };

export function badgeSvg(tier: Tier, size = 64): string {
  return build(tier, VARS, size);
}

export function badgeDataUrl(tier: Tier, colors: Colors, size = 64): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(build(tier, colors, size));
}
