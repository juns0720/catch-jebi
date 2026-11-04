// 캔버스 그리기. 세계 + 팝업 + 꽝 쪽지 펼침만. HUD 숫자는 그리지 않는다.
import type { Bird, World } from '@/game/birds';
import { wireWobble } from '@/game/birds';

export type Colors = Record<string, string>;
const TOK = ['sky-top', 'sky-bot', 'cloud', 'wire', 'pole', 'hill', 'hill2', 'bird', 'belly', 'orb', 'star', 'seal', 'paper', 'paper-ink', 'fg', 'muted', 'gold', 'poop'];

function parseColor(s: string): [number, number, number, number] | null {
  const h = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(s);
  if (h) {
    const x = h[1].length === 3 ? h[1].replace(/./g, c => c + c) : h[1];
    return [parseInt(x.slice(0, 2), 16), parseInt(x.slice(2, 4), 16), parseInt(x.slice(4, 6), 16), 1];
  }
  const m = /^rgba?\(([^)]+)\)$/i.exec(s);
  if (!m) return null;
  const v = m[1].split(/[\s,/]+/).filter(Boolean).map(Number);
  return v.length >= 3 ? [v[0], v[1], v[2], v[3] ?? 1] : null;
}
function mixColor(a: string, b: string, t: number): string {
  const pa = parseColor(a), pb = parseColor(b);
  if (!pa || !pb || t <= 0) return a;
  const l = (i: number) => Math.round(pa[i] + (pb[i] - pa[i]) * t);
  return `rgb(${l(0)},${l(1)},${l(2)})`;
}

/** CSS 변수에서 색과 폰트를 읽는다. winSlip = 당첨 쪽지 색 (paper + gold * winHint) */
export function readColors(winHint: number): Colors {
  const cs = getComputedStyle(document.documentElement), C: Colors = {};
  TOK.forEach(t => { C[t] = cs.getPropertyValue('--' + t).trim(); });
  C.display = cs.getPropertyValue('--font-display').trim() || 'serif';
  C.body = cs.getPropertyValue('--font-body').trim() || 'sans-serif';
  C.winSlip = mixColor(C.paper, C.gold, winHint);
  return C;
}

type Ctx = CanvasRenderingContext2D;
function ellipse(ctx: Ctx, x: number, y: number, rx: number, ry: number) { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v));

function hill(ctx: Ctx, W: number, H: number, y0: number, amp: number, freq: number, phase: number, color: string) {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 16) ctx.lineTo(x, y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.4);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}

