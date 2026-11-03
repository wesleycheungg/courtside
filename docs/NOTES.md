# Engineering Notes

Running log of test counts, CI timings, and bugs the tests caught. One entry per
milestone. Numbers here are the source for resume metrics, so they are measured, not
estimated.

## Template

```
## M<n> — <name> (YYYY-MM-DD)

Tests:    unit <n> · component <n> · e2e <n> (× <n> projects) · total <n>
Coverage: <n>% statements on src/data
CI:       quality <m:ss> · e2e <m:ss> · total wall clock <m:ss>

Bugs caught by tests:
- <what broke, which test caught it, at which level>

Flaky:
- <test name, date first seen, disposition>

Notes:
- <decisions, surprises, things to revisit>
```

---

## M1 — Foundation (2026-11-02)

```
Tests:    unit 56 · component 5 · e2e 6 (x 2 projects = 12) · total 73
Coverage: 97% statements on src/data/mock, 86% overall
          (overall is dragged down by placeholder screens with no logic yet)
Local:    unit 1.8s · e2e 9.4s
CI:       quality 16s · e2e 38s · both jobs green on PR #1
```

Bugs caught by tests:

- **Play-by-play ordering assertion was inverted.** The period clock counts
  down, so a newest-first list has _ascending_ seconds remaining. The test as
  first written would have passed on a wrongly-ordered feed. Caught at unit
  level before any UI consumed it.
- **Redundant accessible text on the active nav tab.** A visually-hidden
  "(current section)" span duplicated what `aria-current` already conveys, and
  the accessible-name assertion failing is what surfaced it. The span came out.
- **A stray `.vitest/json/output.json` was committed.** Left over from a one-off
  JSON-reporter run and swept up by a `git add -A`. The `format:check` step
  failed the first CI run on it — the pipeline catching something that passed
  locally, which is the point of having the step.

Notes:

- TypeScript is pinned to 5.9 and eslint to 9: typescript-eslint 8 does not yet
  peer-support TypeScript 7 or eslint 10. Worth revisiting once it does.
- `npm audit` reports 12 moderate advisories, all tracing to one transitive
  `minimatch` DoS inside eslint's own tree. Dev-only, lint-time, and npm's
  suggested fix is a downgrade of typescript-eslint, so they stay for now. Zero
  high or critical.
- The simulated live game needed an absolute `?simTime=` as well as the planned
  relative `?simOffset=`. The game cycles hourly, so an offset alone cannot pin
  a state from an unknown phase — e2e would have been non-deterministic.
- The Playwright mobile project runs iPhone 13 metrics on Chromium rather than
  WebKit. It exists to catch layout breakage at 390x844, and one engine keeps CI
  lean. Add a real WebKit project when cross-browser becomes a goal.

---

## Decision: test-first paused after M1 (2026-11-02)

New features ship without tests until M4, to get the app standing up first. The
73 existing tests stay and must keep passing; CI still runs on every PR but
gates nothing, because branch protection is deliberately left off.

Why this is a real cost, recorded now so M4 is scoped honestly:

- The "bugs caught by tests" log above is the most useful artifact this project
  produces, and it only grows while tests are being written alongside code.
- Retrofitting component and e2e coverage onto finished UI is slower than
  writing it as you go, and tends to produce tests shaped around the
  implementation rather than the requirement.
- The traceability table in `docs/TEST_PLAN.md` will carry unfilled rows for
  every shipped M2/M3/M5 requirement until the catch-up lands.

What protects us in the meantime: the data layer and the sim clock — the parts
M2 and M3 build directly on top of — are the best-covered code in the repo at
97% statements, so regressions there still fail fast. Typecheck and lint still
run on every PR.

M4 scope grows accordingly: it now backfills coverage for everything shipped in
M2, M3, and M5 before adding axe, visual regression, and tagged suites.

---

## M2 part 1 — Games feed on mock data (2026-11-02)

```
Tests:    64 unit/component (+3 vs M1) · 12 e2e · total 76
          No new feature tests — test-first is paused until M4.
Local:    unit 1.9s · e2e 12.5s
```

Shipped: date strip, All/Live filter chips, league-grouped feed with live /
final / scheduled ordering, loading, empty and error states, and 15s polling
that stops once nothing is live. All against the MockProvider.

