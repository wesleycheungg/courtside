-- R7: games behind must follow from W/L, not be taken on trust.
--
--   GB = ((leader wins - wins) + (losses - leader losses)) / 2
--
-- Cross-row by nature: it needs the conference leader, so no CHECK constraint
-- can express it. ESPN sends `gamesBehind` as its own stat and we store what
-- it says; this is the check that what it says agrees with the record beside
-- it. Compared with a tolerance because GB is stored to one decimal.
--
-- Returns: one row per team whose GB does not follow. Zero rows is a pass.

with leaders as (
  select
    conference,
    wins   as leader_wins,
    losses as leader_losses
  from cached_standings
  where seed = 1
)
select
  s.conference,
  s.team_name,
  s.wins,
  s.losses,
  s.games_behind as reported,
  round(
    ((l.leader_wins - s.wins) + (s.losses - l.leader_losses))::numeric / 2,
    1
  ) as expected
from cached_standings s
join leaders l on l.conference = s.conference
where abs(
  s.games_behind
  - round(((l.leader_wins - s.wins) + (s.losses - l.leader_losses))::numeric / 2, 1)
) > 0.05;
