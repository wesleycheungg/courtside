# Captured ESPN responses

Verbatim responses from ESPN's unofficial endpoints, trimmed only by removing
events (never by editing an event's shape). They exist so a schema change
upstream can be diffed against a known-good payload.

| File                                   | Endpoint                              | Captured   | Contains                                                     |
| -------------------------------------- | ------------------------------------- | ---------- | ------------------------------------------------------------ |
| `scoreboard-final-2026-11-02.json`     | `nba/scoreboard?dates=20261102`       | 2026-11-03 | Two finished games — one regulation, one overtime (period 5) |
| `scoreboard-scheduled-2026-11-04.json` | `nba/scoreboard?dates=20261104`       | 2026-11-03 | Two games that have not tipped off                           |
| `standings-2026-11-03.json`            | `v2/.../nba/standings`                | 2026-11-03 | Both conferences, 15 entries each, full stat arrays          |
| `teams-2026-11-03.json`                | `nba/teams`                           | 2026-11-03 | All 30 teams with colors and logos                           |
| `roster-21-2026-11-05.json`            | `v3/.../teams/21/roster?enable=stats` | 2026-11-05 | Phoenix: 17 athletes, 15 with season averages and 2 without  |
| `summary-final-401909907.json`         | `nba/summary?event=401909907`         | 2026-11-03 | A finished game: linescores, team stats, player box score    |
| `summary-pregame-401909289.json`       | `nba/summary?event=401909289`         | 2026-11-06 | PHI @ CLE before tip-off: `boxscore.teams` season averages   |

The two summaries keep only the top-level keys `espnSummarySchema` models —
`header`, `boxscore`, and `plays`. Whole keys are dropped (`odds`, `predictor`,
`pickcenter`, …); nothing inside a kept key is edited.

## Missing: a live game

**No live fixture has been captured yet.** Every NBA game had finished when
these were taken, and no other ESPN sport had a game in progress either, so
there was no in-progress response to record. Rather than hand-write one and
label it "captured", the gap is left open.

What this means in practice: the live branch of the normalizer is written
against fields verified to exist in every captured response — `status.period`,
`status.displayClock`, and `status.type.state` — but the exact strings ESPN
sends for an in-progress game (`status.type.name`, `description`, `detail`)
have not been observed. The schema deliberately does not constrain them.

**To close this:** run `npm run capture:espn -- <YYYYMMDD>` while a game is in
progress and commit the result as `scoreboard-live-<date>.json`.

## Notes on the shapes

Things that are not obvious and that the normalizer has to handle:

- `competitor.score` is a **string**, not a number.
- `competitor.linescores` is **absent** on a scheduled game, not an empty array.
- `competitors` is ordered **home first**, so the away team cannot be assumed
  to be index 0.
- `team.color` is hex **without** a leading `#`.
- Standings entries carry **no team color** — the teams endpoint is the only
  source, so standings normalization joins against it by team id.
- Standings entries are **not pre-sorted**; the first entry in the captured
  file is a 1-6 team with `playoffSeed` 13.
- Standings stats are a **flat array keyed by `name`/`type`**, not fixed fields,
  so every lookup has to tolerate a missing stat.
- A **pre-game summary carries no roster and no player stats**. Its `boxscore`
  holds only `teams` — there is no `rosters` key and `boxscore.players` is
  empty. That is why rosters come from a separate endpoint, on the web host.
- `boxscore.teams[].statistics` **means different things before and after tip-off**.
  After, it is that game's stats (`totalRebounds`, `assists`, `pointsInPaint`, …).
  Before, it is the team's **season averages** (`avgPoints`, `avgPointsAgainst`,
  `avgRebounds`, …) plus `streak` and `Last Ten Games`. The two sets overlap
  only on `fieldGoalPct` and `threePointFieldGoalPct`, so reading a pre-game
  summary with the played-game names yields exactly two rows and no error.
  Which set to expect is decided by the game's state, never by sniffing names.
- One pre-game stat name, **`Last Ten Games`, has spaces in it** — it is not
  camelCase like every other name in the array.
- A roster athlete's four season averages are **split across categories**: REB
  under `general`, PTS/AST/FG% under `offensive`. Read them by name, never by
  position.
- A roster athlete with no games played has `statistics.splits` as an **empty
  object** — no `categories` key at all, not an empty array.
- `athlete.jersey` is sometimes **`null`** rather than absent, and
  `positionGroups[].position` arrives `null` on every NBA roster.