Bugs caught while building:

- **Scheduled games sorted wrongly, and showed the wrong local day.** Fixtures
  combined the slate date with a UTC time of day, so a game tipping at 02:30
  UTC — a normal 9:30pm ET game — landed on the previous local evening and
  sorted ahead of earlier games. Spotted by eye in a screenshot, not by a test.
  Fixed with an explicit `tipoffDayOffset` on the wire format; the three unit
  tests added alongside the fix are the only new tests in this milestone.
- **Winner/loser emphasis was inverted.** First pass dimmed every team that was
  not winning, which greys out both sides of a live game. Only the losing side
  of a _finished_ game should dim.

Deliberately not built, to avoid non-functional chrome: the search and calendar
icon buttons in the header, and the "On TV" / "Following" filter chips. All four
appear in the design but have nothing behind them yet.

Note: the MockProvider returns the same slate for every date, so the date strip
changes the URL and refetches but shows the same games. Real per-date data
arrives with the ESPN provider.

---

## M2 part 2 — Proxy and EspnProvider (2026-11-02)

```
Tests:    101 unit/component (+37) · 12 e2e · total 113
          26 of the new ones run the normalizer over real captured responses;
          11 cover the proxy's cache, validation and failure paths.
Local:    unit 2.4s · e2e 15.7s
```

Shipped: four edge routes under `api/` (scoreboard, summary, standings, teams)
that fetch, validate with Zod, and cache; `EspnProvider` behind the existing
`DataProvider` interface; real captured fixtures; and a Vite dev middleware so
`npm run dev` serves the routes locally without `vercel dev`.

### What checking the real API changed

Every one of these would have been wrong if the shapes had been assumed:

- `competitor.score` is a **string** (`"117"`), not a number.
- `competitor.linescores` is **absent** on a scheduled game, not `[]`.
- `competitors` is ordered **home first** — indexing `[0]` as away is wrong.
- `team.color` has **no** leading `#`.
- Standings entries carry **no team color at all**, so standings has to join
  against the teams endpoint. This is why there is a fourth proxy route.
- Standings entries arrive **unsorted** — the captured file leads with a 1-6
  team at seed 13.
- Standings stats are a **flat array keyed by name**, not fixed fields, so
  every read has to tolerate an absent stat.

### Open gap: no live fixture

No NBA game — and no game in any other ESPN sport — was in progress when the
fixtures were captured, so there is no recorded in-progress response. The live
branch is written only against fields verified present in every capture
(`status.period`, `status.displayClock`, `status.type.state`) and the schema
deliberately does not constrain the unobserved strings. `npm run capture:espn`
closes this during any game. Tracked as a partial criterion in `docs/PLAN.md`.

### Verified by hand

Ran the real route handlers against live ESPN: all four returned 200 and
validated, the second scoreboard call served `x-courtside-cache: hit`, and a
malformed date returned 400. Loaded the feed with `VITE_DATA_PROVIDER=espn` and
confirmed 15 real finals render with correct winners, overtime labelling and
records — with **zero** requests to any espn.com host from the browser.

Bug found: the "Sample data for demo purposes" footer showed even on live data.
Now switches to the ESPN attribution when the provider is live.

---

## M3 — Game detail (2026-11-03)

```
Tests:    101 unit/component · 12 e2e · total 113 (no new ones)
Local:    unit 2.4s · e2e 16.9s
```

Shipped: `/game/:id` with Summary, Box score, Plays and Shots tabs; the active
tab lives in the URL and survives a refresh. Score by quarter, team stat
comparison, box score with a team toggle, and newest-first play-by-play. Feed
rows are now links. Works against both providers — the ESPN summary endpoint is
normalized end to end.

### Two shapes for the same field

The summary endpoint does **not** send what the scoreboard sends, even for
identical concepts. Caught by the Zod schema on first run rather than by an
undefined reaching the UI:

| Field      | Scoreboard                       | Summary header                                  |
| ---------- | -------------------------------- | ----------------------------------------------- |
| line score | `{ value: 30, period: 1 }`       | `{ displayValue: "30" }` — no number, no period |
| records    | `records: [...]`                 | `record: [...]` — singular                      |
| status     | `{ period, displayClock, type }` | `{ type }` only                                 |

