-- Catch The Jebi: runs 테이블, 뷰, RPC.
-- Supabase 대시보드 SQL Editor 에 그대로 붙여넣어 실행할 수 있다.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------- runs
create table if not exists public.runs (
  id             uuid primary key default gen_random_uuid(),
  created_at     timestamptz not null default now(),
  device_id      text not null,
  user_id        uuid references auth.users (id) on delete set null,
  nickname       text,
  level          int  not null check (level between 1 and 15),
  time_ms        int  not null check (time_ms >= 0),
  par_ms         int  not null check (par_ms > 0),
  cleared        boolean not null,
  blanks         int  not null default 0 check (blanks >= 0),
  misses         int  not null default 0 check (misses >= 0),
  accuracy       real,
  stamps         text[] not null default '{}',
  taps           jsonb,
  input          text not null default 'pc',
  client_version text,
  flagged        boolean not null default false
);

create index if not exists runs_level_time_idx
  on public.runs (level, time_ms)
  where cleared and not flagged;
create index if not exists runs_device_idx on public.runs (device_id);
create index if not exists runs_user_idx on public.runs (user_id) where user_id is not null;
create index if not exists runs_hof_idx
  on public.runs (created_at)
  where level = 15 and cleared and not flagged;

-- RLS: 정책을 하나도 만들지 않는다 = anon/authenticated 의 직접 select/insert/update/delete 전부 불허.
-- 쓰기는 Edge Function(service role), 읽기는 아래 뷰/RPC 로만.
alter table public.runs enable row level security;
revoke all on public.runs from anon, authenticated;
grant all on public.runs to service_role;

-- ---------------------------------------------------------------- views
-- 뷰는 소유자(postgres) 권한으로 실행되므로 RLS 를 우회해 필요한 컬럼만 공개한다.
-- device_id / user_id / taps 는 노출하지 않는다.
create or replace view public.leaderboard_level as
select
  r.id,
  coalesce(r.nickname, '이름 없는 제비') as nickname,
  r.level,
  r.time_ms,
  r.blanks,
  r.misses,
  r.created_at
from public.runs r
where r.cleared and not r.flagged;

-- 박씨 제비 명예의 전당: 레벨 15 클리어, 닉네임 있는 사람(플레이어당 가장 이른 기록).
create or replace view public.hall_of_fame as
select
  h.nickname,
  h.created_at,
  (row_number() over (order by h.created_at asc, h.id asc) = 1) as first
from (
  select distinct on (coalesce(r.user_id::text, r.device_id))
    r.id, r.nickname, r.created_at
  from public.runs r
  where r.level = 15 and r.cleared and not r.flagged and r.nickname is not null
  order by coalesce(r.user_id::text, r.device_id), r.created_at asc, r.id asc
) h;

revoke all on public.leaderboard_level, public.hall_of_fame from public, anon, authenticated;
grant select on public.leaderboard_level, public.hall_of_fame to anon, authenticated;

-- ---------------------------------------------------------------- rpc
-- 종합 랭킹: 플레이어(user_id 또는 device_id)별 최고 레벨, 그 레벨의 최단 기록.
create or replace function public.leaderboard_overall(p_limit int default 100)
returns table (
  id         uuid,
  nickname   text,
  level      int,
  time_ms    int,
  blanks     int,
  misses     int,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select b.id, b.nickname, b.level, b.time_ms, b.blanks, b.misses, b.created_at
  from (
    select
      r.id,
      coalesce(r.nickname, '이름 없는 제비') as nickname,
      r.level,
      r.time_ms,
      r.blanks,
      r.misses,
      r.created_at,
      row_number() over (
        partition by coalesce(r.user_id::text, r.device_id)
        order by r.level desc, r.time_ms asc, r.created_at asc
      ) as rn
    from public.runs r
    where r.cleared and not r.flagged
  ) b
  where b.rn = 1
  order by b.level desc, b.time_ms asc, b.created_at asc
  limit least(greatest(coalesce(p_limit, 100), 1), 200);
$$;

revoke all on function public.leaderboard_overall(int) from public;
grant execute on function public.leaderboard_overall(int) to anon, authenticated;

-- 로그인 후 같은 device_id 의 기록을 내 계정으로 묶는다. 묶은 행 수를 돌려준다.
create or replace function public.claim_runs(p_device_id text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '28000';
  end if;
  update public.runs
     set user_id = auth.uid()
   where device_id = p_device_id
     and user_id is null;
  get diagnostics n = row_count;
  return n;
end;
$$;

revoke all on function public.claim_runs(text) from public, anon;
grant execute on function public.claim_runs(text) to authenticated;
