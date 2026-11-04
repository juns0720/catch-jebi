// 게임 엔진: 상태 머신, 입력, 이벤트. 그리기는 render.ts, 물리는 birds.ts, 흔들림/히트스톱은 juice.ts.
import type { GameEvent, GameHandle, GameOptions, RunResult, Stamp, TapLog, TapResult } from '@/types';
import { winPersonality } from '@/game/levels';
import {
  buildWires, dash, feathersAt, flyCount, hitTest, isActive, makeBird, nerves, rndSecure, scatter, slotPos,
  stepExit, stepFlyer, stepToWire,
} from '@/game/birds';
import type { Bird, World } from '@/game/birds';
import { createJuice } from '@/game/juice';
import { drawWorld, readColors } from '@/game/render';

/** 꽝 쪽지 펼침 시간(ms). 이 동안 클릭은 blocked */
export const REVEAL_MS = 1000;
/** 펼침이 끝난 뒤 전선에 앉기까지 비행 시간(ms). 착지 효과음 타이밍 계산용 */
export const WIRE_FLIGHT_MS = 900;

const FAIL_MS = 1200;
const SWAP_WARN = 1, SWAP_CROSS = 0.4;   // 초
const TAUNTS: Record<number, string> = { 3: '손이 느리시네요', 7: '놀부 손', 15: '제비가 당신을 기억합니다', 30: '제비들이 단체로 비웃는 중' };
const DODGE_LINES = ['휙!', '어림없지', '놓쳤다!'];

type Phase = 'idle' | 'run' | 'winStop' | 'failing' | 'ended' | 'quit';
interface Swap { a: Bird; b: Bird; phase: 'warn' | 'cross'; t0: number; ax: number; ay: number; bx: number; by: number }