Resolved with a `lineScoreValue` helper, accepting both record keys, and making
`period`/`displayClock` optional with the period derived from line-score count.
This is the clearest argument so far for validating at the boundary: three
silent `undefined`s became three readable parse errors with field paths.

The box score is label-indexed — `labels` names the columns and each athlete's
`stats` holds strings in that order — so nothing reads a fixed column position.

### Bugs found by eye

- **Team names clipped at 390px.** A three-digit score squeezed the team
  columns. Score now uses `clamp()` and names wrap. Verified
  `scrollWidth - clientWidth === 0` on the detail page.
- **Full player names pushed the stat columns off screen.** The design uses
  "J. Tatum"; now abbreviated at render.
- **Minutes rendered as `30.2`.** Rounded for display.

Both of the first two are component-level issues that a rendering test would
have caught immediately — the second milestone running where visual bugs were
found by looking rather than by a test. M4's backfill is the fix.

### Scope note

The Shots tab ships as an explicit empty state, which is its M3 criterion. Shot
charts need per-shot coordinates and stay in the Later bucket — the summary
response does carry a `shotChartAvailable` flag and `coordinate` on plays, so
the data exists when we want it.

---

## M5 — Standings and Player (2026-11-03)

```
Tests:    101 unit/component · 12 e2e · total 113 (no new ones)
Local:    unit 2.4s · e2e 10.6s
```

Standings with East/West tabs, seed markers and a legend; player page with
season-average tiles, a recent-points chart, game log and shooting splits.
Box-score rows link through to the player. Both screens work on mock and live.

Two new ESPN endpoints, both on `site.web.api.espn.com` rather than the
`site.api.espn.com` host everything else uses — worth knowing, it is a separate
base URL in `api/_lib/espn.ts`:

- `/athletes/{id}` — profile plus `statsSummary` carrying season averages and
  their league ranks.
- `/athletes/{id}/gamelog` — label-indexed like the box score.

Shooting splits are summed from the game log, because the athlete endpoint
gives percentages but not makes and attempts, and the design shows both. The
summed FG% came out at 45.1%, matching ESPN's own `fieldGoalPct` for the same
player — a useful independent check that the summing is right.

### Deviation from the design

The design's "Shooting by zone" panel (restricted area, paint, mid-range,
above the break) needs per-shot coordinates, which neither endpoint carries.
Shipped FG / 3PT / FT splits instead — real data, same panel shape. Zones go
with the shot charts in the Later bucket; `shotChartAvailable` and per-play
`coordinate` in the summary response are the way in when we want them.

### Domain change

`Player.seasonAverages` went from four fixed numeric fields to a `StatTile[]`,
and `heightInches: number` to `height: string`. Providers expose different
stats and format height differently, and the page only ever renders what it is
handed. `shootingSplits` is new.

### Bug found by eye

Standings clipped the STRK column at 390px — cell padding and the team-name
font were too generous. Tightened; the table now fits with zero inner scroll.
Third milestone running where a layout bug was caught by looking rather than by
a test.

---

## M4 — Quality pass (2026-11-03)

```
Tests:    250 unit/component (+149) · 84 e2e (+72) · 18 visual · total 352
Coverage: 86% statements, 73% branches overall
Local:    unit 3.2s · e2e 54.7s · smoke ~10s
```

The catch-up for the paused milestones, plus the quality tooling.

### Bugs the backfill found

Five, four of which were user-visible:

1. **`?date=2026-13-45` silently loaded a different day.** `new Date(2026, 12, 45)`
   rolls over to 2027-02-14 rather than failing, so the shape check passed and
   the feed quietly showed the wrong date. Now validated by round-trip.
2. **Team badges failed contrast on seven team colours.** White on Blazers red
   is 4.33:1, and near-black on it is 4.36:1 — at 10px bold, mid-tone colours
   fail _both_ ways, so choosing a text colour cannot fix it. The badge now
   darkens the team colour just enough for white to clear 4.5:1.
