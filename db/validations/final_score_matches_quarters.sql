-- R4: a final score must equal the sum of that team's quarter scores.
--
-- The single most important thing this project can get wrong, and not
-- expressible as a constraint: it spans two tables and an aggregate. Every row
-- this returns is a game we would display with a score that contradicts its
-- own quarter breakdown.
--
-- Returns: one row per offending game. Zero rows is a pass.

select
  g.id                   as game_id,
  g.away_team,
  g.away_score           as away_total,
  sum(p.away_score)      as away_quarter_sum,
  g.home_team,
  g.home_score           as home_total,
  sum(p.home_score)      as home_quarter_sum
from cached_games g
join cached_game_periods p on p.game_id = g.id
where g.status = 'final'
group by g.id, g.away_team, g.away_score, g.home_team, g.home_score
having sum(p.away_score) <> g.away_score
    or sum(p.home_score) <> g.home_score;
