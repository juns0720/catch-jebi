// 모든 모듈이 공유하는 타입. 이 파일은 계약이다. 바꾸려면 통합 담당과 상의.

export type Tier = 'chick' | 'town' | 'gangnam' | 'heungbu' | 'gourd';

export interface TierInfo { id: Tier; name: string; levels: [number, number]; }
export const TIERS: TierInfo[] = [
  { id: 'chick',   name: '새끼제비',    levels: [1, 3] },
  { id: 'town',    name: '동네제비',    levels: [4, 6] },
  { id: 'gangnam', name: '강남제비',    levels: [7, 9] },
  { id: 'heungbu', name: '흥부네 제비', levels: [10, 12] },
  { id: 'gourd',   name: '박씨 제비',   levels: [13, 15] },
];
export function tierOfLevel(level: number): TierInfo {
  return TIERS.find(t => level >= t.levels[0] && level <= t.levels[1]) ?? TIERS[0];
}

/** 제비 한 마리의 성격. 원본 아티팩트 MODES와 같은 의미. 속도 단위는 px/s (S 스케일 전). */
export interface Personality {
  cruise: number; max: number; fleeR: number; flee: number; hitR: number;
  dodge: number; escape: number; predict: number;
}

export interface LevelDef {
  level: number;
  birds: number;              // 날아다니는 제비 수 (당첨 1 포함)
  blank: Personality;         // 꽝 제비 성격
  winSpeed: number;           // 당첨 제비 cruise/max 배율
  winNerve: number;           // 당첨 제비 fleeR 배율
  winDodge: number;           // 당첨 제비 dodge 가산
  winHint: number;            // 0~1. 당첨 쪽지 금색 혼합 비율
  parMs: number;              // 기준 시간. 넘기면 실패
  swapEveryMs: number | null; // 쪽지 바꿔치기 주기. null이면 없음
  poopAfter: number;          // 연속 헛손질 n회면 제비똥
}

export type Stamp = 'win' | 'record' | 'poop' | 'nolbu' | 'heungbu' | 'gangnam' | 'close';
export const STAMP_LABEL: Record<Stamp, string> = {
  win: '당첨', record: '신기록', poop: '똥손', nolbu: '놀부', heungbu: '흥부', gangnam: '강남행', close: '간발',
};

/** [경과ms, x, y, 결과] */
export type TapResult = 'win' | 'blank' | 'miss' | 'dodge' | 'escape' | 'wipe' | 'blocked';
export type TapLog = Array<[number, number, number, TapResult]>;

export interface RunResult {
  level: number;
  cleared: boolean;
  timeMs: number;      // 클리어면 당첨까지, 실패면 parMs
  parMs: number;
  blanks: number;      // 꽝 잡은 수
  misses: number;      // 헛손질 (빈 곳 + 회피 + 탈출)
  taps: number;        // 집계 대상 클릭 수 (wipe/blocked 제외)
  accuracy: number;    // 0~1. (blanks + (cleared ? 1 : 0)) / taps
  stamps: Stamp[];     // 'record'는 엔진이 아니라 통합 쪽에서 붙인다
  tapLog: TapLog;
  startedAt: number;   // Date.now()
}

export type GameEvent =
  | { type: 'ready' }
  | { type: 'start' }
  | { type: 'tick'; elapsedMs: number; remainingMs: number }
  | { type: 'catchBlank'; x: number; y: number; blanks: number }
  | { type: 'catchWin'; x: number; y: number }
  | { type: 'miss'; x: number; y: number; kind: 'empty' | 'dodge' | 'escape'; streak: number; total: number }
  | { type: 'taunt'; text: string; total: number }
  | { type: 'poop'; x: number; y: number }
  | { type: 'wipe'; x: number; y: number; done: boolean }
  | { type: 'swap'; phase: 'warn' | 'cross' | 'done' }
  | { type: 'lastSeconds' }   // 남은 5초 진입
  | { type: 'fail' }
  | { type: 'end'; result: RunResult };

export interface GameOptions {
  canvas: HTMLCanvasElement;
  level: LevelDef;
  onEvent: (e: GameEvent) => void;
  reducedMotion?: boolean;
  ghostMs?: number | null;   // 도전장 친구 기록. HUD가 쓰고 엔진은 보관만
}

export interface GameHandle {
  start(): void;         // 타이머 시작 + 제비 진입
  quit(): void;          // 포기. end 이벤트 없이 정리
  destroy(): void;
  isRunning(): boolean;
  /** 외부에서 읽을 수 있는 상태 */
  state(): { elapsedMs: number; remainingMs: number; blanks: number; misses: number; streak: number; flying: number };
}

export type Sfx =
  | 'catch' | 'blank' | 'win' | 'miss' | 'dodge' | 'escape'
  | 'poop' | 'wipe' | 'fail' | 'heartbeat' | 'taunt' | 'swapWarn' | 'swap' | 'fanfare' | 'wire';
export interface AudioBus {
  play(s: Sfx): void;
  setMuted(m: boolean): void;
  muted(): boolean;
  resume(): void;   // 첫 사용자 제스처에서 호출
}

export const TAUNTS: string[] = [
  '너 똥손이지?',
  '놀부 손 예상',
  '{t}초 못 깨면 밥 사기',
  '제비가 너를 기다린다',
  '이거 못 깨면 우리 절교',
];

export interface ChallengeParams {
  l: number;        // 레벨
  t: number;        // 기록 ms
  n: string;        // 닉네임. 없으면 '친구'
  m: number;        // TAUNTS 인덱스. -1이면 mx 사용
  mx?: string;      // 직접 입력 도발 (20자)
  r?: number;       // 명중률 %
}

export interface LeaderboardRow {
  id: string;
  nickname: string | null;
  level: number;
  time_ms: number;
  blanks: number;
  misses: number;
  created_at: string;
}
export interface HallOfFameRow { nickname: string; created_at: string; first: boolean; }

export interface Progress {
  deviceId: string;
  unlocked: number;                 // 해제된 최고 레벨 (1~15)
  best: Record<number, number>;     // level -> best ms
  nickname: string | null;
  muted: boolean;
  plays: number;
}

export type AnalyticsEvent =
  | 'landing_view' | 'lottery_done' | 'challenge_enter' | 'run_start' | 'run_end' | 'run_quit'
  | 'result_view' | 'share_click' | 'challenge_open' | 'challenge_complete' | 'challenge_resend'
  | 'mobile_gate_view' | 'mobile_send_to_me' | 'nickname_submit' | 'login_click';