export function createGame(opts: GameOptions): GameHandle {
  const { canvas, level, onEvent } = opts;
  const reduced = !!opts.reducedMotion;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없어요');
  const juice = createJuice(reduced);
  let C = readColors(level.winHint);

  const w: World = {
    W: 1, H: 1, DPR: 1, S: 1, T: 0,
    birds: [], feathers: [], ripples: [], popups: [], stains: [], clouds: [], stars: [],
    wires: { lines: [], sit: [], cum: [] }, wob: { amp: 0, ph: 0 },
    ptr: { x: -999, y: -999, vx: 0, vy: 0, t: 0, hover: false }, reveal: null, dive: null,
  };

  let phase: Phase = 'idle', destroyed = false, readySent = false, lastSent = false;
  let t0 = 0, startedAt = 0, finalElapsed = 0, nextTick = 100;
  let blanks = 0, misses = 0, streak = 0, taps = 0;
  const tapLog: TapLog = [];
  let blockedUntil = 0, revealBird: Bird | null = null, wireCount = 0;
  let winAt = 0, winX = 0, winY = 0, failT0 = 0;
  let swap: Swap | null = null, nextSwapT = Infinity;
  let raf = 0, last = performance.now();

  const emit = (e: GameEvent) => { if (!destroyed) onEvent(e); };
  const elapsedAt = (now: number) => phase === 'idle' ? 0 : phase === 'run' ? now - t0 : finalElapsed;
  const log = (now: number, x: number, y: number, r: TapResult) => tapLog.push([Math.round(elapsedAt(now)), Math.round(x), Math.round(y), r]);
  const popup = (x: number, y: number, text: string, big = false) => { const life = big ? 1.5 : 0.9; w.popups.push({ x, y, text, life, max: life, big }); };
  function sendReady() { if (!readySent) { readySent = true; emit({ type: 'ready' }); } }

  const render = (now = performance.now()) => drawWorld(ctx, w, C, { now, shake: juice.offset(now), tone: juice.tone() });

  // ---- 크기 ----
  function resize() {
    const r = (canvas.parentElement ?? canvas).getBoundingClientRect();
    const oldW = w.W, oldH = w.H;
    w.DPR = Math.min(2, window.devicePixelRatio || 1);
    w.W = Math.max(1, r.width); w.H = Math.max(1, r.height);
    canvas.width = Math.round(w.W * w.DPR); canvas.height = Math.round(w.H * w.DPR);
    w.S = Math.max(0.85, Math.min(1.25, w.W / 820));
    w.wires = buildWires(w.W, w.H);
    if (!w.clouds.length || oldW <= 1) {
      w.clouds = [];
      for (let i = 0; i < 5; i++) w.clouds.push({ x: Math.random() * w.W, y: w.H * (0.1 + Math.random() * 0.45), s: 0.6 + Math.random() * 0.9, v: 6 + Math.random() * 10 });
    } else {
      const fx = w.W / oldW, fy = w.H / oldH;
      for (const b of w.birds) if (b.state !== 'wire') { b.x *= fx; b.y *= fy; }
      for (const s of w.stains) { s.x *= fx; s.y *= fy; }
      for (const c of w.clouds) c.y *= fy;
      if (w.reveal) { w.reveal.x *= fx; w.reveal.y *= fy; }
      if (w.dive) { w.dive.tx *= fx; w.dive.ty *= fy; w.dive.sx *= fx; w.dive.sy *= fy; }
    }
    if (!w.stars.length) for (let i = 0; i < 60; i++) w.stars.push({ x: Math.random(), y: Math.random() * 0.6, r: Math.random() * 1.2 + 0.3 });
    render();
  }

  // ---- 흐름 ----
  function release() {   // 쪽지 펼침 끝: 제비가 전선으로
    const b = revealBird;
    w.reveal = null; revealBird = null;
    if (!b || b.state !== 'caught') return;
    b.state = 'toWire'; b.slot = wireCount++; b.fx = b.x; b.fy = b.y; b.ft = 0;
  }

  function finish(cleared: boolean, timeMs: number) {
    phase = 'ended';
    const acc = taps > 0 ? (blanks + (cleared ? 1 : 0)) / taps : 0;
    const stamps: Stamp[] = [];
    if (cleared) stamps.push('win');
    if (taps > 0 && acc < 0.5) stamps.push('poop');
    if (misses >= 15) stamps.push('nolbu');
    if (cleared && blanks === 0) stamps.push('heungbu');
    if (!cleared) stamps.push('gangnam');
    if (cleared && level.parMs - timeMs <= 1000) stamps.push('close');
    const result: RunResult = { level: level.level, cleared, timeMs, parMs: level.parMs, blanks, misses, taps, accuracy: acc, stamps, tapLog, startedAt };
    emit({ type: 'end', result });
  }

  function failRun(now: number) {
    phase = 'failing'; failT0 = now; finalElapsed = level.parMs;
    juice.setTone(-1);
    w.reveal = null; revealBird = null; w.dive = null; swap = null;
    for (const b of w.birds) {
      if (b.delay > 0) { b.dead = true; continue; }
      b.steer = null; b.state = 'exit'; b.rise = 0;
      b.vx = (b.x < w.W / 2 ? -1 : 1) * (380 + Math.random() * 200) * w.S; b.vy *= 0.2;
    }
    emit({ type: 'fail' });
  }

  function timers(now: number) {
    if (phase !== 'run') return;
    const el = now - t0;
    if (el >= nextTick) {
      emit({ type: 'tick', elapsedMs: el, remainingMs: Math.max(0, level.parMs - el) });
      nextTick = (Math.floor(el / 100) + 1) * 100;
    }
    if (!lastSent && el >= level.parMs - 5000) { lastSent = true; emit({ type: 'lastSeconds' }); }
    if (el >= level.parMs) failRun(now);
  }

  // ---- 잡기 / 헛손질 ----
  function winCatch(b: Bird, now: number) {
    taps++; log(now, b.x, b.y, 'win');
    finalElapsed = now - t0; winX = b.x; winY = b.y;
    phase = 'winStop'; winAt = now + (reduced ? 0 : 150);
    juice.hitstop(150, now); juice.setTone(1);
    feathersAt(w, b.x, b.y, 12); w.ripples.push({ x: b.x, y: b.y, life: 0.5, seal: true });
    w.reveal = null; revealBird = null; w.dive = null; swap = null;
    for (const o of w.birds) o.steer = null;
    b.state = 'exit'; b.vx = (b.x < w.W / 2 ? -1 : 1) * (160 + Math.random() * 80); b.vy = -200; b.rise = 380;
    render(now);
  }

  function blankCatch(b: Bird, now: number) {
    taps++; blanks++; streak = 0; log(now, b.x, b.y, 'blank');
    const hs = reduced ? 0 : 60;
    juice.hitstop(60, now);
    feathersAt(w, b.x, b.y, 6); w.ripples.push({ x: b.x, y: b.y, life: 0.5, seal: true });
    b.state = 'caught'; revealBird = b; blockedUntil = now + hs + REVEAL_MS;
    const pw = 128 * w.S, ph = 84 * w.S;
    w.reveal = {
      x: Math.max(pw / 2 + 8, Math.min(w.W - pw / 2 - 8, b.x)),
      y: Math.max(ph / 2 + 8, Math.min(w.H - ph / 2 - 8, b.y > 150 * w.S ? b.y - 74 * w.S : b.y + 74 * w.S)),
      t0: now + hs, dur: REVEAL_MS,
    };
    emit({ type: 'catchBlank', x: b.x, y: b.y, blanks });
    render(now);
  }

  function startPoop(x: number, y: number) {
    if (w.dive || w.stains.length >= 3) return;
    let best: Bird | null = null, bd = Infinity;
    for (const b of w.birds) {
      if (b.isWin || !isActive(b) || (swap && (b === swap.a || b === swap.b))) continue;
      const d = Math.hypot(b.x - x, b.y - y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) return;
    best.state = 'dive'; best.steer = null;
    w.dive = { bird: best, t: 0, sx: best.x, sy: best.y, tx: x, ty: y, base: best.scale };
  }

  function miss(now: number, x: number, y: number, res: 'miss' | 'dodge' | 'escape', label?: string, lx = x, ly = y) {
    taps++; misses++; streak++; log(now, x, y, res);
    w.ripples.push({ x, y, life: 0.5 });
    if (label) popup(lx, ly - 18, label);
    juice.shake(Math.min(6, 2 + (streak - 1) * 0.5), now);
    emit({ type: 'miss', x, y, kind: res === 'miss' ? 'empty' : res, streak, total: misses });
    const t = TAUNTS[misses];
    if (t) { popup(w.W / 2, w.H * 0.36, t, true); emit({ type: 'taunt', text: t, total: misses }); }
    if (streak % level.poopAfter === 0) startPoop(x, y);
  }

  function tryCatch(b: Bird, x: number, y: number, now: number) {
    const nv = nerves(w, level.birds, level.blank.escape > 0);
    if (Math.random() < Math.min(0.85, b.p.dodge * nv)) {
      dash(w, b, x, y, 1.15); scatter(w, x, y, 160);
      miss(now, x, y, 'dodge', DODGE_LINES[Math.floor(Math.random() * 3)], b.x, b.y);
      return;
    }
    if (Math.random() < b.p.escape * nv) {
      feathersAt(w, b.x, b.y, 3, 1.4);
      dash(w, b, x, y, 1.2); scatter(w, x, y, 220);
      miss(now, x, y, 'escape', '푸드덕! 빠져나갔다', b.x, b.y);
      return;
    }
    if (b.isWin) winCatch(b, now); else blankCatch(b, now);
  }

  // ---- 입력 ----
  function localPoint(e: PointerEvent): [number, number] {
    const r = canvas.getBoundingClientRect();
    return [(e.clientX - r.left) * (w.W / (r.width || 1)), (e.clientY - r.top) * (w.H / (r.height || 1))];
  }
  function onMove(e: PointerEvent) {
    const [x, y] = localPoint(e), p = w.ptr, now = performance.now(), dtm = Math.max(8, now - p.t);
    if (p.t && now - p.t < 120) {
      p.vx = p.vx * 0.6 + ((x - p.x) / dtm * 1000) * 0.4;
      p.vy = p.vy * 0.6 + ((y - p.y) / dtm * 1000) * 0.4;
    } else { p.vx = 0; p.vy = 0; }
    p.x = x; p.y = y; p.t = now; p.hover = true;
  }
  function onLeave() { w.ptr.hover = false; w.ptr.vx = w.ptr.vy = 0; }
  function onDown(e: PointerEvent) {
    if (e.button !== 0 || phase !== 'run') return;
    const [x, y] = localPoint(e), now = performance.now();
    w.ptr.x = x; w.ptr.y = y;
    if (now < blockedUntil) { log(now, x, y, 'blocked'); return; }
    const st = w.stains.find(s => Math.hypot(s.x - x, s.y - y) < s.r);
    if (st) {   // 얼룩 닦기: 헛손질 아님
      st.wipes++;
      const done = st.wipes >= 3;
      if (done) w.stains.splice(w.stains.indexOf(st), 1);
      w.ripples.push({ x, y, life: 0.5 });
      log(now, x, y, 'wipe'); emit({ type: 'wipe', x, y, done });
      return;
    }
    const b = hitTest(w, x, y);
    if (b) tryCatch(b, x, y, now);
    else { miss(now, x, y, 'miss'); scatter(w, x, y, 200); }
  }

  // ---- 쪽지 바꿔치기 ----
  function swapStep() {
    if (phase !== 'run') return;
    if (!swap) {
      if (w.T < nextSwapT) return;
      const a = w.birds.find(b => b.isWin && isActive(b));
      let c: Bird | null = null, bd = Infinity;
      if (a) for (const o of w.birds) {
        if (o.isWin || !isActive(o)) continue;
        const d = Math.hypot(o.x - a.x, o.y - a.y);
        if (d < bd) { bd = d; c = o; }
      }
      if (!a || !c) { nextSwapT = w.T + 1; return; }
      a.steer = c; c.steer = a;
      swap = { a, b: c, phase: 'warn', t0: w.T, ax: 0, ay: 0, bx: 0, by: 0 };
      nextSwapT = w.T + (level.swapEveryMs ?? 0) / 1000;
      emit({ type: 'swap', phase: 'warn' });
      return;
    }
    const s = swap;
    if (s.phase === 'warn') {
      if (s.a.state !== 'fly' || s.b.state !== 'fly') { s.a.steer = s.b.steer = null; swap = null; return; }
      if (w.T - s.t0 < SWAP_WARN) return;
      s.phase = 'cross'; s.t0 = w.T; s.ax = s.a.x; s.ay = s.a.y; s.bx = s.b.x; s.by = s.b.y;
      s.a.steer = s.b.steer = null; s.a.state = s.b.state = 'cross';
      emit({ type: 'swap', phase: 'cross' });
      return;
    }
    const u = Math.min(1, (w.T - s.t0) / SWAP_CROSS), e = u * u * (3 - 2 * u);
    const dx = s.bx - s.ax, dy = s.by - s.ay, len = Math.hypot(dx, dy) || 1;
    const off = Math.sin(Math.PI * e) * 6 * w.S, nx = -dy / len * off, ny = dx / len * off;
    s.a.x = s.ax + dx * e + nx; s.a.y = s.ay + dy * e + ny;
    s.b.x = s.bx - dx * e - nx; s.b.y = s.by - dy * e - ny;
    s.a.vx = dx / SWAP_CROSS; s.a.vy = dy / SWAP_CROSS; s.b.vx = -s.a.vx; s.b.vy = -s.a.vy;
    if (u < 1) return;
    const { a, b } = s;   // 교차 끝: 당첨 쪽지 교환
    [a.isWin, b.isWin] = [b.isWin, a.isWin]; [a.p, b.p] = [b.p, a.p];
    const k = reduced ? 0.6 : 1, sa = a.p.cruise * k * w.S * 1.3, sb = b.p.cruise * k * w.S * 1.3;
    a.vx = dx / len * sa; a.vy = dy / len * sa; b.vx = -dx / len * sb; b.vy = -dy / len * sb;
    a.state = b.state = 'fly'; a.excite = b.excite = 1; a.entered = b.entered = true;
    swap = null;
    emit({ type: 'swap', phase: 'done' });
  }

  // ---- 갱신 ----
  function diveStep(dt: number) {
    const d = w.dive; if (!d) return;
    const b = d.bird;
    d.t += dt / 0.5;
    const u = Math.min(1, d.t), e = u * u;
    b.x = d.sx + (d.tx - d.sx) * e; b.y = d.sy + (d.ty - d.sy) * e;
    b.vx = d.tx - d.sx; b.vy = d.ty - d.sy; b.scale = d.base * (1 + 0.5 * u); b.phase += dt * 30;
    if (u < 1) return;
    w.dive = null;
    b.scale = d.base; b.state = 'fly'; b.excite = 1;
    b.vx = (d.tx > w.W / 2 ? -1 : 1) * 200 * w.S; b.vy = -260 * w.S;
    w.stains.push({ x: d.tx, y: d.ty, r: 60, wipes: 0, born: w.T, shape: Array.from({ length: 9 }, () => 0.78 + Math.random() * 0.3) });
    w.ripples.push({ x: d.tx, y: d.ty, life: 0.5 });
    juice.shake(4, performance.now());
    emit({ type: 'poop', x: d.tx, y: d.ty });
  }

  function update(dt: number, now: number) {
    w.T += dt;
    juice.update(dt);
    w.wob.amp *= Math.exp(-2.5 * dt); w.wob.ph += dt * 16;
    for (const c of w.clouds) { c.x += c.v * dt; if (c.x - c.s * 70 > w.W) c.x = -c.s * 70; }
    if (w.reveal && now >= blockedUntil) release();
    if (level.swapEveryMs) swapStep();
    diveStep(dt);
    const k = reduced ? 0.6 : 1, nv = nerves(w, level.birds, level.blank.escape > 0);
    const flap = phase === 'run' && level.parMs - (now - t0) <= 5000 ? 1.25 : 1;
    for (const b of w.birds) {
      if (b.state === 'fly') {
        if (b.delay > 0) { b.delay -= dt; continue; }
        stepFlyer(w, b, dt, now, k, nv, flap);
      } else if (b.state === 'toWire') {
        if (stepToWire(w, b, dt, WIRE_FLIGHT_MS / 1000)) { b.state = 'wire'; w.wob.amp = Math.min(9 * w.S, w.wob.amp + 6 * w.S); }
      } else if (b.state === 'wire') {
        [b.x, b.y] = slotPos(w, b.slot);
      } else if (b.state === 'exit') stepExit(w, b, dt);
      else if (b.state === 'caught') b.phase += dt * 40;
    }
    if (w.birds.some(b => b.dead)) w.birds = w.birds.filter(b => !b.dead);
    for (const p of w.popups) { p.y -= 30 * dt; p.life -= dt; }
    w.popups = w.popups.filter(p => p.life > 0);
    for (const f of w.feathers) { f.vy += 50 * dt; f.vx *= 1 - 1.5 * dt; f.x += (f.vx + Math.sin(f.rot * 2) * 18) * dt; f.y += Math.min(f.vy, 60) * dt; f.rot += f.vr * dt; f.life -= dt; }
    w.feathers = w.feathers.filter(f => f.life > 0);
    for (const r of w.ripples) r.life -= dt;
    w.ripples = w.ripples.filter(r => r.life > 0);
    w.stains = w.stains.filter(s => w.T - s.born < 21);
  }

  function frame(now: number) {
    if (destroyed) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    sendReady();
    timers(now);
    if (phase === 'failing' && now - failT0 >= FAIL_MS) finish(false, level.parMs);
    if (phase === 'winStop' && now >= winAt) { emit({ type: 'catchWin', x: winX, y: winY }); finish(true, Math.round(finalElapsed)); }
    if (juice.frozen(now)) return;   // 히트스톱: 렌더 정지
    update(dt, now);
    render(now);
  }

  // ---- 설치 ----
  const ro = new ResizeObserver(resize);
  ro.observe(canvas.parentElement ?? canvas);
  canvas.style.display = 'block'; canvas.style.width = '100%'; canvas.style.height = '100%'; canvas.style.touchAction = 'none';
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerleave', onLeave);
  canvas.addEventListener('pointerdown', onDown);
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const readTokens = () => { C = readColors(level.winHint); };
  mq.addEventListener('change', readTokens);
  const mo = new MutationObserver(readTokens);
  mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  resize();
  raf = requestAnimationFrame(frame);

  return {
    start() {
      if (phase !== 'idle' || destroyed) return;
      readTokens(); sendReady();
      const now = performance.now();
      phase = 'run'; t0 = now; startedAt = Date.now(); nextTick = 100;
      w.T = 0; nextSwapT = level.swapEveryMs ? level.swapEveryMs / 1000 : Infinity;
      const winIdx = Math.floor(rndSecure() * level.birds), win = winPersonality(level);
      w.birds = Array.from({ length: level.birds }, (_, i) => makeBird(i, i === winIdx, i === winIdx ? win : level.blank, w, level.birds));
      emit({ type: 'start' });
    },
    quit() {
      if (phase === 'ended' || phase === 'quit') return;
      phase = 'quit'; swap = null; w.dive = null;
      cancelAnimationFrame(raf);
    },
    destroy() {
      destroyed = true; cancelAnimationFrame(raf);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerleave', onLeave);
      canvas.removeEventListener('pointerdown', onDown);
      ro.disconnect(); mo.disconnect(); mq.removeEventListener('change', readTokens);
    },
    isRunning: () => phase === 'run' || phase === 'winStop' || phase === 'failing',
    state() {
      const el = elapsedAt(performance.now());
      return { elapsedMs: el, remainingMs: Math.max(0, level.parMs - el), blanks, misses, streak, flying: flyCount(w) };
    },
  };
}