/** 쪽지 한 장. open이면 펼친 쪽지(꽝 글자) */
function drawSlip(ctx: Ctx, x: number, y: number, rot: number, s: number, color: string, open: boolean, C: Colors) {
  ctx.save(); ctx.translate(x, y); ctx.rotate(rot);
  const pw = (open ? 17 : 13) * s, ph = (open ? 12 : 8) * s;
  ctx.fillStyle = color; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.strokeStyle = 'rgba(70,50,20,.35)'; ctx.lineWidth = 0.8; ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  if (open) {
    ctx.fillStyle = C.seal; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(9 * s)}px ${C.display}`; ctx.fillText('꽝', 0, 0.5 * s);
    ctx.textBaseline = 'alphabetic';
  } else {
    ctx.beginPath(); ctx.moveTo(-pw / 2, -ph / 2); ctx.lineTo(0, ph * 0.1); ctx.lineTo(pw / 2, -ph / 2); ctx.stroke();
  }
  ctx.restore();
}

function drawFlyer(ctx: Ctx, w: World, C: Colors, b: Bird, t: number) {
  const s = w.S * b.scale, a = Math.atan2(b.vy, b.vx);
  ctx.save(); ctx.translate(b.x, b.y); ctx.rotate(a); ctx.scale(s, s);
  const f = 0.5 + 0.5 * Math.sin(b.phase), span = 7 + 13 * f, tip = -9 + 4 * f;
  ctx.fillStyle = C.bird;
  ctx.beginPath(); ctx.moveTo(-6, -2.6); ctx.lineTo(-26, -8.5); ctx.lineTo(-15, 0); ctx.lineTo(-26, 8.5); ctx.lineTo(-6, 2.6); ctx.closePath(); ctx.fill();
  for (const g of [-1, 1]) {
    ctx.beginPath(); ctx.moveTo(4, 2 * g);
    ctx.quadraticCurveTo(2, span * g * 1.05, tip, span * g);
    ctx.quadraticCurveTo(-3, span * 0.45 * g, -5, 2.2 * g);
    ctx.closePath(); ctx.fill();
  }
  ellipse(ctx, 0, 0, 11, 4.2);
  ctx.fillStyle = C.belly; ellipse(ctx, -1.5, 0, 6.5, 2.1);
  ctx.fillStyle = C.bird; ellipse(ctx, 9.5, 0, 4.3, 4.1);
  ctx.fillStyle = C.seal; ellipse(ctx, 11.6, 0, 2.3, 2.6);
  ctx.fillStyle = C.bird; ctx.beginPath(); ctx.moveTo(13.4, -1.1); ctx.lineTo(16.4, 0); ctx.lineTo(13.4, 1.1); ctx.fill();
  ctx.restore();

  // 부리에 문 쪽지. 당첨 쪽지만 금색이 섞인다
  const bx = b.x + Math.cos(a) * 16 * s, by = b.y + Math.sin(a) * 16 * s;
  const sway = Math.sin(t * 4 + b.seed) * 0.25 - b.vx * 0.0015;
  const len = 9 * s, sx = bx + Math.sin(sway) * len, sy = by + Math.cos(sway) * len;
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(sx, sy); ctx.stroke();
  const open = b.state === 'toWire';
  drawSlip(ctx, sx, sy + 4 * s, -sway * 0.8, s, open || !b.isWin ? C.paper : C.winSlip, open, C);
}

/** 전선에 앉은 제비: 옆모습, 왼쪽(전봇대 쪽)을 보고 펼친 쪽지를 늘어뜨림 */
function drawPerched(ctx: Ctx, w: World, C: Colors, b: Bird, t: number) {
  const s = w.S * b.scale * 0.95;
  ctx.save(); ctx.translate(b.x, b.y); ctx.scale(s, s);
  ctx.fillStyle = C.bird;
  ctx.beginPath(); ctx.moveTo(6, 1); ctx.lineTo(20, 7); ctx.lineTo(16, 2); ctx.lineTo(22, 1); ctx.lineTo(8, -2); ctx.closePath(); ctx.fill();
  ellipse(ctx, 0, 0, 10, 5.2);
  ctx.fillStyle = C.belly; ellipse(ctx, -2, 2.2, 6.2, 2.6);
  ctx.fillStyle = C.bird; ellipse(ctx, -9, -3, 4.2, 4);
  ctx.fillStyle = C.seal; ellipse(ctx, -11.4, -2.6, 2.2, 1.7);
  ctx.fillStyle = C.bird; ctx.beginPath(); ctx.moveTo(-13.4, -3.4); ctx.lineTo(-16.2, -2.4); ctx.lineTo(-13.4, -1.8); ctx.fill();
  ctx.fillStyle = C.belly; ctx.fillRect(-9.7, -4.2, 1.3, 1.3);
  ctx.restore();
  const sway = Math.sin(t * 1.6 + b.seed) * 0.06 + wireWobble(w, b.x) * 0.01;
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(b.x - 12 * s, b.y); ctx.lineTo(b.x - 12 * s, b.y + 9 * s); ctx.stroke();
  drawSlip(ctx, b.x - 12 * s, b.y + 15 * s, sway, s * 1.15, C.paper, true, C);
}

function drawStain(ctx: Ctx, C: Colors, w: World, st: World['stains'][number]) {
  const age = w.T - st.born, fade = age > 20 ? Math.max(0, 1 - (age - 20)) : 1;
  ctx.globalAlpha = fade * (1 - 0.2 * st.wipes); ctx.fillStyle = C.poop;
  const n = st.shape.length;
  ctx.beginPath();
  for (let i = 0; i <= n; i++) {
    const a = (i % n) / n * Math.PI * 2, r = st.r * st.shape[i % n] * 0.82;
    const x = st.x + Math.cos(a) * r, y = st.y + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
  }
  ctx.closePath(); ctx.fill();
  for (let i = 0; i < 3; i++) { const a = st.shape[i] * 9 + i * 2.1; ellipse(ctx, st.x + Math.cos(a) * st.r * 0.95, st.y + Math.sin(a) * st.r * 0.9, 4 + i * 1.5, 3 + i); }
  ctx.globalAlpha = 1;
}

/** 꽝 쪽지 펼침: 제비 위에 작은 종이 + "꽝" */
function drawReveal(ctx: Ctx, w: World, C: Colors, now: number) {
  const r = w.reveal; if (!r) return;
  const age = now - r.t0; if (age < 0) return;
  const p = age / r.dur, k = clamp(age / 260, 0, 1), e = 1 + 2.2 * Math.pow(k - 1, 3) + 1.2 * Math.pow(k - 1, 2);
  const pw = 128 * w.S, ph = 84 * w.S;
  ctx.save(); ctx.translate(r.x, r.y); ctx.rotate(-0.05);
  ctx.scale(0.25 + 0.75 * e, 0.06 + 0.94 * e); ctx.globalAlpha = p > 0.88 ? Math.max(0, 1 - (p - 0.88) / 0.12) : 1;
  ctx.shadowColor = 'rgba(0,0,0,.28)'; ctx.shadowBlur = 14; ctx.shadowOffsetY = 4;
  ctx.fillStyle = C.paper; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.shadowColor = 'transparent';
  ctx.strokeStyle = 'rgba(70,50,20,.12)'; ctx.lineWidth = 1;
  for (const y of [-ph / 6, ph / 6]) { ctx.beginPath(); ctx.moveTo(-pw / 2, y); ctx.lineTo(pw / 2, y); ctx.stroke(); }
  ctx.strokeStyle = 'rgba(70,50,20,.4)'; ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  ctx.fillStyle = C.seal; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(46 * w.S)}px ${C.display}`; ctx.fillText('꽝', 0, 3 * w.S);
  ctx.restore(); ctx.textBaseline = 'alphabetic';
}

