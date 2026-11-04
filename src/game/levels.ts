// 레벨 테이블. docs/SPEC.md 5.2가 원본. 숫자를 바꾸면 스펙도 같이 바꾼다.
import type { LevelDef, Personality } from '@/types';

const NORMAL: Personality = { cruise: 90,  max: 300, fleeR: 130, flee: 1400, hitR: 20, dodge: 0.1, escape: 0,   predict: 0 };
const FAST: Personality   = { cruise: 130, max: 480, fleeR: 180, flee: 3000, hitR: 16, dodge: 0.3, escape: 0.1, predict: 0.1 };
const HARD: Personality   = { cruise: 175, max: 720, fleeR: 240, flee: 6500, hitR: 12, dodge: 0.5, escape: 0.3, predict: 0.22 };

function mix(a: Personality, b: Personality, t: number): Personality {
  const l = (x: number, y: number) => x + (y - x) * t;
  return {
    cruise: l(a.cruise, b.cruise), max: l(a.max, b.max), fleeR: l(a.fleeR, b.fleeR), flee: l(a.flee, b.flee),
    hitR: l(a.hitR, b.hitR), dodge: l(a.dodge, b.dodge), escape: l(a.escape, b.escape), predict: l(a.predict, b.predict),
  };
}
function boost(p: Personality, k: number): Personality { return { ...p, cruise: p.cruise * k, max: p.max * k }; }

/** '보통' | '날쌘돌이−' | '날쌘돌이' | '날쌘돌이+' | '하드코어−' | '하드코어' | '하드코어+' | '하드코어++' */
const P = {
  normal:  NORMAL,
  fastM:   mix(NORMAL, FAST, 2 / 3),
  fast:    FAST,
  fastP:   mix(FAST, HARD, 1 / 3),
  hardM:   mix(FAST, HARD, 2 / 3),
  hard:    HARD,
  hardP:   boost(HARD, 1.08),
  hardPP:  boost(HARD, 1.15),
};

type Row = [birds: number, blank: Personality, winSpeed: number, winNerve: number, winDodge: number, winHint: number, parS: number, swapS: number | null, poopAfter: number];
const ROWS: Row[] = [
  [6,  P.normal, 1.6,  1.6,  0.25, 1.0, 60, null, 3],
  [7,  P.normal, 1.5,  1.5,  0.25, 0.7, 50, null, 3],
  [8,  P.fastM,  1.5,  1.4,  0.20, 0.4, 45, null, 3],
  [9,  P.fast,   1.4,  1.4,  0.20, 0.2, 40, null, 3],
  [10, P.fastP,  1.35, 1.3,  0.15, 0.1, 35, null, 3],
  [11, P.hardM,  1.3,  1.3,  0.15, 0.0, 35, null, 3],
  [12, P.hard,   1.25, 1.25, 0.10, 0.0, 30, null, 3],
  [12, P.hard,   1.2,  1.2,  0.10, 0.0, 30, null, 3],
  [13, P.hard,   1.2,  1.15, 0.10, 0.0, 28, null, 2],
  [14, P.hardP,  1.15, 1.15, 0.05, 0.0, 28, 15,   2],
  [14, P.hardP,  1.15, 1.1,  0.05, 0.0, 25, 12,   2],
  [15, P.hardP,  1.1,  1.1,  0.05, 0.0, 25, 10,   2],
  [16, P.hardPP, 1.1,  1.05, 0.05, 0.0, 22, 8,    2],
  [18, P.hardPP, 1.05, 1.05, 0.0,  0.0, 22, 7,    2],
  [20, P.hardPP, 1.05, 1.0,  0.0,  0.0, 20, 6,    1],
];

export const LEVELS: LevelDef[] = ROWS.map((r, i) => ({
  level: i + 1,
  birds: r[0],
  blank: r[1],
  winSpeed: r[2],
  winNerve: r[3],
  winDodge: r[4],
  winHint: r[5],
  parMs: r[6] * 1000,
  swapEveryMs: r[7] == null ? null : r[7] * 1000,
  poopAfter: r[8],
}));

export const MAX_LEVEL = LEVELS.length;
export function getLevel(n: number): LevelDef {
  return LEVELS[Math.min(MAX_LEVEL, Math.max(1, Math.floor(n))) - 1];
}

/** 당첨 제비의 실제 성격 */
export function winPersonality(l: LevelDef): Personality {
  const b = l.blank;
  return {
    ...b,
    cruise: b.cruise * l.winSpeed,
    max: b.max * l.winSpeed,
    fleeR: b.fleeR * l.winNerve,
    dodge: Math.min(0.85, b.dodge + l.winDodge),
    predict: Math.max(b.predict, 0.15),
  };
}
