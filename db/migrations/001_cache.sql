-- Courtside cache: fetched games and standings.
--
-- This is a cache, not a source of truth, so every table is keyed on the
-- upstream id and written with an upsert. `fetched_at` is what makes staleness
-- answerable, which the M7 health page needs.
--
-- Per-row rules live here as CHECK constraints — the database should refuse an
-- impossible row rather than relying on a test to notice it. Cross-row and
-- cross-table rules cannot be expressed as constraints and live in
-- db/validations/ instead.

create table if not exists cached_games (
  id            text        primary key,
  league        text        not null,
  starts_at     timestamptz not null,
  status        text        not null check (status in ('scheduled', 'live', 'final')),
  away_team_id  text        not null,
  away_team     text        not null,
  away_score    integer     not null check (away_score >= 0),
  home_team_id  text        not null,
  home_team     text        not null,
  home_score    integer     not null check (home_score >= 0),
  fetched_at    timestamptz not null default now(),
  -- No team plays itself.
  constraint cached_games_distinct_teams check (away_team_id <> home_team_id)
);

create index if not exists cached_games_starts_at_idx on cached_games (starts_at);

create table if not exists cached_game_periods (
  game_id     text    not null references cached_games (id) on delete cascade,
  period      integer not null check (period between 1 and 14),
  away_score  integer not null check (away_score >= 0),
  home_score  integer not null check (home_score >= 0),
  primary key (game_id, period)
);

create table if not exists cached_standings (
  conference    text        not null check (conference in ('east', 'west')),
  team_id       text        not null,
  team_name     text        not null,
  seed          integer     not null check (seed > 0),
  wins          integer     not null check (wins >= 0),
  losses        integer     not null check (losses >= 0),
  games_behind  numeric(4, 1) not null check (games_behind >= 0),
  streak        text        not null,
  fetched_at    timestamptz not null default now(),
  primary key (conference, team_id),
  unique (conference, seed)
);
