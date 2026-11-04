import '@/styles/tokens.css';
import './lottery.css';
import { track, initAnalytics } from '@/data/analytics';

initAnalytics();
track('landing_view');

type ModeKey = 'calm' | 'normal' | 'fast' | 'hard';
interface Mode {
  cruise: number; max: number; fleeR: number; flee: number; hitR: number;
  slip: boolean; dodge: number; escape: number; predict: number; blind: number; hint: string;
}
interface Bird {
  item: string; x: number; y: number; vx: number; vy: number;
  phase: number; turn: number; seed: number; delay: number;
  state: 'fly' | 'leaving'; excite: number; scale: number;
  slipX: number | null; slipY: number | null;
  entered?: boolean; dead?: boolean;
}
interface Feather { x: number; y: number; vx: number; vy: number; rot: number; vr: number; life: number; }
interface Ripple { x: number; y: number; life: number; seal?: boolean; }
interface Popup { x: number; y: number; text: string; life: number; }
interface Cloud { x: number; y: number; s: number; v: number; }
interface Star { x: number; y: number; r: number; }

const $ = <T extends HTMLElement = HTMLElement>(s: string): T => document.querySelector(s) as T;
const canvas = $<HTMLCanvasElement>('#sky');
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
const stage = $('#stage');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

const MODES: Record<ModeKey, Mode> = {
  calm:   { cruise: 55,  max: 120, fleeR: 60,  flee: 260,  hitR: 26, slip: true,  dodge: 0,    escape: 0,    predict: 0,    blind: 1,   hint: '느긋하게 날아다니고 거의 도망가지 않아요.' },
  normal: { cruise: 90,  max: 300, fleeR: 130, flee: 1400, hitR: 20, slip: true,  dodge: 0.1,  escape: 0,    predict: 0,    blind: 1,   hint: '손이 다가가면 슬쩍 피해요.' },
  fast:   { cruise: 130, max: 480, fleeR: 180, flee: 3000, hitR: 16, slip: false, dodge: 0.3,  escape: 0.1,  predict: 0.1,  blind: 0.6, hint: '가까이 가면 휙 달아나요. 구석으로 몰아서 잡아 보세요.' },
  hard:   { cruise: 175, max: 720, fleeR: 240, flee: 6500, hitR: 12, slip: false, dodge: 0.5,  escape: 0.3,  predict: 0.22, blind: 0.15, hint: '손이 어디로 갈지 미리 읽고 피해요. 잡혀도 버둥거리다 빠져나가고, 남은 제비가 적을수록 더 예민해져요. 쪽지는 잡아도 안 돼요. 몸통을 노리세요.' }
};
const PRESETS = {
  win: '당첨\n꽝\n꽝\n꽝\n꽝\n꽝',
  order: '1번\n2번\n3번\n4번\n5번\n6번',
  chores: '설거지\n청소기 돌리기\n분리수거\n빨래 개기\n쉬는 날',
  lunch: '김치찌개\n제육볶음\n냉면\n돈가스\n순댓국\n비빔밥'
};
type PresetKey = keyof typeof PRESETS;
const MAX_BIRDS = 30;
const TOK = ['sky-top', 'sky-bot', 'cloud', 'wire', 'pole', 'hill', 'hill2', 'bird', 'belly', 'orb', 'star', 'seal', 'paper', 'fg', 'muted'];
const C: Record<string, string> = {};
const store = {
  get(k: string): string | null { try { return localStorage.getItem(k); } catch (e) { return null; } },
  set(k: string, v: string): void { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } }
};

let W = 1, H = 1, DPR = 1, S = 1;
let birds: Bird[] = [], feathers: Feather[] = [], ripples: Ripple[] = [], clouds: Cloud[] = [], stars: Star[] = [], caught: string[] = [];
let total = 0, mode: ModeKey = 'hard', modalOpen = false, lastFocus: HTMLElement | null = null, misses = 0, popups: Popup[] = [];
const ptr = { x: -999, y: -999, vx: 0, vy: 0, t: 0, hover: false, until: 0 };

function readTokens(): void {
  const cs = getComputedStyle(document.documentElement);
  TOK.forEach(t => { C[t] = cs.getPropertyValue('--' + t).trim(); });
}
readTokens();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', readTokens);
new MutationObserver(readTokens).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