3. **Game rows and date buttons broke WCAG 2.5.3.** Both used `aria-label` to
   replace their visible text; the rule requires the accessible name to
   _contain_ it. Hidden text inside the control now appends instead.
4. **`aria-label` on a `<p>`** — prohibited without a role. The scoreline used
   one. Replaced with visually-hidden text.
5. **Player header subtext at 85% white** failed AA on mid-tone team colours.

Items 2 to 5 were all found by axe, none by eye across three milestones of
looking at these screens. That is the argument for the tool.

### Deliberate design choices

- **Provider injection over module mocking.** Component tests pass a stub
  through a `DataProviderScope` context rather than `vi.mock`-ing the data
  layer, so they exercise the same code path production runs. The test plan
  already claimed this; now it is true.
- **Builders over fixtures.** `src/test/builders.ts` gives every domain object
  a sane default so a test states only what it cares about. `build()` treats an
  explicit `undefined` as "remove this field", which is how a test models a
  team with no record under `exactOptionalPropertyTypes`.
- **Smoke gate before the full suite.** ~10s of core journeys run first in CI,
  so an obvious break fails before the full minute is spent confirming it. It
  does re-run those tests, which is a deliberate trade.
- **Flaky reporting.** `scripts/flaky-report.mjs` reads Playwright's JSON and
  separates retried-then-passed from genuine passes, writing both to the CI
  step summary. Playwright's own count blends them.

### Visual snapshots: macOS only for now

Baselines are platform-specific — macOS and Linux font rasterisation differ far
beyond any sane tolerance. No Docker on this machine, so Linux baselines could
not be generated locally. The committed baselines are macOS and enforced by
`npm run test:visual`; the CI e2e run excludes them via `--grep-invert @visual`.

The `visual-baselines` workflow generates Linux PNGs on demand — run it,
download the artifact, commit it, and drop the grep-invert.

### Flaky

None observed. One near-miss worth recording: running `vite preview` by hand on
port 4173 while Playwright's `webServer` had `reuseExistingServer` on made axe
scan a stale build and report seven phantom failures. Not test flake, but the
same class of confusion — kill stray preview servers before trusting a run.

---

## M6 — Contract tests and cache (2026-11-03)

```
Tests:    317 unit/component (+67) · 18 live contract (scheduled) · 84 e2e · 18 visual
Coverage: 86% statements, 73% branches overall
Local:    unit 8.2s (was 3.2s) · contract 1.5s · e2e 54.7s · smoke ~10s
```

Two halves that only look related: a contract suite that watches ESPN for shape
changes, and a Postgres cache that exists so the data can be asserted about in
SQL.

### The unit suite got 2.5× slower, on purpose

3.2s to 8.2s. PGlite boots a real Postgres per test file, and the SQL assertions
are worth that: they run the same `.sql` files that would run in psql against
production, so the checks a reviewer reads are the checks that execute. The
alternative — asserting the arithmetic in TypeScript against a mock client —
would have tested a reimplementation of the query rather than the query.

### The invariant changed how the cache writes

Writing "score equals the sum of its quarters" as SQL rather than prose forced
two cases that an upsert-per-row cache would have got wrong:

1. **Stale period rows.** Upserting quarters leaves a row behind when a game is
   corrected _downward_ — an overtime reversed, a mis-parsed fifth period. The
   sum then exceeds the total and the invariant breaks, from a write that looked
   successful. `saveGames` now deletes period rows outside the set it just
   wrote, matched on period number rather than count, because the stale row is
   not always the highest-numbered one.
2. **Seed collisions in standings.** Seeds are unique per conference, so two
   teams passing each other collide mid-update against the rows still holding
   the old seeds. Standings are replaced per conference instead of upserted.

Neither was a user-visible bug — the cache is new and nothing reads it yet. Both
are the kind of thing that would have become one, silently, once M7's health
page started reporting from these tables.

### Vite rewrites `new URL(..., import.meta.url)`

The snapshot writer resolved its output directory that way, and Vite rewrote the
expression into a bundled asset reference, which for a file it cannot see at
build time resolves to `undefined`. The symptom was a file named, literally,
`contract/undefined` holding the teams snapshot — and the snapshot test passing
anyway, because the write and the read agreed with each other. Both the snapshot
loader and the validation loader now use `path.join(dirname(fileURLToPath(...)))`,
with a comment in each saying why. The stray file is deleted.

