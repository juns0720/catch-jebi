// 제비 상태, 전선 지오메트리, 비행 물리. 원본 아티팩트의 step/dash/scatter/nerves를 옮김.
import type { Personality } from '@/types';

export type BirdState = 'fly' | 'caught' | 'toWire' | 'wire' | 'dive' | 'cross' | 'exit';

export interface Bird {
  id: number; isWin: boolean; p: Personality;
  x: number; y: number; vx: number; vy: number;
  phase: number; turn: number; seed: number; delay: number; excite: number; scale: number;
  state: BirdState; entered: boolean;
  slot: number;                         // 전선 자리 번호
  fx: number; fy: number; ft: number;   // 전선 비행 출발점, 진행도 0~1
  steer: Bird | null;                   // 바꿔치기 예고 중 바라볼 상대
  rise: number;                         // 퇴장 중 위로 가속
  dead?: boolean;
}
export interface Feather { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number }
export interface Ripple { x: number; y: number; life: number; seal?: boolean }
export interface Popup { x: number; y: number; text: string; life: number; max: number; big: boolean }
export interface Stain { x: number; y: number; r: number; wipes: number; born: number; shape: number[] }
export interface Cloud { x: number; y: number; s: number; v: number }
export interface Star { x: number; y: number; r: number }
export interface Ptr { x: number; y: number; vx: number; vy: number; t: number; hover: boolean }
export interface Reveal { x: number; y: number; t0: number; dur: number }
export interface Dive { bird: Bird; t: number; sx: number; sy: number; tx: number; ty: number; base: number }

export interface Wires {
  lines: [number, number][][];   // 좌→우 폴리라인 (그리기용)
  sit: [number, number][];       // 앉는 전선, 오른쪽 끝에서 왼쪽으로
  cum: number[];
}

export interface World {
  W: number; H: number; DPR: number; S: number; T: number;
  birds: Bird[]; feathers: Feather[]; ripples: Ripple[]; popups: Popup[]; stains: Stain[];
  clouds: Cloud[]; stars: Star[];
  wires: Wires; wob: { amp: number; ph: number };
  ptr: Ptr; reveal: Reveal | null; dive: Dive | null;
}

export const rnd = () => Math.random();
export function rndSecure(): number {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; } catch { return Math.random(); }
}

// ---- 전선 ----
function quad(p0: [number, number], c: [number, number], p1: [number, number], n: number): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * p0[0] + 2 * u * t * c[0] + t * t * p1[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p1[1]]);
  }
  return out;
}

/** 원본 전봇대 전선과 같은 곡선. 두 번째 전선(i=1)에 꽝 제비가 앉는다 */
export function buildWires(W: number, H: number): Wires {
  const px = W * 0.85, armY = H * 0.2;
  const lines = [0, 1].map(i => {
    const ax = px + (i ? 28 : -28);
    const left = quad([-10, armY + H * 0.06 + i * 7], [ax * 0.5, armY + H * 0.14 + i * 7], [ax, armY], 40);
    const right = quad([ax, armY], [ax + (W - ax) * 0.5, armY + H * 0.07], [W + 10, armY + H * 0.04 + i * 5], 24);
    return left.concat(right.slice(1));
  });
  const sit = lines[1].filter(p => p[0] <= W - 20).reverse();
  const cum = [0];
  for (let i = 1; i < sit.length; i++) cum.push(cum[i - 1] + Math.hypot(sit[i][0] - sit[i - 1][0], sit[i][1] - sit[i - 1][1]));
  return { lines, sit, cum };
}

export function wireWobble(w: World, x: number): number { return w.wob.amp * Math.sin(w.wob.ph - x * 0.035); }

