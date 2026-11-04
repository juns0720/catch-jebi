// 챌린지 컨트롤러: home → play → (결과 쪽지) → home/play. INTERFACES.md D절 참고.
import '@/styles/tokens.css';
import './challenge.css';
import type { ChallengeParams, GameEvent, GameHandle, Progress, RunResult } from '@/types';
import { MAX_LEVEL, getLevel } from '@/game/levels';
import { createGame } from '@/game/engine';
import { createAudio } from '@/game/audio';
import { loadProgress, recordRun, saveProgress } from '@/data/storage';
import { getSessionNickname, setNickname, signInWithKakao, signOut, submitRun } from '@/data/supabase';
import { initAnalytics, track } from '@/data/analytics';
import { buildChallengeUrl, buildOgUrl, copyText, getSiteUrl, initKakao, parseChallengeParams, shareKakao, tauntText } from '@/ui/share';
import { showResultSlip } from '@/ui/slip';
import type { SlipHandle } from '@/ui/slip';
import { downloadBlob, renderResultImage } from '@/ui/shareImage';
import { createHome } from './home';
import type { Home, HomeTab } from './home';
import { createHud } from './hud';
import type { Hud } from './hud';
import { playEnding } from './ending';
import { invalidateHall } from './rank';
import { pickChallengeTaunt } from './sharemodal';
import type { TauntChoice } from './sharemodal';
import { fmtSec, h, playerTier, toast } from './ui';

type SubmitResult = Awaited<ReturnType<typeof submitRun>>;

const isPc = matchMedia('(pointer: fine)').matches && innerWidth >= 900;
if (!isPc) {
  location.replace('/m/' + location.search);
} else {
  boot();
}