### What ESPN is actually doing

First live run, 2026-11-03: all 18 checks pass, no field we read changed type,
nothing we read stopped being sent. The quirks the normalizer is built on all
still hold — `score` is a string, `competitors` is home-first, colours have no
leading `#`. Those are asserted individually because each one is a silently
wrong score rather than a parse error if it changes.

Drift _was_ reported, as notes rather than failures: ESPN sends a few dozen
fields beside ones we read on `athlete` and `gamelog` — `season.startDate`,
`events{}.homeTeamScore`, team logos. The diff deliberately reports only direct
children of paths the schema already models; listing every unmodelled key would
bury the signal under several hundred lines. A rename still surfaces, as a
`missing` and an `added` under the same parent, which is the case worth catching.

### Deliberate design choices

- **The snapshot is a flat `path -> type` map, not nested JSON.** One line per
  field, so an added optional key is a one-line diff in a PR instead of a
  reindented block. Both halves of the comparison — Zod schema and live payload
  — emit the same type vocabulary, so they are directly comparable.
- **The fingerprint is derived, not asserted.** It is a hash of the fields block,
  checked against a recomputation, so a snapshot cannot be hand-edited into
  agreeing with itself.
- **The cache maps through the app's own normalizers.** `db/rows.ts` builds rows
  from `normalizeEspnScoreboard` and a newly extracted `normalizeEspnPeriods`
  rather than reading the wire format again. If it mapped ESPN independently the
  SQL would be checking the cache's arithmetic, not the app's — and the only
  invariant worth proving is about the number a user sees.
- **The cache can never fail a request.** `cacheQuietly` swallows and logs, the
  route does not await it, and `getSqlClient()` returns `null` with no
  `DATABASE_URL` rather than throwing. A deploy with no database serves scores
  exactly as it did before M6, which is also what keeps CI and a fresh clone
  working with no service to stand up.
- **Contract runs on its own workflow, daily at 13:00 UTC.** After even a
  west-coast game has finished, so the slate it discovers is complete, and never
  `cancel-in-progress` — each run is a datapoint about that day's payloads. It
  walks back up to 10 days for a slate with games, so the offseason and dark
  days do not read as contract failures.

### Not done

No Postgres instance is provisioned. The write-through path is covered against
real Postgres in CI, but nothing has written a row to a hosted database yet —
set `DATABASE_URL` in Vercel, run `npm run db:migrate`, and the proxy starts
caching. Tracked in `docs/PLAN.md` under M6.

### Flaky

None observed. The live contract suite is the one place flake is expected
eventually, which is exactly why it is off the PR path and set to `retry: 0` — a
flake there is information about ESPN, not something to paper over.

---

## M7 — Observability and polish (2026-11-03)

```
Tests:    358 vitest (+41: 267 src · 91 api/db/contract) · 98 e2e (+14) · 18 visual
Coverage: 87.5% statements, 75.5% branches (was 86 / 73)
Local:    unit 9.5s · e2e 29.6s · smoke 12.9s · visual 14.6s · lighthouse ~2m
Lighthouse (mobile, median of 3): feed 96 · game detail 98 · standings 100
          accessibility, best practices and SEO 100 on all three
Bundle:   504 kB raw / 150 kB gzip JS · 31 kB CSS
```

A health endpoint, skeleton loaders, a Lighthouse budget in CI, and a README
that finally shows the thing.

### A health page instead of Sentry

The criterion allowed either. The health route won because it answers the
questions from inside the deployment, with nothing to sign up for in the
setup instructions — a fork runs `npm install` and gets the same diagnostics.
It reports three things, each measured where it can actually be measured:

- **Upstream** — a real probe through the same `fetchEspn` the routes use,
  under the same cache key. A check during a busy minute is served from the
  twelve-second memory cache rather than adding load, and a cold check warms
  the cache the next scoreboard request reads. Verified by hand against live
  ESPN: first call 221 ms and `servedFromCache: false`, second call 0 ms and
  `true`.