function rnd(): number {
  try { const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296; }
  catch (e) { return Math.random(); }
}
function rawItems(): string[] { return $<HTMLTextAreaElement>('#items').value.split('\n').map(s => s.trim()).filter(Boolean); }
function parseItems(): string[] { return rawItems().slice(0, MAX_BIRDS); }
const isWin = (t: string): boolean => /당첨|1등|합격|축하/.test(t);

function resize(): void {
  const r = stage.getBoundingClientRect();
  const oldW = W, oldH = H;
  DPR = Math.min(2, window.devicePixelRatio || 1);
  W = Math.max(1, r.width); H = Math.max(1, r.height);
  canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
  S = Math.max(0.85, Math.min(1.25, W / 820));
  if (!clouds.length) {
    for (let i = 0; i < 5; i++) clouds.push({ x: Math.random() * W, y: H * (0.1 + Math.random() * 0.45), s: 0.6 + Math.random() * 0.9, v: 6 + Math.random() * 10 });
    for (let i = 0; i < 60; i++) stars.push({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.2 + 0.3 });
  } else if (oldW > 1) {
    birds.forEach(b => { b.x *= W / oldW; b.y *= H / oldH; });
    clouds.forEach(c => { c.y *= H / oldH; });
  }
}
resize();
new ResizeObserver(resize).observe(stage);

function release(fromEdges: boolean): void {
  let items = parseItems();
  if (!items.length) { $<HTMLTextAreaElement>('#items').value = PRESETS.win; items = parseItems(); updateNote(); }
  const arr = items.slice();
  for (let i = arr.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [arr[i], arr[j]] = [arr[j], arr[i]]; }
  total = arr.length; caught = []; feathers = []; ripples = []; popups = []; misses = 0;
  const m = MODES[mode];
  birds = arr.map((item, i): Bird => {
    const left = i % 2 === 0;
    const ang = Math.random() * Math.PI * 2;
    return {
      item,
      x: fromEdges ? (left ? -30 : W + 30) : W * (0.1 + Math.random() * 0.8),
      y: H * (0.2 + 0.5 * Math.random()),
      vx: fromEdges ? (left ? 1 : -1) * m.cruise * 1.4 : Math.cos(ang) * m.cruise,
      vy: fromEdges ? (Math.random() - 0.5) * 40 : Math.sin(ang) * m.cruise * 0.5,
      phase: Math.random() * 6.28, turn: 0, seed: Math.random() * 10,
      delay: fromEdges ? i * 0.18 : 0, state: 'fly', excite: 0,
      scale: total > 16 ? 0.82 : 1, slipX: null, slipY: null
    };
  });
  renderList(); updateCount();
  store.set('jebi-items', $<HTMLTextAreaElement>('#items').value);
}

function flying(): Bird[] { return birds.filter(b => b.state === 'fly'); }

function updateCount(): void {
  const n = flying().length;
  $('#flyCount').textContent = (n ? `날고 있는 제비 ${n}마리` : '모든 제비를 잡았어요') + ` · 헛손질 ${misses}번`;
  $('#caughtCount').textContent = `${caught.length} / ${total}`;
  $('#ctaChallenge').hidden = n > 0 || total === 0;
}
function updateNote(): void {
  const n = rawItems().length;
  $('#itemsNote').textContent = n === 0 ? '쪽지가 비어 있어요. 비워 두면 당첨 1 · 꽝 5로 날아가요.'
    : n > MAX_BIRDS ? `제비 ${n}마리 중 앞의 ${MAX_BIRDS}마리만 날아가요.` : `제비 ${n}마리`;
}
function renderList(): void {
  const ol = $('#results'); ol.textContent = '';
  if (!caught.length) {
    const li = document.createElement('li'); li.className = 'empty';
    li.textContent = '아직 잡은 제비가 없어요. 하늘에서 한 마리 잡아 보세요.';
    ol.append(li);
  }
  caught.forEach((t, i) => {
    const li = document.createElement('li'); if (isWin(t)) li.className = 'win';
    const n = document.createElement('span'); n.className = 'n'; n.textContent = String(i + 1);
    const s = document.createElement('span'); s.className = 't'; s.textContent = t;
    li.append(n, s); ol.append(li);
  });
}