/** 앉는 자리 n의 위치 (출렁임 포함). 새가 앉는 높이로 약간 올림 */
export function slotPos(w: World, n: number): [number, number] {
  if (w.wires.sit.length < 2) return [w.W - 20, w.H * 0.2];
  const { sit, cum } = w.wires, d = Math.min(cum[cum.length - 1], (14 + n * 30) * w.S);
  let i = 1;
  while (i < cum.length - 1 && cum[i] < d) i++;
  const k = cum[i] > cum[i - 1] ? (d - cum[i - 1]) / (cum[i] - cum[i - 1]) : 0;
  const x = sit[i - 1][0] + (sit[i][0] - sit[i - 1][0]) * k, y = sit[i - 1][1] + (sit[i][1] - sit[i - 1][1]) * k;
  return [x, y + wireWobble(w, x) - 7 * w.S];
}

// ---- 생성 ----
export function makeBird(i: number, isWin: boolean, p: Personality, w: World, total: number): Bird {
  const left = i % 2 === 0;
  return {
    id: i, isWin, p,
    x: left ? -30 : w.W + 30, y: w.H * (0.2 + 0.5 * Math.random()),
    vx: (left ? 1 : -1) * p.cruise * w.S * 1.4, vy: (Math.random() - 0.5) * 40,
    phase: Math.random() * 6.28, turn: 0, seed: Math.random() * 10, delay: i * 0.18, excite: 0,
    scale: total > 16 ? 0.82 : 1, state: 'fly', entered: false,
    slot: -1, fx: 0, fy: 0, ft: 0, steer: null, rise: 0,
  };
}

// ---- 조작 ----
export function flyCount(w: World): number { let n = 0; for (const b of w.birds) if (b.state === 'fly') n++; return n; }
export const isActive = (b: Bird) => b.state === 'fly' && b.delay <= 0;

/** 남은 제비가 적을수록 예민해짐 (1~2배). 날쌘돌이 이상 성격에서만 */
export function nerves(w: World, total: number, on: boolean): number {
  if (!on) return 1;
  const n = Math.max(1, flyCount(w));
  return total > 1 ? 1 + (1 - (n - 1) / (total - 1)) : 2;
}

export function dash(w: World, b: Bird, fx: number, fy: number, power: number): void {
  let dx = b.x - fx, dy = b.y - fy, d = Math.hypot(dx, dy);
  if (d < 0.01) { dx = Math.random() - 0.5; dy = -1; d = Math.hypot(dx, dy); }
  const v = b.p.max * w.S * power;
  b.vx = dx / d * v; b.vy = dy / d * v; b.excite = 1; b.turn = (Math.random() - 0.5) * 3;
}

export function scatter(w: World, x: number, y: number, radius: number): void {
  for (const o of w.birds) if (isActive(o) && Math.hypot(o.x - x, o.y - y) < radius * w.S) dash(w, o, x, y, 0.8);
}

export function hitTest(w: World, x: number, y: number): Bird | null {
  let best: Bird | null = null, bd = Infinity;
  for (const b of w.birds) {
    if (!isActive(b)) continue;
    const d = Math.hypot(b.x - x, b.y - y);
    if (d < b.p.hitR * w.S * b.scale && d < bd) { bd = d; best = b; }
  }
  return best;
}

export function feathersAt(w: World, x: number, y: number, n: number, life = 1.6): void {
  for (let i = 0; i < n; i++) w.feathers.push({ x, y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, life: life + Math.random() });
}