- **Schema** — the proxy's own validation log, which now records the last Zod
  result per instance. That is deliberately the live result, not the contract
  suite's: the contract run says what ESPN sent at 13:00 UTC, the log says
  what this instance parsed a moment ago.
- **Cache age** — `max(fetched_at)` per table, which M6's `cacheAge` already
  existed to answer.

Three decisions worth recording:

1. **It is not on `DataProvider`.** Routing it through the provider seam would
   mean MockProvider inventing a health report, and the page would stop being a
   diagnostic. It fetches `/api/health` directly and parses it with a Zod
   schema that `api/health.ts` also imports, so the two sides cannot drift.
2. **A `down` report is served with 503, body intact.** An uptime monitor sees
   a failure without reading the body; the page still renders the report,
   because "ESPN is unreachable" is more use than a generic error.
3. **No database is not unhealthy.** `configured: false` reports as OK. A
   configured database that cannot be reached is `degraded`. That asymmetry is
   the whole point of M6's optional cache.

The screen is not in the bottom nav — it is an operator's screen, not a tab a
fan needs.

### Measuring beat assuming, twice

**Code splitting made it worse.** Lazy-loading every route except the feed cut
the entry bundle from 504 kB to 357 kB, which looked like a win until the
numbers came in: standings went from performance 100 and LCP 0.8 s to 97 and
2.6 s, because a tap now waits for a chunk fetch before anything can render.
The app is small enough that one bundle beats a waterfall. Reverted, and the
measurement is why.