function catchBird(b: Bird): void {
  modalOpen = true;
  b.state = 'leaving';
  b.vx = (b.x < W / 2 ? -1 : 1) * (160 + Math.random() * 80); b.vy = -200;
  for (let i = 0; i < 6; i++) feathers.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, life: 1.6 + Math.random() });
  ripples.push({ x: b.x, y: b.y, life: 0.5, seal: true });
  caught.push(b.item); renderList(); updateCount();
  if (!flying().length) track('lottery_done');
  setTimeout(() => openSlip(b.item, caught.length), reduce ? 0 : 320);
}

function openSlip(item: string, n: number): void {
  lastFocus = document.activeElement as HTMLElement | null;
  $('#slipOrder').textContent = `${n}번째로 잡은 제비`;
  $('#slipText').textContent = item;
  $('#stamp').hidden = !isWin(item);
  $('#closeSlip').textContent = flying().length ? '다음 제비 잡으러 가기' : '닫기';
  $('#veil').hidden = false;
  const slip = $('#slip'); slip.classList.remove('open'); void slip.offsetWidth; slip.classList.add('open');
  $('#closeSlip').focus();
}
function closeSlip(): void {
  $('#veil').hidden = true; modalOpen = false;
  if (lastFocus && lastFocus.focus && lastFocus !== document.body) lastFocus.focus();
}

function hitTest(x: number, y: number, touch: boolean): Bird | null {
  const m = MODES[mode];
  let best: Bird | null = null, bd = Infinity;
  for (const b of birds) {
    if (b.state !== 'fly' || b.delay > 0) continue;
    const r = (m.hitR * S + (touch ? 10 : 0)) * b.scale;
    let d = Math.hypot(b.x - x, b.y - y);
    if (m.slip && b.slipX != null && b.slipY != null) d = Math.min(d, Math.hypot(b.slipX - x, b.slipY - y));
    if (d < r && d < bd) { bd = d; best = b; }
  }
  return best;
}

// 남은 제비가 적을수록 예민해짐 (1 ~ 2배)
function nerves(): number {
  if (mode !== 'hard' && mode !== 'fast') return 1;
  const n = flying().length;
  return total > 1 ? 1 + (1 - (n - 1) / (total - 1)) : 2;
}
function popup(x: number, y: number, text: string): void { popups.push({ x, y, text, life: 0.9 }); }
function dash(b: Bird, fx: number, fy: number, power: number): void {
  const m = MODES[mode];
  let dx = b.x - fx, dy = b.y - fy, d = Math.hypot(dx, dy);
  if (d < 0.01) { dx = Math.random() - 0.5; dy = -1; d = Math.hypot(dx, dy); }
  const v = m.max * S * power;
  b.vx = dx / d * v; b.vy = dy / d * v; b.excite = 1; b.turn = (Math.random() - 0.5) * 3;
}
function scatter(x: number, y: number, radius: number): void {
  for (const o of birds) {
    if (o.state !== 'fly' || o.delay > 0) continue;
    if (Math.hypot(o.x - x, o.y - y) < radius * S) dash(o, x, y, 0.8);
  }
}
function miss(x: number, y: number, label?: string): void {
  misses++; updateCount();
  ripples.push({ x, y, life: 0.5 });
  if (label) popup(x, y - 18, label);
}

function tryCatch(b: Bird, x: number, y: number): void {
  const m = MODES[mode], nv = nerves();
  if (rnd() < Math.min(0.85, m.dodge * nv)) {
    dash(b, x, y, 1.15); scatter(x, y, 160);
    miss(b.x, b.y, ['휙!', '어림없지', '놓쳤다!'][Math.floor(Math.random() * 3)]);
    return;
  }
  if (rnd() < m.escape * nv) {
    for (let i = 0; i < 3; i++) feathers.push({ x: b.x, y: b.y, vx: (Math.random() - 0.5) * 140, vy: -Math.random() * 90, rot: Math.random() * 6, vr: (Math.random() - 0.5) * 6, life: 1.4 });
    dash(b, x, y, 1.2); scatter(x, y, 220);
    miss(b.x, b.y, '푸드덕! 빠져나갔다');
    return;
  }
  catchBird(b);
}