// ---- 물리 ----
/** 날고 있는 제비 한 마리. k는 reducedMotion 속도 배율, flap은 날갯짓 배율 */
export function stepFlyer(w: World, b: Bird, dt: number, now: number, k: number, nv: number, flap: number): void {
  const { S, W, H, ptr } = w, m = b.p;
  const stale = now - ptr.t > 120;
  const fx = ptr.x + (stale ? 0 : ptr.vx * m.predict), fy = ptr.y + (stale ? 0 : ptr.vy * m.predict);
  const top = 70, bot = H - 90, mg = 60;
  b.turn += (Math.random() - 0.5) * 7 * dt; b.turn = Math.max(-1.5, Math.min(1.5, b.turn));
  let ang = Math.atan2(b.vy, b.vx) + b.turn * dt, v = Math.hypot(b.vx, b.vy);
  if (b.steer) {   // 바꿔치기 예고: 상대를 향해 방향을 튼다
    let d = Math.atan2(b.steer.y - b.y, b.steer.x - b.x) - ang;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    ang += Math.sign(d) * Math.min(Math.abs(d), 1.8 * dt);
  }
  b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v;
  let ax = 0, ay = 0;
  if (b.x < mg) ax += (mg - b.x) * 5; else if (b.x > W - mg) ax -= (b.x - (W - mg)) * 5;
  if (b.y < top) ay += (top - b.y) * 5; else if (b.y > bot) ay -= (b.y - bot) * 5;
  for (const o of w.birds) {
    if (o === b || !isActive(o)) continue;
    const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy;
    if (d2 < 1600 && d2 > 0.01) { const d = Math.sqrt(d2); ax += dx / d * (40 - d) * 7; ay += dy / d * (40 - d) * 7; }
  }
  if (ptr.hover && m.fleeR > 0) {
    const R = m.fleeR * S * Math.sqrt(nv);
    const pts = m.predict ? [[ptr.x, ptr.y], [fx, fy]] : [[ptr.x, ptr.y]];
    for (const [qx, qy] of pts) {
      const dx = b.x - qx, dy = b.y - qy, d = Math.hypot(dx, dy);
      if (d < R && d > 0.01) { const f = 1 - d / R; ax += dx / d * f * m.flee * nv; ay += dy / d * f * m.flee * nv; b.excite = 1; }
    }
  }
  b.vx += ax * dt; b.vy += ay * dt; b.vy *= 1 - 0.4 * dt;
  b.excite = Math.max(0, b.excite - dt * 0.8);
  v = Math.hypot(b.vx, b.vy);
  const cruise = m.cruise * k * S, maxV = cruise * 1.5 + (m.max * k * S - cruise * 1.5) * b.excite;
  let target = Math.min(maxV, Math.max(cruise * 0.6, v));
  target += (cruise - target) * Math.min(1, dt * 0.6) * (1 - b.excite);
  if (v > 0.01) { b.vx *= target / v; b.vy *= target / v; }
  b.x += b.vx * dt; b.y += b.vy * dt;
  if (b.entered) {
    if (b.x < 10) { b.x = 10; b.vx = Math.abs(b.vx); } else if (b.x > W - 10) { b.x = W - 10; b.vx = -Math.abs(b.vx); }
    if (b.y < 20) { b.y = 20; b.vy = Math.abs(b.vy); } else if (b.y > H - 50) { b.y = H - 50; b.vy = -Math.abs(b.vy); }
  } else if (b.x > 20 && b.x < W - 20) b.entered = true;
  b.phase += dt * (9 + target * 0.05) * flap;
}

/** 전선으로 날아가기. 도착하면 true */
export function stepToWire(w: World, b: Bird, dt: number, flightSec: number): boolean {
  b.ft = Math.min(1, b.ft + dt / flightSec);
  const [tx, ty] = slotPos(w, b.slot), cx = (b.fx + tx) / 2, cy = Math.min(b.fy, ty) - 90 * w.S;
  const e = b.ft * b.ft * (3 - 2 * b.ft), u = 1 - e;
  b.x = u * u * b.fx + 2 * u * e * cx + e * e * tx;
  b.y = u * u * b.fy + 2 * u * e * cy + e * e * ty;
  b.vx = 2 * u * (cx - b.fx) + 2 * e * (tx - cx); b.vy = 2 * u * (cy - b.fy) + 2 * e * (ty - cy);
  b.phase += dt * 30;
  if (b.ft < 1) return false;
  b.x = tx; b.y = ty;
  return true;
}

/** 화면 밖으로 퇴장 (실패 연출, 당첨 제비 이탈) */
export function stepExit(w: World, b: Bird, dt: number): void {
  b.vy -= b.rise * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.phase += dt * 32;
  if (b.y < -60 || b.x < -80 || b.x > w.W + 80) b.dead = true;
}
