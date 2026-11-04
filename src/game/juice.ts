// 손맛 연출: 화면 흔들림, 히트스톱, 하늘 톤. DOM은 건드리지 않는다 (캔버스 translate로만 쓴다).

export interface Juice {
  /** 흔들림 시작. amp는 px, 0.15초 동안 감쇠 */
  shake(amp: number, now: number): void;
  /** 렌더 정지 */
  hitstop(ms: number, now: number): void;
  frozen(now: number): boolean;
  /** 이번 프레임의 캔버스 이동량 */
  offset(now: number): [number, number];
  /** 하늘 톤 목표: 1 밝게, -1 어둡게, 0 기본 */
  setTone(target: number): void;
  update(dt: number): void;
  tone(): number;
}

const SHAKE_MS = 150;

export function createJuice(reduced: boolean): Juice {
  let amp = 0, t0 = 0, until = 0, tone = 0, toneTarget = 0;
  return {
    shake(a, now) {
      if (reduced) return;
      if (a >= amp * Math.max(0, 1 - (now - t0) / SHAKE_MS)) { amp = a; t0 = now; }
    },
    hitstop(ms, now) {
      if (reduced) return;
      until = Math.max(until, now + ms);
    },
    frozen(now) { return now < until; },
    offset(now) {
      const k = 1 - (now - t0) / SHAKE_MS;
      if (reduced || k <= 0 || amp <= 0) return [0, 0];
      return [(Math.random() * 2 - 1) * amp * k, (Math.random() * 2 - 1) * amp * k];
    },
    setTone(t) { toneTarget = t; },
    update(dt) { tone += (toneTarget - tone) * Math.min(1, dt * 2.5); },
    tone() { return tone; },
  };
}
