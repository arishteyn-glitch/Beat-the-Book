-- Beat the Book — Supabase / PostgreSQL schema
-- Run this in the Supabase SQL editor (Database → SQL) of a new project.
-- Designed for single-user personal use: RLS allows the anon key full access.
-- If you ever share the project, replace these policies with auth-based ones.

create table if not exists bets (
  id text primary key,
  date date not null,
  sport text not null,
  league text not null default '',
  event text not null default '',
  sportsbook text not null,
  bet_type text not null,
  market text not null,
  selection text not null default '',
  odds integer not null,
  stake numeric not null,
  potential_payout numeric not null default 0,
  promotion_used boolean not null default false,
  promotion_type text not null default 'None',
  confidence_score numeric,
  final_bet_score numeric,
  est_true_prob numeric,
  closing_line integer,
  status text not null default 'pending',
  cashout_amount numeric,
  notes text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists bet_reviews (
  bet_id text primary key references bets(id) on delete cascade,
  answer text not null check (answer in ('yes','no','unsure')),
  note text not null default '',
  reviewed_at timestamptz not null default now()
);

create table if not exists promotions (
  id text primary key,
  sportsbook text not null,
  promo_type text not null,
  description text not null default '',
  boost_pct numeric,
  max_stake numeric,
  min_odds integer,
  expiration date,
  eligible_markets text not null default '',
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists recommendations (
  id text primary key,
  created_at timestamptz not null default now(),
  sport text not null,
  event text not null default '',
  sportsbook text not null,
  market text not null,
  bet_type text not null default 'Straight',
  selection text not null default '',
  odds integer not null,
  scores jsonb not null default '{}',
  final_score numeric not null default 0,
  verdict text not null default 'PASS',
  stake_rec numeric not null default 0,
  units_rec numeric not null default 0,
  est_true_prob numeric not null default 0,
  implied_prob numeric not null default 0,
  edge_pct numeric not null default 0,
  ev_pct numeric not null default 0,
  clv_projection numeric not null default 0,
  factors jsonb not null default '[]',
  risks jsonb not null default '[]',
  summary text not null default '',
  status text not null default 'active'
);

create table if not exists settings (
  id integer primary key default 1 check (id = 1),
  data jsonb not null default '{}'
);

create index if not exists bets_date_idx on bets(date);
create index if not exists bets_sport_idx on bets(sport);
create index if not exists bets_status_idx on bets(status);

-- Single-user RLS: anon key gets full access (personal project).
alter table bets enable row level security;
alter table bet_reviews enable row level security;
alter table promotions enable row level security;
alter table recommendations enable row level security;
alter table settings enable row level security;

do $$
declare t text;
begin
  foreach t in array array['bets','bet_reviews','promotions','recommendations','settings'] loop
    execute format('drop policy if exists "anon full access" on %I', t);
    execute format(
      'create policy "anon full access" on %I for all using (true) with check (true)', t
    );
  end loop;
end $$;
