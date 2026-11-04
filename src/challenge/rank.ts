// 랭킹 패널 (레벨별/종합) + 명예의 전당
import type { HallOfFameRow, LeaderboardRow } from '@/types';
import { MAX_LEVEL } from '@/game/levels';
import { fetchHallOfFame, fetchLeaderboard } from '@/data/supabase';
import { fmtSec, h } from './ui';

let hallCache: Promise<HallOfFameRow[]> | null = null;

/** 명예의 전당 (캐시). 클리어 직후에는 invalidateHall()로 비운다. */
export function getHall(): Promise<HallOfFameRow[]> {
  if (!hallCache) {
    hallCache = fetchHallOfFame().catch(() => [] as HallOfFameRow[]);
  }
  return hallCache;
}
export function invalidateHall(): void { hallCache = null; }

const NO_HALL = '아직 아무도 박씨를 물어오지 못했어요';

function dateText(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getMonth() + 1}.${String(d.getDate()).padStart(2, '0')}`;
}

export interface RankPanel {
  el: HTMLElement;
  /** 현재 선택으로 다시 불러온다 */
  load(): void;
  setLevel(level: number | 'overall'): void;
}

export function createRankPanel(initial: number | 'overall'): RankPanel {
  let sel: number | 'overall' = initial;
  let seq = 0;

  const select = h('select', { class: 'rank-select', 'aria-label': '랭킹 종류' });
  select.append(h('option', { value: 'overall' }, '종합'));
  for (let l = 1; l <= MAX_LEVEL; l++) select.append(h('option', { value: String(l) }, `레벨 ${l}`));
  const list = h('ol', { class: 'rank-list' });
  const hallTitle = h('h3', { class: 'rank-sub' }, '명예의 전당');
  const hallList = h('ul', { class: 'hall-list' });

  const syncSelect = () => { select.value = String(sel); };
  select.addEventListener('change', () => {
    sel = select.value === 'overall' ? 'overall' : Number(select.value);
    load();
  });

  function renderRows(rows: LeaderboardRow[], overall: boolean) {
    list.replaceChildren();
    if (!rows.length) {
      list.append(h('li', { class: 'rank-empty' }, '아직 기록이 없어요. 첫 기록의 주인공이 되어 보세요.'));
      return;
    }
    rows.forEach((r, i) => {
      list.append(h('li', { class: `rank-row${i < 3 ? ' top' : ''}` },
        h('span', { class: 'rk' }, String(i + 1)),
        h('span', { class: 'nm' }, r.nickname || '이름 없는 제비'),
        overall ? h('span', { class: 'lv' }, `Lv ${r.level}`) : null,
        h('span', { class: 'tm' }, `${fmtSec(r.time_ms)}초`),
        h('span', { class: 'dt' }, dateText(r.created_at)),
      ));
    });
  }

  function load() {
    syncSelect();
    const mine = ++seq;
    list.replaceChildren(h('li', { class: 'rank-empty' }, '불러오는 중…'));
    fetchLeaderboard(sel, 100)
      .catch(() => [] as LeaderboardRow[])
      .then((rows) => { if (mine === seq) renderRows(rows, sel === 'overall'); });
    getHall().then((rows) => {
      if (mine !== seq) return;
      hallTitle.textContent = rows.length ? `명예의 전당 · 박씨 제비 ${rows.length}명` : '명예의 전당';
      hallList.replaceChildren();
      if (!rows.length) { hallList.append(h('li', { class: 'rank-empty' }, NO_HALL)); return; }
      for (const r of rows) {
        hallList.append(h('li', { class: 'hall-row' },
          h('span', { class: 'nm' }, r.nickname || '이름 없는 제비'),
          r.first ? h('span', { class: 'stamp hall-first' }, '최초의 박씨 제비') : null,
          h('span', { class: 'dt' }, dateText(r.created_at)),
        ));
      }
    });
  }

  const el = h('div', { class: 'rank' },
    h('div', { class: 'rank-head' }, h('label', { class: 'rank-label' }, '랭킹 ', select)),
    list, hallTitle, hallList,
  );
  syncSelect();

  return {
    el,
    load,
    setLevel(l) { sel = l; syncSelect(); },
  };
}