function localPoint(e: PointerEvent): [number, number] { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; }
canvas.addEventListener('pointermove', e => {
  const [x, y] = localPoint(e), now = performance.now(), dtm = Math.max(8, now - ptr.t);
  if (ptr.t && now - ptr.t < 120) {
    ptr.vx = ptr.vx * 0.6 + ((x - ptr.x) / dtm * 1000) * 0.4;
    ptr.vy = ptr.vy * 0.6 + ((y - ptr.y) / dtm * 1000) * 0.4;
  } else { ptr.vx = 0; ptr.vy = 0; }
  ptr.x = x; ptr.y = y; ptr.t = now;
  if (e.pointerType === 'mouse') ptr.hover = true; else ptr.until = now + 400;
});
canvas.addEventListener('pointerleave', () => { ptr.hover = false; ptr.vx = ptr.vy = 0; });
canvas.addEventListener('pointerdown', e => {
  if (modalOpen) return;
  const [x, y] = localPoint(e); ptr.x = x; ptr.y = y;
  const touch = e.pointerType !== 'mouse';
  if (touch) ptr.until = performance.now() + 700;
  const b = hitTest(x, y, touch);
  if (b) tryCatch(b, x, y);
  else { miss(x, y); if (MODES[mode].dodge > 0) scatter(x, y, 200); }
});

