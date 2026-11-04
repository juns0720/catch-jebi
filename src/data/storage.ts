// localStorage 진행도. 키 prefix 'ctj:'. 저장소를 못 쓰는 환경(시크릿 모드 등)에서는 메모리로 버틴다.
import type { Progress, RunResult } from '@/types';
import { MAX_LEVEL } from '@/game/levels';

const KEY = 'ctj:progress';
let memory: Progress | null = null;

function newDeviceId(): string {
  try {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  } catch { /* 폴백 */ }
  const b = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(b);
  else for (let i = 0; i < b.length; i++) b[i] = Math.floor(Math.random() * 256);
  return Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
}

function fresh(): Progress {
  return { deviceId: newDeviceId(), unlocked: 1, best: {}, nickname: null, muted: false, plays: 0 };
}

function normalize(raw: unknown): Progress | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.deviceId !== 'string' || !o.deviceId) return null;
  const unlocked = typeof o.unlocked === 'number' && Number.isFinite(o.unlocked)
    ? Math.min(MAX_LEVEL, Math.max(1, Math.floor(o.unlocked))) : 1;
  const best: Record<number, number> = {};
  if (o.best && typeof o.best === 'object') {
    for (const [k, v] of Object.entries(o.best as Record<string, unknown>)) {
      const lv = Number(k);
      if (Number.isInteger(lv) && lv >= 1 && lv <= MAX_LEVEL && typeof v === 'number' && v > 0) best[lv] = v;
    }
  }
  return {
    deviceId: o.deviceId,
    unlocked,
    best,
    nickname: typeof o.nickname === 'string' && o.nickname ? o.nickname : null,
    muted: o.muted === true,
    plays: typeof o.plays === 'number' && o.plays > 0 ? Math.floor(o.plays) : 0,
  };
}

/** 없으면 생성 (deviceId = crypto.randomUUID()) */
export function loadProgress(): Progress {
  let raw: string | null = null;
  try { raw = localStorage.getItem(KEY); } catch { /* 저장소 사용 불가 */ }
  let p: Progress | null = null;
  if (raw) {
    try { p = normalize(JSON.parse(raw)); } catch { p = null; }
  }
  if (!p) {
    p = memory ?? fresh();
    saveProgress(p);
  }
  memory = p;
  return p;
}

export function saveProgress(p: Progress): void {
  memory = p;
  try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 가득 참/차단: 메모리만 */ }
}

/**
 * 한 판의 결과를 진행도에 반영한다. 포기한 판은 호출하지 않는다.
 * - isRecord: 클리어했고 이 레벨 최고 기록을 갱신 (첫 클리어도 신기록)
 * - unlockedNow: 이번 판으로 새로 해제된 레벨 (없으면 null)
 */
export function recordRun(r: RunResult): { progress: Progress; isRecord: boolean; unlockedNow: number | null } {
  const p = loadProgress();
  p.plays += 1;
  let isRecord = false;
  let unlockedNow: number | null = null;
  if (r.cleared) {
    const prev = p.best[r.level];
    if (prev === undefined || r.timeMs < prev) {
      p.best[r.level] = r.timeMs;
      isRecord = true;
    }
    const next = r.level + 1;
    if (next <= MAX_LEVEL && next > p.unlocked) {
      p.unlocked = next;
      unlockedNow = next;
    }
  }
  saveProgress(p);
  return { progress: p, isRecord, unlockedNow };
}
