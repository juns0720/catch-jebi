// 챌린지 홈: 캔버스(하늘) 위 중앙 카드. 플레이 탭 / 랭킹 탭.
import type { Progress } from '@/types';
import { MAX_LEVEL, getLevel } from '@/game/levels';
import { badgeSvg } from '@/ui/badges';
import { createRankPanel, getHall } from './rank';
import { fmtSec, h, maxCleared, playerTier, setMuteIcon } from './ui';

export interface HomeDeps {
  getProgress(): Progress;
  onStart(level: number): void;
  onToggleMute(): void;
  onLogout(): void;
  /** 컨테이너에 Google 로그인 버튼을 그린다 (설정이 없으면 비워 둔다) */
  mountGoogle(el: HTMLElement): void;
}

export type HomeTab = 'play' | 'rank';

export interface Home {
  el: HTMLElement;
  show(tab?: HomeTab): void;
  hide(): void;
  /** 진행도가 바뀐 뒤 다시 그린다 */
  refresh(): void;
  select(level: number): void;
  selected(): number;
  setSession(nick: string | null): void;
  setMuted(m: boolean): void;
}

export function createHome(root: HTMLElement, deps: HomeDeps): Home {
  let tab: HomeTab = 'play';
  let sel = Math.min(MAX_LEVEL, Math.max(1, deps.getProgress().unlocked));
  let sessionNick: string | null = null;
  const rank = createRankPanel(sel);

  const el = h('div', { class: 'home', hidden: true });
  const top = h('div', { class: 'home-top' });
  const card = h('main', { class: 'home-card' });
  el.append(top, card);
  root.append(el);

  const muteBtn = h('button', { class: 'btn ghost icon', type: 'button', onclick: () => deps.onToggleMute() });
  setMuteIcon(muteBtn, deps.getProgress().muted);

  function renderTop() {
    let account: HTMLElement;
    if (sessionNick) {
      account = h('div', { class: 'home-account' },
        h('span', { class: 'home-nick' }, sessionNick),
        h('button', { class: 'btn ghost', type: 'button', onclick: () => deps.onLogout() }, '로그아웃'));
    } else {
      const google = h('div', { class: 'home-google', 'aria-label': 'Google 로그인' });
      account = h('div', { class: 'home-account' }, google);
      deps.mountGoogle(google);
    }
    top.replaceChildren(
      h('a', { class: 'btn ghost', href: '/?ref=challenge' }, '← 제비뽑기로'),
      h('div', { class: 'home-top-right' }, account, muteBtn),
    );
  }

  function tabButton(id: HomeTab, label: string) {
    return h('button', {
      class: 'home-tab', type: 'button', role: 'tab', 'aria-selected': tab === id ? 'true' : 'false',
      onclick: () => { if (tab !== id) show(id); },
    }, label);
  }

  function renderPlay(p: Progress): HTMLElement {
    const tier = playerTier(p);
    const cleared = maxCleared(p);
    const def = getLevel(sel);
    const best = p.best[sel];

    const badge = h('div', { class: 'home-badge', 'aria-hidden': 'true' });
    badge.innerHTML = badgeSvg(tier.id, 72);

    const grid = h('div', { class: 'lv-grid', role: 'group', 'aria-label': '레벨 선택' });
    for (let l = 1; l <= MAX_LEVEL; l++) {
      const locked = l > p.unlocked;
      const b = h('button', {
        class: `lv-btn${l === sel ? ' on' : ''}${p.best[l] ? ' done' : ''}`,
        type: 'button', disabled: locked, 'aria-pressed': l === sel ? 'true' : 'false',
        title: locked ? '앞 레벨을 기준 시간 안에 클리어하면 열려요' : `레벨 ${l}`,
        onclick: () => { sel = l; render(); },
      }, String(l));
      grid.append(b);
    }

    const hall = h('p', { class: 'home-hall' }, '박씨 제비 …');
    getHall().then((rows) => {
      hall.textContent = rows.length ? `박씨 제비 ${rows.length}명` : '아직 아무도 박씨를 물어오지 못했어요';
      hall.classList.toggle('zero', rows.length === 0);
    });

    return h('div', { class: 'home-play' },
      h('div', { class: 'home-tier' }, badge,
        h('div', null,
          h('p', { class: 'home-tier-name' }, tier.name),
          h('p', { class: 'home-meta' }, cleared ? `최고 클리어 레벨 ${cleared}` : '아직 클리어한 레벨이 없어요'))),
      h('button', { class: 'btn primary home-start', type: 'button', onclick: () => deps.onStart(sel) }, `레벨 ${sel} 시작`),
      h('p', { class: 'home-meta' },
        `기준 시간 ${fmtSec(def.parMs)}초 · 제비 ${def.birds}마리`,
        best ? ` · 내 최고 ${fmtSec(best)}초` : ' · 아직 기록이 없어요'),
      grid,
      hall,
      h('p', { class: 'home-rule' }, '쪽지를 문 제비 중 당첨 한 마리만 잡으면 돼요. 당첨 제비는 더 빠르고 예민하게 굴어요. 꽝을 잡으면 1초 동안 손이 묶이고, 기준 시간을 넘기면 제비들이 강남으로 돌아가요.'),
    );
  }

  function render() {
    const p = deps.getProgress();
    renderTop();
    const tabs = h('div', { class: 'home-tabs', role: 'tablist' }, tabButton('play', '플레이'), tabButton('rank', '랭킹'));
    card.replaceChildren(
      h('header', { class: 'home-head' },
        h('h1', null, 'Catch The Jebi'),
        h('p', null, '제비 잡기')),
      tabs,
      tab === 'play' ? renderPlay(p) : rank.el,
    );
  }

  function show(t: HomeTab = tab) {
    tab = t;
    el.hidden = false;
    if (tab === 'rank') rank.setLevel(sel);
    render();
    if (tab === 'rank') rank.load();
  }

  return {
    el,
    show,
    hide() { el.hidden = true; },
    refresh() { if (!el.hidden) render(); },
    select(level) {
      sel = Math.min(MAX_LEVEL, Math.max(1, level));
    },
    selected: () => sel,
    setSession(nick) { sessionNick = nick; if (!el.hidden) renderTop(); },
    setMuted(m) { setMuteIcon(muteBtn, m); },
  };
}