$('#grab').addEventListener('click', () => {
  if (modalOpen) return;
  const c = birds.filter(b => b.state === 'fly' && b.delay <= 0);
  if (!c.length) return;
  const b = c[Math.floor(rnd() * c.length)];
  if (rnd() < MODES[mode].blind) catchBird(b);
  else { dash(b, b.x, b.y + 10, 1); miss(b.x, b.y, '눈 감고는 무리예요'); }
});
$('#closeSlip').addEventListener('click', closeSlip);
$('#veil').addEventListener('click', e => { if ((e.target as HTMLElement).id === 'veil') closeSlip(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#veil').hidden) closeSlip(); });
$('#release').addEventListener('click', () => { if (!modalOpen) release(true); });
$('#items').addEventListener('input', () => { updateNote(); store.set('jebi-items', $<HTMLTextAreaElement>('#items').value); });
document.querySelectorAll<HTMLButtonElement>('.chip').forEach(btn => btn.addEventListener('click', () => {
  $<HTMLTextAreaElement>('#items').value = PRESETS[btn.dataset.preset as PresetKey]; updateNote(); if (!modalOpen) release(true);
}));
document.querySelectorAll<HTMLInputElement>('input[name="mode"]').forEach(r => r.addEventListener('change', () => {
  mode = r.value as ModeKey; $('#modeHint').textContent = MODES[mode].hint; store.set('jebi-mode2', mode);
}));
$('#menuChallenge').addEventListener('click', () => track('challenge_enter', { from: 'menu' }));
$('#ctaChallenge').addEventListener('click', () => track('challenge_enter', { from: 'cta' }));

function step(dt: number, now: number): void {
  const m = MODES[mode], k = reduce ? 0.6 : 1;
  const fleeOn = ptr.hover || now < ptr.until;
  const nv = nerves();
  // 마우스가 갈 곳을 미리 읽음
  const stale = now - ptr.t > 120;
  const fx = ptr.x + (stale ? 0 : ptr.vx * m.predict), fy = ptr.y + (stale ? 0 : ptr.vy * m.predict);
  for (const c of clouds) { c.x += c.v * dt; if (c.x - c.s * 70 > W) c.x = -c.s * 70; }
  const top = 70, bot = H - 90, mg = 60;
  for (const b of birds) {
    if (b.delay > 0) { b.delay -= dt; continue; }
    if (b.state === 'leaving') {
      b.vy -= 380 * dt; b.x += b.vx * dt; b.y += b.vy * dt; b.phase += dt * 32;
      if (b.y < -60 || b.x < -80 || b.x > W + 80) b.dead = true;
      continue;
    }
    b.turn += (Math.random() - 0.5) * 7 * dt; b.turn = Math.max(-1.5, Math.min(1.5, b.turn));
    const ang = Math.atan2(b.vy, b.vx) + b.turn * dt;
    let v = Math.hypot(b.vx, b.vy);
    b.vx = Math.cos(ang) * v; b.vy = Math.sin(ang) * v;
    let ax = 0, ay = 0;
    if (b.x < mg) ax += (mg - b.x) * 5; else if (b.x > W - mg) ax -= (b.x - (W - mg)) * 5;
    if (b.y < top) ay += (top - b.y) * 5; else if (b.y > bot) ay -= (b.y - bot) * 5;
    for (const o of birds) {
      if (o === b || o.state !== 'fly' || o.delay > 0) continue;
      const dx = b.x - o.x, dy = b.y - o.y, d2 = dx * dx + dy * dy;
      if (d2 < 1600 && d2 > 0.01) { const d = Math.sqrt(d2); ax += dx / d * (40 - d) * 7; ay += dy / d * (40 - d) * 7; }
    }
    if (fleeOn && m.fleeR > 0) {
      const R = m.fleeR * S * Math.sqrt(nv);
      const pts: Array<[number, number]> = m.predict ? [[ptr.x, ptr.y], [fx, fy]] : [[ptr.x, ptr.y]];
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
    b.phase += dt * (9 + target * 0.05);
  }
  for (const p of popups) { p.y -= 30 * dt; p.life -= dt; }
  popups = popups.filter(p => p.life > 0);
  if (birds.some(b => b.dead)) birds = birds.filter(b => !b.dead);
  for (const f of feathers) { f.vy += 50 * dt; f.vx *= 1 - 1.5 * dt; f.x += (f.vx + Math.sin(f.rot * 2) * 18) * dt; f.y += Math.min(f.vy, 60) * dt; f.rot += f.vr * dt; f.life -= dt; }
  feathers = feathers.filter(f => f.life > 0);
  for (const r of ripples) r.life -= dt;
  ripples = ripples.filter(r => r.life > 0);
}

function ellipse(x: number, y: number, rx: number, ry: number): void { ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); ctx.fill(); }

function drawBird(b: Bird, t: number): void {
  const s = S * b.scale, a = Math.atan2(b.vy, b.vx);
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
  ellipse(0, 0, 11, 4.2);
  ctx.fillStyle = C.belly; ellipse(-1.5, 0, 6.5, 2.1);
  ctx.fillStyle = C.bird; ellipse(9.5, 0, 4.3, 4.1);
  ctx.fillStyle = C.seal; ellipse(11.6, 0, 2.3, 2.6);
  ctx.fillStyle = C.bird; ctx.beginPath(); ctx.moveTo(13.4, -1.1); ctx.lineTo(16.4, 0); ctx.lineTo(13.4, 1.1); ctx.fill();
  ctx.restore();

  if (b.state !== 'fly') { b.slipX = null; return; }
  const bx = b.x + Math.cos(a) * 16 * s, by = b.y + Math.sin(a) * 16 * s;
  const sway = Math.sin(t * 4 + b.seed) * 0.25 - b.vx * 0.0015;
  const len = 9 * s, sx = bx + Math.sin(sway) * len, sy = by + Math.cos(sway) * len;
  ctx.strokeStyle = C.muted; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(bx, by); ctx.lineTo(sx, sy); ctx.stroke();
  ctx.save(); ctx.translate(sx, sy + 4 * s); ctx.rotate(-sway * 0.8);
  const pw = 13 * s, ph = 8 * s;
  ctx.fillStyle = C.paper; ctx.fillRect(-pw / 2, -ph / 2, pw, ph);
  ctx.strokeStyle = 'rgba(70,50,20,.35)'; ctx.lineWidth = 0.8;
  ctx.strokeRect(-pw / 2, -ph / 2, pw, ph);
  ctx.beginPath(); ctx.moveTo(-pw / 2, -ph / 2); ctx.lineTo(0, ph * 0.1); ctx.lineTo(pw / 2, -ph / 2); ctx.stroke();
  ctx.restore();
  b.slipX = sx; b.slipY = sy + 4 * s;
}

function hill(y0: number, amp: number, freq: number, phase: number, color: string): void {
  ctx.fillStyle = color; ctx.beginPath(); ctx.moveTo(0, H);
  for (let x = 0; x <= W + 20; x += 16) ctx.lineTo(x, y0 + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase * 1.7) * amp * 0.4);
  ctx.lineTo(W, H); ctx.closePath(); ctx.fill();
}

function draw(t: number): void {
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, C['sky-top']); g.addColorStop(1, C['sky-bot']);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = C.star;
  for (const st of stars) { ctx.beginPath(); ctx.arc(st.x * W, st.y * H, st.r, 0, Math.PI * 2); ctx.fill(); }

  const ox = W * 0.64, oy = H * 0.17, orr = Math.max(18, Math.min(W, H) * 0.055);
  ctx.fillStyle = C.orb; ctx.globalAlpha = 0.25; ctx.beginPath(); ctx.arc(ox, oy, orr * 1.9, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 0.95; ctx.beginPath(); ctx.arc(ox, oy, orr, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;

  ctx.fillStyle = C.cloud;
  for (const c of clouds) {
    const r = 22 * c.s;
    ctx.beginPath();
    ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.arc(c.x + r * 1.1, c.y - r * 0.4, r * 1.2, 0, Math.PI * 2);
    ctx.arc(c.x + r * 2.3, c.y, r * 0.95, 0, Math.PI * 2); ctx.arc(c.x + r * 1.2, c.y + r * 0.3, r, 0, Math.PI * 2);
    ctx.fill();
  }

  hill(H - 78, 16, 0.006, 1, C.hill2);
  const px = W * 0.85, armY = H * 0.2;
  ctx.fillStyle = C.pole; ctx.fillRect(px - 3, armY - 16, 6, H - armY + 16); ctx.fillRect(px - 34, armY, 68, 4);
  ctx.strokeStyle = C.wire; ctx.lineWidth = 1.3;
  [-28, 28].forEach((o, i) => {
    const ax = px + o;
    ctx.beginPath(); ctx.moveTo(-10, armY + H * 0.06 + i * 7);
    ctx.quadraticCurveTo(ax * 0.5, armY + H * 0.14 + i * 7, ax, armY);
    ctx.quadraticCurveTo(ax + (W - ax) * 0.5, armY + H * 0.07, W + 10, armY + H * 0.04 + i * 5);
    ctx.stroke();
  });
  hill(H - 42, 10, 0.009, 3, C.hill);

  for (const b of birds) if (b.delay <= 0) drawBird(b, t);

  ctx.fillStyle = C.bird;
  for (const f of feathers) {
    ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot); ctx.globalAlpha = Math.min(1, f.life);
    ellipse(0, 0, 4.5 * S, 1.5 * S); ctx.restore();
  }
  ctx.globalAlpha = 1;
  for (const r of ripples) {
    ctx.strokeStyle = r.seal ? C.seal : C.fg; ctx.globalAlpha = r.life * 1.4; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(r.x, r.y, (1 - r.life / 0.5) * 28 + 4, 0, Math.PI * 2); ctx.stroke();
  }
  ctx.globalAlpha = 1;

  ctx.textAlign = 'center'; ctx.fillStyle = C.fg;
  ctx.font = `${Math.round(17 * S)}px "Song Myung", serif`;
  for (const p of popups) { ctx.globalAlpha = Math.min(1, p.life * 2); ctx.fillText(p.text, Math.max(70, Math.min(W - 70, p.x)), Math.max(24, p.y)); }
  ctx.globalAlpha = 1;
  if (total > 0 && caught.length === 0) {
    ctx.globalAlpha = 0.7; ctx.font = `15px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillText('날아다니는 제비를 눌러서 잡아 보세요', W / 2, H - 104);
    ctx.globalAlpha = 1;
  } else if (total > 0 && !flying().length && !modalOpen) {
    ctx.font = `${Math.round(26 * S)}px "Song Myung", serif`;
    ctx.fillText('모든 제비를 잡았어요', W / 2, H * 0.46);
    ctx.globalAlpha = 0.7; ctx.font = `14px ${getComputedStyle(document.body).fontFamily}`;
    ctx.fillText('‘제비 날려 보내기’를 누르면 다시 날아와요', W / 2, H * 0.46 + 30);
    ctx.globalAlpha = 1;
  }
}

// 시작 상태 복원
const savedItems = store.get('jebi-items');
if (savedItems && savedItems.trim()) $<HTMLTextAreaElement>('#items').value = savedItems;
const savedMode = store.get('jebi-mode2');
if (savedMode && MODES[savedMode as ModeKey]) { mode = savedMode as ModeKey; $<HTMLInputElement>('#m-' + mode).checked = true; }
$('#modeHint').textContent = MODES[mode].hint;
updateNote();
release(false);

let last = performance.now(), T = 0;
function frame(now: number): void {
  const dt = Math.min(0.05, (now - last) / 1000); last = now; T += dt;
  step(dt, now); draw(T);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
