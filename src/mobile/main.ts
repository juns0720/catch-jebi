// 모바일 안내 화면 (SPEC 4.2). 카톡 링크는 대부분 폰에서 열리므로 도전장 정보를 그대로 보여준다.
import '@/styles/tokens.css';
import './mobile.css';
import { tierOfLevel } from '@/types';
import { initAnalytics, track } from '@/data/analytics';
import { badgeSvg } from '@/ui/badges';
import {
  buildChallengeUrl, buildOgUrl, challengeTitle, copyText, getSiteUrl, initKakao,
  parseChallengeParams, sendToMeKakao, tauntText,
} from '@/ui/share';

type Child = Node | string | null | undefined | false;
type Attrs = Record<string, string | number | boolean | null | undefined | ((e: any) => void)>;
function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs | null, ...kids: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v == null || v === false) continue;
      if (typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
      else if (k === 'class') el.className = String(v);
      else el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  for (const c of kids) if (c != null && c !== false) el.append(c);
  return el;
}

let toastTimer = 0;
function toast(msg: string): void {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => el!.classList.remove('show'), 2400);
}

function main(): void {
  initAnalytics();
  initKakao((import.meta.env.VITE_KAKAO_JS_KEY as string | undefined) ?? '');

  const app = document.getElementById('app') as HTMLElement;
  const siteUrl = getSiteUrl();
  const challenge = parseChallengeParams(location.search);
  const from = new URLSearchParams(location.search).get('from') ?? (challenge ? 'challenge' : 'direct');

  track('mobile_gate_view', { from });
  if (challenge) track('challenge_open', { level: challenge.l, device: 'mobile' });

  // PC에서 열 주소: 도전장이면 도전장 URL, 아니면 챌린지 홈
  const pcUrl = challenge ? buildChallengeUrl(challenge, siteUrl) : `${siteUrl}/challenge/`;
  const sendTitle = challenge ? challengeTitle(challenge) : 'Catch The Jebi · 제비 잡기';
  const sendImage = challenge ? buildOgUrl(challenge, siteUrl) : `${siteUrl}/og-default.png`;

  /* ----- 쪽지 카드 ----- */
  let slipBody: HTMLElement;
  if (challenge) {
    const tier = tierOfLevel(challenge.l);
    const badge = h('div', { class: 'gate-badge', 'aria-hidden': 'true' });
    badge.innerHTML = badgeSvg(tier.id, 64);
    slipBody = h('div', { class: 'gate-body' },
      badge,
      h('p', { class: 'gate-from' }, `${challenge.n}의 도전장`),
      h('p', { class: 'gate-record' }, `${(challenge.t / 1000).toFixed(1)}초`),
      h('p', { class: 'gate-level' }, `레벨 ${challenge.l} · ${tier.name}${challenge.r != null ? ` · 명중률 ${challenge.r}%` : ''}`),
      h('p', { class: 'gate-taunt' }, tauntText(challenge)),
      h('span', { class: 'stamp' }, '도전장'),
      h('p', { class: 'gate-msg' }, '이 게임은 마우스가 필요해요. PC에서 열어주세요.'),
    );
  } else {
    slipBody = h('div', { class: 'gate-body' },
      h('p', { class: 'gate-kicker' }, 'Catch The Jebi'),
      h('p', { class: 'gate-title' }, '제비 잡기'),
      h('p', { class: 'gate-msg' }, '이 게임은 마우스가 필요해요. PC에서 열어주세요.'),
    );
  }

  /* ----- 버튼 3개 ----- */
  const copyBtn = h('button', {
    class: 'btn primary', type: 'button',
    onclick: async () => {
      const ok = await copyText(pcUrl);
      toast(ok ? '링크를 복사했어요. PC에서 열어 보세요' : '복사하지 못했어요');
    },
  }, '링크 복사');

  const sendBtn = h('button', {
    class: 'btn ghost', type: 'button',
    onclick: async () => {
      track('mobile_send_to_me');
      const ok = await sendToMeKakao(pcUrl, { title: sendTitle, imageUrl: sendImage });
      if (!ok) {
        const copied = await copyText(pcUrl);
        toast(copied ? '카카오톡을 쓸 수 없어 링크를 복사했어요' : '카카오톡을 쓸 수 없어요');
      }
    },
  }, '카카오톡 나에게 보내기');

  const lotteryLink = h('a', { class: 'btn ghost', href: '/' }, '제비뽑기는 폰에서도 돼요 →');

  app.append(
    h('div', { class: 'slip open gate-slip' }, slipBody),
    h('div', { class: 'gate-actions' },
      copyBtn,
      sendBtn,
      h('p', { class: 'gate-hint' }, '카카오톡 공유 창에서 나와의 채팅을 골라 보내고, PC 카카오톡에서 열어 주세요.'),
      lotteryLink),
  );
}

main();