export interface DrawOpts { now: number; shake: [number, number]; tone: number }

export function drawWorld(ctx: Ctx, w: World, C: Colors, o: DrawOpts): void {
  const { W, H, S, T } = w;
  ctx.setTransform(w.DPR, 0, 0, w.DPR, 0, 0);
  ctx.save(); ctx.translate(o.shake[0], o.shake[1]);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C['sky-top']); g.addColorStop(1, C['sky-bot']);
  ctx.fillStyle = g; ctx.fillRect(-10, -10, W + 20, H + 20);

  ctx.fillStyle = C.star;
  for (const st of w.stars) { ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2); ctx.fill(); }
  const ox = W * 0.64, oy = H * 0.17, orr = Math.max(18, Math.min(W, H) * 0.055);
  ctx.fillStyle = C.orb; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(ox, oy, orr * 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

  ctx.fillStyle = C.cloud;
  for (const c of w.clouds) {
    const r = 22 * c.s;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.arc(c.x + r * 1.1, c.y - r * 0.4, r * 1.2, 0, Math.PI * 2);
    ctx.arc(c.x + r * 2.3, c.y, r * 0.95, 0, Math.PI * 2); ctx.arc(c.x + r * 1.2, c.y + r * 0.3, r, 0, Math.PI * 2);
    ctx.fill();
  }

  hill(ctx, W, H, H - 78, 16, 0.006, 1, C.hill2);
  const px = W * 0.85, armY = H * 0.2;
  ctx.fillStyle = C.pole; ctx.fillRect(px - 3, armY - 16, 6, H - armY + 16); ctx.fillRect(px - 34, armY, 68, 4);
  ctx.strokeStyle = C.wire; ctx.lineWidth = 1.3;
  for (const line of w.wires.lines) {
    ctx.beginPath();
    line.forEach(([x, y], i) => { const yy = y + wireWobble(w, x); if (i === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); });
    ctx.stroke();
  }
  hill(ctx, W, H, H - 42, 10, 0.009, 3, C.hill);

  for (const st of w.stains) drawStain(ctx, C, w, st);
  if (w.dive) {   // 급강하 그림자
    const d = w.dive, u = Math.min(1, d.t);
    ctx.fillStyle = C.fg; ctx.globalAlpha = 0.1 + 0.2 * u; ellipse(ctx, d.tx, d.ty, (10 + 34 * u) * S, (5 + 16 * u) * S); ctx.globalAlpha = 1;
  }

  for (const b of w.birds) {
    if (b.delay > 0) continue;
    const covered = w.stains.some(st => Math.hypot(st.x - b.x, st.y - b.y) < st.r);
    if (covered) ctx.globalAlpha = 0.35;
    if (b.state === 'wire') drawPerched(ctx, w, C, b, T);
    else if (b.state === 'caught') {   // 잡혀서 버둥
      const j = Math.sin(T * 70) * 1.6;
      b.x += j; drawFlyer(ctx, w, C, b, T); b.x -= j;
    } else drawFlyer(ctx, w, C, b, T);
    ctx.globalAlpha = 1;
  }

  ctx.fillStyle = C.bird;
  for (const f of w.feathers) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = Math.min(1, f.life);
    ellipse(ctx, 0, 0, 4.5 * S, 1.5 * S); ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const r of w.ripples) {
    ctx.strokeStyle = r.seal ? C.seal : C.fg; ctx.globalAlpha = r.life * 1.4; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, (1 - r.life / 0.5) * 28 + 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // 하늘 톤: 당첨이면 밝게, 실패면 어둡게
  if (Math.abs(o.tone) > 0.01) {
    ctx.fillStyle = o.tone > 0 ? `rgba(255,255,255,${0.2 * o.tone})` : `rgba(8,14,28,${0.3 * -o.tone})`;
    ctx.fillRect(-10, -10, W + 20, H + 20);
  }

  drawReveal(ctx, w, C, o.now);

  ctx.textAlign = 'center'; ctx.fillStyle = C.fg;
  for (const p of w.popups) {
    const size = Math.round((p.big ? 34 : 17) * S), age = p.max - p.life;
    ctx.font = `${size}px ${C.display}`;
    const half = ctx.measureText(p.text).width / 2 + 12;
    const x = clamp(p.x, half, W - half), y = Math.max(size, p.y);
    ctx.globalAlpha = Math.min(1, p.life * 2);
    if (p.big) {
      const pop = 1 + Math.max(0, 1 - age / 0.15) * 0.25;
      ctx.save(); ctx.translate(x, y); ctx.scale(pop, pop);
      ctx.lineJoin = 'round'; ctx.lineWidth = 6; ctx.strokeStyle = C['sky-bot']; ctx.strokeText(p.text, 0, 0);
      ctx.fillText(p.text, 0, 0); ctx.restore();
    } else ctx.fillText(p.text, x, y);
  }
  ctx.globalAlpha = 1;
  ctx.restore();
}

