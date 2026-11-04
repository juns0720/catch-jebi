// api/og.ts 와 api/c.ts 가 함께 쓰는 도우미. 밑줄(_) 접두 파일이라 Vercel 이 엔드포인트로 노출하지 않는다.
// src/types.ts 를 import 하지 않고 (Edge 번들 경로 문제 방지) 필요한 값만 복제해 둔다.

const TAUNTS = [
  '너 똥손이지?',
  '놀부 손 예상',
  '{t}초 못 깨면 밥 사기',
  '제비가 너를 기다린다',
  '이거 못 깨면 우리 절교',
];

export function tierName(level: number): string {
  if (level <= 3) return '새끼제비';
  if (level <= 6) return '동네제비';
  if (level <= 9) return '강남제비';
  if (level <= 12) return '흥부네 제비';
  return '박씨 제비';
}

export interface Params {
  l: number;
  t: number;
  n: string;
  m: number;
  mx: string | null;
  r: number | null;
  hasN: boolean;
}

const cut = (s: string, max: number) => Array.from(s.trim()).slice(0, max).join('');

export function parseParams(sp: URLSearchParams): Params {
  const l = Math.min(15, Math.max(1, Math.round(Number(sp.get('l'))) || 1));
  const t = Math.min(3_600_000, Math.max(0, Math.round(Number(sp.get('t'))) || 0));
  const rawN = cut(sp.get('n') ?? '', 12);
  const m = Number.isInteger(Number(sp.get('m'))) && sp.get('m') !== null && sp.get('m') !== ''
    ? Number(sp.get('m')) : -1;
  const mx = cut(sp.get('mx') ?? '', 20) || null;
  const rRaw = sp.get('r');
  const r = rRaw !== null && rRaw !== '' && Number.isFinite(Number(rRaw))
    ? Math.min(100, Math.max(0, Math.round(Number(rRaw)))) : null;
  return { l, t, n: rawN || '친구', m, mx, r, hasN: !!rawN };
}

export function secondsText(t: number): string {
  return (t / 1000).toFixed(1);
}

export function tauntOf(p: Params): string {
  if (p.m >= 0 && p.m < TAUNTS.length) return TAUNTS[p.m].replace('{t}', secondsText(p.t));
  if (p.mx) return p.mx;
  return TAUNTS[3];
}

/** /challenge/ 로 넘길 정리된 쿼리 (알려진 키만). */
export function cleanQuery(p: Params): string {
  const q = new URLSearchParams();
  q.set('l', String(p.l));
  q.set('t', String(p.t));
  if (p.hasN) q.set('n', p.n);
  if (p.m >= 0 && p.m < TAUNTS.length) q.set('m', String(p.m));
  else if (p.mx) { q.set('m', '-1'); q.set('mx', p.mx); }
  if (p.r !== null) q.set('r', String(p.r));
  return q.toString();
}
