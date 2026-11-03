-- R4, the other half: the sum check above passes vacuously on a game with no
-- periods stored at all, because an inner join drops it. A finished basketball
-- game has at least four.
--
-- Returns: one row per final game with fewer than four periods. Zero is a pass.

select
  g.id              as game_id,
  g.status,
  count(p.period)   as periods_stored
from cached_games g
left join cached_game_periods p on p.game_id = g.id
where g.status = 'final'
group by g.id, g.status
having count(p.period) < 4;