**The first "failure" was the machine.** The first local Lighthouse run scored
75 on standings with TBT at 1,410 ms. Nothing was wrong with the page — five
stray dev and preview servers were still running from earlier in the session.
Killing them took the same page to 100 with TBT at 10 ms. This is the second
time this project has been fooled by a stray server (see M4's near-miss), so
the gate now takes the **median of three runs** per screen, which is
Lighthouse's own advice and what stops a busy CI runner from failing a PR.

### Bugs Lighthouse found

- **No favicon.** Every page load requested `/favicon.ico`, 404'd, and logged a
  console error — a best-practices deduction on every screen, and a real 404 in
  production. Added an SVG favicon and the `<link>` that stops the `.ico`
  request.
- **No robots.txt**, which capped SEO at 91.

Both now score 100. Neither is dramatic; both are the kind of thing nobody
notices by looking, which is the argument for having a budget at all.

### Skeletons are built from the real classes

Each screen's skeleton reuses the layout classes of the thing it stands in for
— `league-section`, `game-row`, `panel` — rather than approximating them, so
the placeholder occupies the box the content will by construction instead of by
a developer keeping two files in sync. Measured CLS is 0.001 on the feed and 0
elsewhere.

The accessible shape matters more than the visual one: every skeleton block is
`aria-hidden`, and the region carries one visually-hidden status with
`aria-busy`. A screen reader hears "Loading games" once, exactly as it did when
the loading state was a sentence — which is also why the existing component
assertions still pass unchanged.

One thing the skeletons cannot show in e2e: with the mock provider, data
arrives in the same tick, so no test can catch the feed skeleton on screen. The
health page can, because it really does fetch — its e2e holds the response open
behind a gate the test releases, so the loading assertion needs no timer.

### Not done

- Branch protection still has to be set in GitHub, and the Lighthouse job is
  deliberately not in the required checks: it runs and reports on every PR, but
  a score is a measurement of a shared runner as much as of the page.
- `/game/mock-final-gsw-okc` has LCP 2.3 s under mobile throttling against
  0.8 s elsewhere, with a performance score of 98. Unthrottled the same element
  paints at 152 ms, so this is font-and-throttling, not a layout problem. Worth
  a look if the budget is ever raised.
- `npm audit` now reports 16 moderate advisories, up from 12: Lighthouse pulls
  in the same transitive `minimatch` the eslint tree already had. Dev-only,
  zero high or critical.

### Flaky

None observed across the e2e, visual and smoke suites. The Lighthouse gate is
the new candidate — median-of-three is the mitigation, and the first CI run
will say whether it is enough.

---

## M8 — Date picker (2026-11-03)

```
Tests:    399 vitest (+41: 308 src · 91 api/db/contract) · 108 e2e (+10) · 18 visual
Coverage: 88.8% statements, 76.9% branches (was 87.5 / 75.5)
Local:    unit 10.1s · e2e 28.6s · smoke 11.6s · visual 16.8s
Lighthouse (mobile, median of 3): feed 100 · game detail 98 · standings 100
          accessibility, best practices and SEO 100 on all three
Bundle:   508 kB raw / 152 kB gzip JS · 33 kB CSS
```

The five-day strip became a FotMob-style bar: prev/next arrows either side of
the current date, which opens a month calendar.

### What the strip was actually costing

The strip spent the full width on five days and still could not reach a sixth.
Any date further out than two days needed the URL typed by hand. The bar gives
back the width, and the calendar reaches any date at all — so the control got
smaller and more capable at the same time.

### Month arithmetic is where this would have broken

`setMonth` is not month arithmetic. January 31 plus one month is March 3,
because February has no 31st and `Date` rolls the overflow forward. A calendar
paging on that would skip February entirely from any 31-day month — a bug that
only appears in four months of the year and only from the end of them.

`addMonths` moves to the 1st first, then clamps the day to what the target
month has. `addMonths: clamps rather than skipping a short month` pins all
three cases, including the leap-year one, and there is a component test that
pages from January 31 and asserts February is what appears.

### One tab stop, not forty-two

A month grid is up to 42 buttons. Left alone, every one is a tab stop, and a
keyboard user who opened the calendar would need 42 presses to get back to the
page. The grid uses roving tabindex instead: exactly one day is tabbable, the
arrows move it, and an effect moves real DOM focus to follow.

That is asserted directly (`keeps one tab stop in the grid, not one per day`)
rather than left to the a11y scan, because axe has no opinion about it — it is
a usability property, not a violation.

Focus moving and selection changing are deliberately separate. Arrowing across
the grid pages the month on show but fires no query; only Enter or a click
loads a day. `does not load a new day just for arrowing around` is the guard —
without it, holding ArrowRight would be a request per keystroke.

### Focus goes back, except when it shouldn't

Escape and selecting a day both hand focus to the trigger, so the tab order
survives the popover. Dismissing by clicking outside does not: a mouse user who
clicked somewhere else did not ask to be sent back to the picker, and yanking
focus there would be the control arguing with them. Both halves are asserted.

### A bug in the a11y test, not the app

`every interactive element is reachable by keyboard` failed on the first run:
15 focusable elements, 14 reached. The picker's two arrows are icon-only, so
both had empty `textContent`, and the test's identity string collapsed them
into one `Set` entry. Both were always reachable.

The test now prefers `aria-label` over `textContent` when building that
identity. Worth recording because the failure looked exactly like a real
keyboard trap, and the fix was in the assertion — the kind of thing that gets
"fixed" by loosening the threshold if nobody reads it closely.

### Deliberate design choices

- Weeks run Monday-first. FotMob's convention, and the app is NBA-only so far
  rather than US-only by design; `monthGrid` is the one place it is decided.
- Cells outside the month are blank, not the neighbouring month's greyed days.
  A tap can then never land on a date the header is not naming.
- Today is a ring, selected is a fill, so the day that is both stays legible.
- Weekday headings show the narrow glyph and announce the long name. Seven
  columns of "Mon" do not fit 390px, and a bare "T" read aloud is a coin flip.
- The day buttons' accessible name is the full date alone, with the visible
  number `aria-hidden`. WCAG 2.5.3 still holds — the name contains the visible
  label — without a screen reader saying "4 Wednesday, 4 November 2026".

### Not done

- The e2e specs that exercise the calendar pin `?date=` to a fixed day rather
  than starting from today, because the month on show and the day they click
  have to be known in advance. The ones that only step a day still start from
  today and assert on "Yesterday"/"Tomorrow", which holds on any date.
- No visual baseline of the calendar open. The popover only exists after an
  interaction, and the visual suite is path-driven; the a11y suite gained an
  open-calendar scan, so the markup is covered even though the pixels are not.
- The mock provider still returns the same slate for every date, so picking a
  day proves the wiring, not the data.

### Flaky

None observed. The four games-feed visual baselines were regenerated for the
new control and reviewed; no other screen moved.
