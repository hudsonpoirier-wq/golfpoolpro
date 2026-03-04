-- ============================================================
-- MyGolfPoolPro — Supabase / PostgreSQL Schema
-- Run this in your Supabase SQL editor
-- ============================================================

-- Enable UUID generation
create extension if not exists "pgcrypto";

-- ─── USERS ───────────────────────────────────────────────────
-- Supabase Auth handles the auth.users table automatically.
-- This extends it with app-specific profile data.
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null,
  avatar      text,          -- 2-letter initials e.g. "JH"
  email       text not null unique,
  created_at  timestamptz default now()
);
-- Auto-create profile when a user signs up
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, avatar, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email,'@',1)),
    upper(left(coalesce(new.raw_user_meta_data->>'name', new.email), 1) ||
          coalesce(substring(new.raw_user_meta_data->>'name' from '\s(\S)'), '')),
    new.email
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── TOURNAMENTS ─────────────────────────────────────────────
create table public.tournaments (
  id          text primary key,   -- e.g. "t4"
  name        text not null,
  venue       text,
  start_date  date,
  end_date    date,
  purse       numeric,
  field_size  int,
  status      text default 'upcoming' check (status in ('upcoming','active','complete'))
);

-- ─── GOLFERS ─────────────────────────────────────────────────
-- Cached from the sports data API, refreshed daily
create table public.golfers (
  id            int primary key,
  name          text not null,
  country       text,
  world_rank    int,
  scoring_avg   numeric(5,2),
  sg_total      numeric(5,2),
  driv_dist     int,
  driv_acc      numeric(4,1),
  gir           numeric(4,1),
  putts         numeric(4,1),
  updated_at    timestamptz default now()
);

-- ─── TOURNAMENT SCORES ───────────────────────────────────────
-- Live scores cached from sports API, refreshed every 30s during active events
create table public.tournament_scores (
  id              serial primary key,
  tournament_id   text references public.tournaments(id) on delete cascade,
  golfer_id       int references public.golfers(id) on delete cascade,
  position        int,
  r1              int,
  r2              int,
  r3              int,
  r4              int,
  birdies         int[] default '{0,0,0,0}',
  eagles          int[] default '{0,0,0,0}',
  bogeys          int[] default '{0,0,0,0}',
  updated_at      timestamptz default now(),
  unique (tournament_id, golfer_id)
);

-- ─── POOLS ───────────────────────────────────────────────────
create table public.pools (
  id                text primary key default 'p' || encode(gen_random_bytes(4), 'hex'),
  name              text not null,
  tournament_id     text references public.tournaments(id),
  host_id           uuid references public.profiles(id) on delete set null,
  status            text default 'lobby' check (status in ('lobby','draft','live','complete')),
  max_participants  int default 8,
  team_size         int default 4,
  scoring_golfers   int default 2,
  cut_line          int default 2,
  shot_clock        int default 60,  -- seconds per draft pick
  invite_token      text unique default encode(gen_random_bytes(6), 'hex'),
  created_at        timestamptz default now()
);

-- ─── POOL MEMBERS ────────────────────────────────────────────
create table public.pool_members (
  pool_id     text references public.pools(id) on delete cascade,
  user_id     uuid references public.profiles(id) on delete cascade,
  joined_at   timestamptz default now(),
  is_ready    boolean default false,
  primary key (pool_id, user_id)
);

-- ─── DRAFT PICKS ─────────────────────────────────────────────
create table public.draft_picks (
  id            serial primary key,
  pool_id       text references public.pools(id) on delete cascade,
  user_id       uuid references public.profiles(id) on delete cascade,
  golfer_id     int references public.golfers(id) on delete cascade,
  pick_number   int not null,
  picked_at     timestamptz default now(),
  unique (pool_id, golfer_id)           -- each golfer can only be drafted once per pool
);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.pools          enable row level security;
alter table public.pool_members   enable row level security;
alter table public.draft_picks    enable row level security;
alter table public.tournament_scores enable row level security;
alter table public.golfers        enable row level security;
alter table public.tournaments    enable row level security;

-- Profiles: users can read all profiles, only update their own
create policy "Profiles are viewable by everyone"   on public.profiles for select using (true);
create policy "Users can update own profile"        on public.profiles for update using (auth.uid() = id);

-- Pools: anyone can read pools they are a member of; host can update/delete
create policy "Members can view pool"        on public.pools for select
  using (id in (select pool_id from public.pool_members where user_id = auth.uid())
      or host_id = auth.uid());
create policy "Authenticated users can create pools" on public.pools for insert
  with check (auth.uid() is not null);
create policy "Host can update pool"         on public.pools for update
  using (host_id = auth.uid());
create policy "Host can delete pool"         on public.pools for delete
  using (host_id = auth.uid());

-- Pool members: visible to other members of same pool
create policy "Members can view pool_members" on public.pool_members for select
  using (pool_id in (select pool_id from public.pool_members where user_id = auth.uid()));
create policy "Users can join pools"          on public.pool_members for insert
  with check (auth.uid() = user_id);
create policy "Users can leave pools"         on public.pool_members for delete
  using (auth.uid() = user_id);
create policy "Members can update ready status" on public.pool_members for update
  using (auth.uid() = user_id);

-- Draft picks: visible to all members of the pool
create policy "Members can view draft picks"  on public.draft_picks for select
  using (pool_id in (select pool_id from public.pool_members where user_id = auth.uid()));
create policy "Members can make picks"        on public.draft_picks for insert
  with check (pool_id in (select pool_id from public.pool_members where user_id = auth.uid())
           and auth.uid() = user_id);

-- Scores and golfers are public read
create policy "Scores are public"    on public.tournament_scores for select using (true);
create policy "Golfers are public"   on public.golfers           for select using (true);
create policy "Tournaments public"   on public.tournaments       for select using (true);

-- ─── USEFUL VIEWS ────────────────────────────────────────────

-- Pool standings: computes score for each member
create or replace view public.pool_standings as
select
  dp.pool_id,
  dp.user_id,
  p.name as player_name,
  p.avatar,
  po.team_size,
  po.scoring_golfers,
  count(dp.golfer_id) as golfers_drafted,
  (
    select coalesce(sum(total), 0)
    from (
      select ts.r1 + ts.r2 + ts.r3 + ts.r4 as total
      from public.draft_picks dp2
      join public.tournament_scores ts
        on ts.golfer_id = dp2.golfer_id
       and ts.tournament_id = po.tournament_id
      where dp2.pool_id = dp.pool_id
        and dp2.user_id = dp.user_id
      order by (ts.r1 + ts.r2 + ts.r3 + ts.r4) asc
      limit po.scoring_golfers
    ) best
  ) as score
from public.draft_picks dp
join public.profiles p on p.id = dp.user_id
join public.pools po on po.id = dp.pool_id
group by dp.pool_id, dp.user_id, p.name, p.avatar, po.team_size, po.scoring_golfers, po.tournament_id;

-- ─── INDEXES ─────────────────────────────────────────────────
create index on public.draft_picks (pool_id, user_id);
create index on public.tournament_scores (tournament_id);
create index on public.pool_members (pool_id);
create index on public.pool_members (user_id);