function boot(): void {
  initAnalytics();
  initKakao((import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ?? '');

  const canvas = document.getElementById('sky') as HTMLCanvasElement;
  const app = document.getElementById('app') as HTMLElement;
  const siteUrl = getSiteUrl();
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  let progress: Progress = loadProgress();
  let sessionNick: string | null = null;
  const audio = createAudio();
  audio.setMuted(progress.muted);

  let game: GameHandle | null = null;
  let hud: Hud | null = null;
  let slip: SlipHandle | null = null;
  let intro: HTMLElement | null = null;
  let gen = 0; // 판이 바뀔 때마다 증가. 지연 호출(setTimeout)이 옛 판에서 울리지 않게 한다
  let heartbeat = 0;
  let challenge: ChallengeParams | null = parseChallengeParams(location.search);
  let challengeReported = false;
  let lastTaunt: TauntChoice = { m: 0 };
  let hudLevel = 1; // 지금 판(또는 마지막으로 시작한 판)의 레벨

  const myName = (): string | null => progress.nickname ?? sessionNick;

  /* ---------- 음소거 / 오디오 ---------- */
  function toggleMute(): void {
    progress = { ...progress, muted: !progress.muted };
    saveProgress(progress);
    audio.setMuted(progress.muted);
    hud?.setMuted(progress.muted);
    home.setMuted(progress.muted);
  }
  window.addEventListener('pointerdown', () => audio.resume(), { once: true, capture: true });

  function later(ms: number, fn: () => void): void {
    const g = gen;
    window.setTimeout(() => { if (g === gen) fn(); }, ms);
  }
  function stopHeartbeat(): void {
    if (heartbeat) { window.clearInterval(heartbeat); heartbeat = 0; }
  }
  function startHeartbeat(): void {
    stopHeartbeat();
    audio.play('heartbeat');
    heartbeat = window.setInterval(() => audio.play('heartbeat'), 1000);
  }

  /* ---------- 홈 ---------- */
  const home: Home = createHome(app, {
    getProgress: () => progress,
    onStart: (level) => { audio.resume(); startLevel(level); },
    onToggleMute: toggleMute,
    onLogin: () => { track('login_click'); void signInWithKakao(location.href); },
    onLogout: () => { void signOut().finally(() => { sessionNick = null; home.setSession(null); }); },
  });

  getSessionNickname().then((n) => { sessionNick = n; home.setSession(n); }).catch(() => { /* 비로그인 */ });

  /* ---------- 게임 수명 ---------- */
  function destroyGame(): void {
    gen++;
    stopHeartbeat();
    intro?.remove(); intro = null;
    hud?.destroy(); hud = null;
    game?.destroy(); game = null;
  }

  function ghostFor(level: number): { name: string; ms: number } | null {
    return challenge && challenge.l === level ? { name: challenge.n, ms: challenge.t } : null;
  }

  /** 캔버스에 게임을 만든다 (제비 없이 하늘만). withHud면 HUD도 붙인다. */
  function mountGame(level: number, withHud: boolean): void {
    destroyGame();
    const def = getLevel(level);
    const ghost = ghostFor(level);
    if (withHud) {
      hud = createHud(app, {
        level: def,
        tier: playerTier(progress),
        ghost: ghost && challenge ? { ...ghost, taunt: tauntText(challenge) } : null,
        muted: progress.muted,
        onQuit: quit,
        onToggleMute: toggleMute,
      });
    }
    game = createGame({ canvas, level: def, onEvent, reducedMotion, ghostMs: ghost?.ms ?? null });
  }

  function startLevel(level: number): void {
    slip?.close(); slip = null;
    home.hide();
    hudLevel = level;
    home.select(level);
    mountGame(level, true);
    document.body.classList.add('playing');
    game!.start();
  }

  function goHome(tab: HomeTab = 'play'): void {
    slip?.close(); slip = null;
    challenge = null;
    document.body.classList.remove('playing');
    mountGame(home.selected(), false); // 하늘만 깔아 둔다
    home.refresh();
    home.show(tab);
  }

  function quit(): void {
    if (game?.isRunning()) {
      const s = game.state();
      track('run_quit', { level: hudLevel, elapsed_ms: Math.round(s.elapsedMs), misses: s.misses });
      game.quit();
    }
    goHome('play');
  }

  /* ---------- 엔진 이벤트 ---------- */
  function onEvent(e: GameEvent): void {
    switch (e.type) {
      case 'start':
        hud?.reset();
        track('run_start', { level: hudLevel });
        break;
      case 'tick':
        hud?.tick(e.elapsedMs, e.remainingMs);
        break;
      case 'catchBlank':
        hud?.setBlanks(e.blanks);
        audio.play('catch');
        later(140, () => audio.play('blank'));
        later(1000, () => audio.play('wire')); // 전선에 앉는 순간
        break;
      case 'catchWin':
        audio.play('catch');
        audio.play('win');
        break;
      case 'miss':
        hud?.setMisses(e.total);
        audio.play(e.kind === 'empty' ? 'miss' : e.kind === 'dodge' ? 'dodge' : 'escape');
        break;
      case 'taunt': audio.play('taunt'); break;
      case 'poop': audio.play('poop'); break;
      case 'wipe': audio.play('wipe'); break;
      case 'swap':
        if (e.phase === 'warn') audio.play('swapWarn');
        else if (e.phase === 'cross') audio.play('swap');
        break;
      case 'lastSeconds': startHeartbeat(); break;
      case 'fail':
        stopHeartbeat();
        audio.play('fail');
        break;
      case 'end':
        finishRun(e.result);
        break;
      default: break;
    }
  }

  /* ---------- 결과 ---------- */
  function finishRun(raw: RunResult): void {
    stopHeartbeat();
    const rec = recordRun(raw);
    progress = rec.progress;
    const result: RunResult = rec.isRecord && !raw.stamps.includes('record')
      ? { ...raw, stamps: [...raw.stamps, 'record'] } : raw;
    home.select(rec.unlockedNow ?? result.level);

    track('run_end', {
      level: result.level, time_ms: Math.round(result.timeMs), cleared: result.cleared,
      blanks: result.blanks, misses: result.misses, stamps: result.stamps.join(','),
    });
    const ghost = ghostFor(result.level);
    if (challenge && !challengeReported && challenge.l === result.level) {
      challengeReported = true;
      track('challenge_complete', { level: result.level, won: !!ghost && result.cleared && result.timeMs < ghost.ms });
    }

    const submit: Promise<SubmitResult> = submitRun(result, myName(), progress.deviceId).catch(() => ({ ok: false }));
    if (result.cleared) audio.play('fanfare');

    if (result.cleared && result.level === MAX_LEVEL) {
      invalidateHall();
      void playEnding(app, reducedMotion).then(() => presentSlip(result, rec.isRecord, submit));
    } else {
      presentSlip(result, rec.isRecord, submit);
    }
  }

  function presentSlip(result: RunResult, isRecord: boolean, submit: Promise<SubmitResult>): void {
    const tier = playerTier(progress);
    const ghost = ghostFor(result.level);
    const hasNext = result.cleared && result.level < MAX_LEVEL;
    track('result_view', { level: result.level });

    const nicknamePrompt = {
      onSubmit: async (n: string): Promise<string | null> => {
        const res = await submit;
        if (!res.ok || !res.id) return '기록이 아직 올라가지 않았어요. 잠시 후 다시 해 주세요';
        const r = await setNickname(res.id, progress.deviceId, n);
        if (!r.ok) return r.error ?? '제비가 그 이름은 못 물어가요';
        progress = { ...progress, nickname: n };
        saveProgress(progress);
        track('nickname_submit', { level: result.level });
        invalidateHall();
        return null;
      },
    };
    const loginPrompt = {
      onClick: () => { track('login_click'); void signInWithKakao(location.href); },
    };

    // 박씨 제비(레벨 15 클리어)는 이름이 명예의 전당에 올라가므로 순위와 상관없이 바로 묻는다
    const askNickNow = result.cleared && result.level === MAX_LEVEL && !myName();

    const handle = showResultSlip(app, {
      result, tier: tier.id, isRecord, bestMs: progress.best[result.level] ?? null,
      ghost, percentile: null,
      nicknamePrompt: askNickNow ? nicknamePrompt : null,
      loginPrompt: null,
      hasNext,
      actions: {
        retry: () => startLevel(result.level),
        next: () => startLevel(result.level + 1),
        shareKakao: () => { void shareFlow(result); },
        copyLink: () => { void copyChallengeLink(result); },
        saveImage: () => { void saveImage(result, tier.id, ghost); },
        openRank: () => { home.select(result.level); goHome('rank'); },
      },
    });
    slip = handle;

    // 순위는 비동기로 온다. 상위 20%면 닉네임, 상위 1%면 로그인 유도.
    void submit.then((res) => {
      if (slip !== handle || !result.cleared || !res.ok || res.percentile == null) return;
      handle.setPercentile(res.percentile);
      handle.setPrompts({
        nicknamePrompt: res.percentile >= 80 && !myName() ? nicknamePrompt : null,
        loginPrompt: res.percentile >= 99 && !sessionNick ? loginPrompt : null,
      });
    });
  }

  /* ---------- 공유 ---------- */
  function paramsFor(result: RunResult, c: TauntChoice): ChallengeParams {
    const p: ChallengeParams = {
      l: result.level, t: Math.round(result.timeMs), n: myName() ?? '친구',
      m: c.m, r: Math.round(result.accuracy * 100),
    };
    if (c.m === -1 && c.mx) p.mx = c.mx;
    return p;
  }

  function sharedOnce(channel: 'kakao' | 'link'): void {
    track('share_click', { channel });
    if (challenge) track('challenge_resend');
  }

  async function copyChallengeLink(result: RunResult, c: TauntChoice = lastTaunt): Promise<void> {
    const url = buildChallengeUrl(paramsFor(result, c), siteUrl);
    const ok = await copyText(url);
    if (ok) sharedOnce('link');
    toast(ok ? '도전장 링크를 복사했어요' : '복사하지 못했어요. 주소를 직접 선택해 주세요');
  }

  async function shareFlow(result: RunResult): Promise<void> {
    const pick = await pickChallengeTaunt(app, {
      level: result.level, timeMs: result.cleared ? result.timeMs : result.parMs, cleared: result.cleared, last: lastTaunt,
    });
    if (!pick) return;
    lastTaunt = pick.m === -1 ? { m: -1, mx: pick.mx } : { m: pick.m };
    if (pick.action === 'link') { await copyChallengeLink(result, lastTaunt); return; }
    const p = paramsFor(result, lastTaunt);
    const ok = await shareKakao(p, { siteUrl, imageUrl: buildOgUrl(p, siteUrl) });
    if (ok) { sharedOnce('kakao'); return; }
    // SDK 키가 없거나 로드 실패: 링크라도 쥐여 준다
    const copied = await copyText(buildChallengeUrl(p, siteUrl));
    if (copied) sharedOnce('link');
    toast(copied ? '카카오톡 공유를 쓸 수 없어 링크를 복사했어요' : '카카오톡 공유를 쓸 수 없어요');
  }

  async function saveImage(result: RunResult, tier: Parameters<typeof renderResultImage>[1]['tier'], ghost: { name: string; ms: number } | null): Promise<void> {
    try {
      const blob = await renderResultImage(result, {
        nickname: myName(), tier, siteUrl,
        ghostName: ghost?.name, ghostMs: ghost?.ms,
      });
      downloadBlob(blob, `catch-the-jebi-lv${result.level}.png`);
      track('share_click', { channel: 'image' });
      toast('이미지를 저장했어요');
    } catch {
      toast('이미지를 만들지 못했어요');
    }
  }

  /* ---------- 도전장 수신: home 생략하고 해당 레벨 ---------- */
  function showChallengeIntro(c: ChallengeParams): void {
    const def = getLevel(c.l);
    const go = h('button', { class: 'btn primary', type: 'button', onclick: () => { audio.resume(); intro?.remove(); intro = null; game?.start(); } }, '도전 받기');
    const toHome = h('button', { class: 'btn ghost', type: 'button', onclick: () => goHome('play') }, '홈으로');
    intro = h('div', { class: 'intro' },
      h('div', { class: 'slip open intro-slip' },
        h('div', { class: 'intro-body' },
          h('p', { class: 'intro-from' }, `${c.n}의 도전장`),
          h('p', { class: 'intro-big' }, `레벨 ${c.l} · ${fmtSec(c.t)}초`),
          h('p', { class: 'intro-taunt' }, tauntText(c)),
          h('p', { class: 'intro-note' }, `${c.r != null ? `명중률 ${c.r}% · ` : ''}기준 시간 ${fmtSec(def.parMs)}초`),
          h('span', { class: 'stamp' }, '도전장')),
      ),
      h('div', { class: 'intro-actions' }, go, toHome));
    app.append(intro);
    go.focus({ preventScroll: true });
  }

  /* ---------- 시작 ---------- */
  if (challenge) {
    track('challenge_open', { level: challenge.l, device: 'pc' });
    track('challenge_enter', { from: 'challenge_link' });
    hudLevel = challenge.l;
    home.select(challenge.l);
    mountGame(challenge.l, true);
    document.body.classList.add('playing');
    showChallengeIntro(challenge);
  } else {
    mountGame(home.selected(), false);
    home.show('play');
  }
}
