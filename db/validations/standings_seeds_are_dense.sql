-- R7: seeds within a conference must run 1..N with no gaps.
--
-- The unique constraint stops two teams sharing a seed; nothing stops the set
-- being 1,2,3,5 after a partial write, which would render a standings table
-- that skips a row and marks the wrong teams as play-in.
--
-- Returns: one row per conference whose seeding is not dense. Zero is a pass.

select
  conference,
  count(*)    as teams,
  min(seed)   as lowest_seed,
  max(seed)   as highest_seed
from cached_standings
group by conference
having max(seed) <> count(*)
    or min(seed) <> 1;
