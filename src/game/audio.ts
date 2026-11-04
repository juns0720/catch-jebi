import type { AudioBus, Sfx } from '@/types';

type Wave = OscillatorType;
interface ToneOpts { type?: Wave; gain?: number; to?: number; at?: number }
interface NoiseOpts { gain?: number; f0: number; f1?: number; type?: BiquadFilterType; at?: number; q?: number }

export function createAudio(): AudioBus {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let isMuted = false;

  function ensure(): AudioContext | null {
    if (ctx) return ctx;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.25;
    master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return ctx;
  }

  function env(g: GainNode, t: number, dur: number, peak: number) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  }

  function tone(freq: number, dur: number, o: ToneOpts = {}) {
    const c = ctx!, t = c.currentTime + (o.at ?? 0);
    const osc = c.createOscillator(), g = c.createGain();
    osc.type = o.type ?? 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + dur);
    env(g, t, dur, o.gain ?? 0.5);
    osc.connect(g).connect(master!);
    osc.start(t); osc.stop(t + dur + 0.02);
  }

  function noise(dur: number, o: NoiseOpts) {
    const c = ctx!, t = c.currentTime + (o.at ?? 0);
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
    src.buffer = noiseBuf;
    f.type = o.type ?? 'bandpass';
    f.Q.value = o.q ?? 1;
    f.frequency.setValueAtTime(o.f0, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + dur);
    env(g, t, dur, o.gain ?? 0.5);
    src.connect(f).connect(g).connect(master!);
    src.start(t, Math.random() * 0.5, dur + 0.02);
  }

  const seq = (notes: number[], step: number, dur: number, o: ToneOpts = {}) =>
    notes.forEach((n, i) => tone(n, dur, { ...o, at: i * step }));

  const sfx: Record<Sfx, () => void> = {
    catch: () => { tone(520, 0.08, { type: 'square', to: 260, gain: 0.4 }); noise(0.03, { f0: 2000, gain: 0.3 }); },
    blank: () => seq([660, 494, 392], 0.11, 0.14, { type: 'triangle' }),
    win: () => seq([660, 990], 0.1, 0.22),
    miss: () => noise(0.18, { f0: 600, f1: 2400, gain: 0.45, q: 2 }),
    dodge: () => tone(1400, 0.07, { type: 'square', to: 1900, gain: 0.3 }),
    escape: () => { noise(0.09, { f0: 1800, gain: 0.5, q: 0.7 }); noise(0.09, { f0: 2200, gain: 0.5, q: 0.7, at: 0.12 }); },
    poop: () => { noise(0.22, { f0: 500, f1: 120, type: 'lowpass', gain: 0.8 }); tone(90, 0.15, { to: 45, gain: 0.8 }); },
    wipe: () => [0, 0.09, 0.18].forEach(at => noise(0.07, { f0: 2500, gain: 0.3, at, q: 0.8 })),
    fail: () => seq([392, 330, 262, 196], 0.2, 0.24, { type: 'sawtooth', gain: 0.3 }),
    heartbeat: () => { tone(60, 0.13, { gain: 0.9 }); tone(55, 0.15, { gain: 0.7, at: 0.16 }); },
    taunt: () => seq([220, 165], 0.2, 0.22, { type: 'triangle' }),
    swapWarn: () => seq([1000, 1000], 0.12, 0.05, { type: 'square', gain: 0.3 }),
    swap: () => { tone(400, 0.25, { to: 900, gain: 0.35 }); tone(900, 0.25, { to: 400, gain: 0.35 }); },
    fanfare: () => { seq([523, 659, 784, 1046], 0.09, 0.18, { type: 'triangle' }); tone(1318, 0.45, { type: 'triangle', at: 0.36 }); },
    wire: () => { tone(1568, 0.5, { gain: 0.4 }); tone(1568 * 2.76, 0.25, { gain: 0.15 }); },
  };

  return {
    play(s) {
      if (isMuted || !ctx || ctx.state !== 'running') return;
      sfx[s]();
    },
    setMuted(m) { isMuted = m; },
    muted: () => isMuted,
    resume() {
      const c = ensure();
      if (c && c.state === 'suspended') void c.resume();
    },
  };
}
