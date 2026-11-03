# Courtside — Test Plan

## 1. Purpose and scope

Courtside displays NBA scores, game detail, standings, and player stats, sourced from a
third-party API we do not control. This plan defines what we test, at which level, and how
we decide a milestone is safe to ship.

**In scope:** the React client, the serverless ESPN proxy, the data normalization layer, and
the Postgres cache (M6).

**Out of scope:** ESPN's own correctness (we test that we faithfully represent what they
return, not that they are right), browsers older than the last two major versions, and
native apps.

## 2. Quality objectives

1. A score shown to a user is the score the source reported. Wrong data is worse than no data.
2. A live game visibly updates, and stops updating when it ends.
3. An upstream schema change is detected by a test before a user sees a broken screen.
4. Every screen is usable by keyboard and screen reader.
5. The suite is trustworthy: deterministic, fast enough to run on every PR, and flaky tests
   are tracked rather than retried into silence.

## 3. Risk assessment

Priority drives how much coverage something gets and at which levels. P1 items get coverage
at more than one level and block a release; P3 items get a single cheap check.

| ID  | Risk                                                                 | Likelihood | Impact | Priority | Mitigation                                                                           |
| --- | -------------------------------------------------------------------- | ---------- | ------ | -------- | ------------------------------------------------------------------------------------ |
| R1  | Score or status rendered incorrectly after normalization             | Med        | High   | **P1**   | Unit tests over fixtures for every status; component tests per state                 |
| R2  | ESPN changes response shape; app breaks in production                | High       | High   | **P1**   | Zod at the boundary; contract suite on a schedule; proxy logs the failing field path |
| R3  | Live game stops updating, or keeps polling after all games end       | Med        | High   | **P1**   | Deterministic sim clock; e2e for live→final; assertion that polling halts            |
| R4  | Final score disagrees with the sum of quarter scores                 | Low        | High   | **P1**   | SQL data-validation tests (M6); component assertion in score-by-quarter              |
| R5  | Wrong date's games shown due to timezone handling                    | Med        | Med    | **P2**   | Unit tests across timezones and the UTC day boundary; CI pinned to a non-UTC TZ      |
| R6  | Proxy cache serves stale data past its window, or fails open to ESPN | Med        | Med    | **P2**   | Unit tests on cache expiry; contract test asserts no direct browser→ESPN calls       |
| R7  | Standings order or GB math wrong                                     | Low        | Med    | **P2**   | Unit tests on the sort and GB formula; SQL validation (M6)                           |
| R8  | Accessibility regressions (contrast, focus, labels) on a dark theme  | Med        | Med    | **P2**   | axe scans in CI; keyboard traversal test; contrast checked at token level            |
| R9  | Mobile layout breaks at 390×844                                      | Med        | Med    | **P2**   | Playwright mobile project; visual snapshots at both viewports                        |
| R10 | Empty and error states render as blank screens                       | Med        | Low    | **P3**   | Component tests for each state                                                       |
| R11 | Cosmetic drift from the design                                       | High       | Low    | **P3**   | Visual regression snapshots                                                          |
| R12 | Placeholder screens (Following, News) regress                        | Low        | Low    | **P3**   | Covered incidentally by the nav smoke test                                           |

## 4. Test levels

Each level owns what it is cheapest and most reliable at proving. A behavior is tested at the
lowest level that can genuinely prove it, and only duplicated upward when the risk is P1.

| Level         | Tool                    | Owns                                                                                               | Runs                        |
| ------------- | ----------------------- | -------------------------------------------------------------------------------------------------- | --------------------------- |
| **Unit**      | Vitest                  | Normalization, status derivation, the sim clock, date/timezone helpers, GB math, cache expiry      | Every PR                    |
| **Component** | Vitest + RTL            | A component's rendering per state — loading, empty, error, live, final — and its accessible output | Every PR                    |
| **E2E**       | Playwright              | User journeys across routes, desktop and mobile, live→final, polling lifecycle                     | Every PR                    |
| **Contract**  | Vitest, live network    | Real ESPN responses against our stored schemas                                                     | Scheduled, separate from PR |
| **Visual**    | Playwright snapshots    | Layout and theme on the main screens at both viewports                                             | Every PR (M4+)              |
| **A11y**      | axe-core via Playwright | Serious and critical violations per screen                                                         | Every PR (M4+)              |
| **Data**      | SQL assertions          | Cross-field integrity in the cache: score vs. quarter sum, GB vs. W/L                              | Every PR (M6+)              |

**Deliberately not done:** mocking at the network layer in component tests (we inject a
provider instead), snapshot tests of component markup (brittle, proves nothing), and
end-to-end tests of anything a unit test can prove.

## 5. Test data strategy

- Mock fixtures are the default everywhere, including CI. No test depends on the network
  except the contract suite.
- Fixtures cover every state the UI distinguishes: scheduled, live, halftime, final,
  overtime, and a game with no data available.
- Real ESPN responses are captured verbatim into `src/data/fixtures/espn/` with the capture
  date recorded, so a schema change can be diffed against a known-good payload.
- Time is never read from the system clock inside production code paths under test. The
  simulated live game takes an injected clock; tests pass a fixed value, and e2e shifts it
  with `?simOffset=<ms>`.

## 6. Entry and exit criteria

**Entry (a milestone may start when):** the previous milestone's exit criteria are met, its
acceptance criteria in `docs/PLAN.md` are written, and new risks are added to §3.

**Exit (a milestone may ship when):**

1. Every acceptance criterion for it in `docs/PLAN.md` is checked off.
2. Typecheck, lint, unit, component, and e2e all pass in CI on the PR.
3. Every P1 risk touched by the milestone has passing coverage at two or more levels.
4. The traceability table in §7 has no `—` in the Tests column for a shipped requirement.
5. Zero known defects of severity high or above remain open.
6. No test is skipped or quarantined without a linked follow-up note in `docs/NOTES.md`.
7. `docs/NOTES.md` records the test count, CI duration, and any bug the tests caught.

## 7. Requirements traceability

Filled in as features land. `Req` ties to an acceptance criterion in `docs/PLAN.md`;
`Tests` names real test titles, not descriptions.

| Req  | Requirement                                          | Risk   | Level     | Tests                                                    | Status |
| ---- | ---------------------------------------------------- | ------ | --------- | -------------------------------------------------------- | ------ |
| M1-1 | App loads and the Games screen renders               | —      | E2E       | `smoke: app loads with the Games screen`                 | ☐      |
| M1-2 | Bottom nav navigates to all four routes              | R12    | E2E       | `smoke: bottom nav navigates to every section`           | ☐      |
| M1-3 | Active nav tab is marked for assistive tech          | R8     | Component | `BottomNav: marks the active tab with aria-current`      | ☐      |
| M1-4 | Fixtures normalize into domain types                 | R1     | Unit      | `normalize: maps a fixture game into the domain type`    | ☐      |
| M1-5 | Status derives correctly for every game state        | R1     | Unit      | `normalize: derives status for scheduled / live / final` | ☐      |
| M1-6 | Simulated live game advances with the clock          | R3     | Unit      | `live sim: returns the scripted score for a given clock` | ☐      |
| M1-7 | Simulated game reports final past its timeline       | R3     | Unit      | `live sim: reports final once the timeline is exhausted` | ☐      |
| M1-8 | Provider defaults to mock with no env set            | R6     | Unit      | `getProvider: defaults to the mock provider`             | ☐      |
| M2-1 | Browser never calls ESPN directly                    | R2, R6 | E2E       | —                                                        | ☐      |
| M2-2 | Proxy validates responses and logs the failing field | R2     | Unit      | —                                                        | ☐      |
| M2-3 | Proxy caches for 10–15s                              | R6     | Unit      | —                                                        | ☐      |
| M2-4 | Feed groups games as live / final / scheduled        | R1     | Component | —                                                        | ☐      |
| M2-5 | Date strip loads the selected date's games           | R5     | E2E       | —                                                        | ☐      |
| M2-6 | Live filter count is accurate                        | R1     | Component | —                                                        | ☐      |
| M2-7 | Polling runs at 15s while live and stops after       | R3     | E2E       | —                                                        | ☐      |
| M3-1 | Quarter scores sum to the displayed total            | R4     | Component | —                                                        | ☐      |
| M3-2 | Tabs are reachable and survive a refresh             | —      | E2E       | —                                                        | ☐      |
| M3-3 | Box score renders both teams' stat lines             | R1     | Component | —                                                        | ☐      |
| M5-1 | Standings order and GB are correct                   | R7     | Unit      | —                                                        | ☐      |
| M5-2 | Playoff and play-in markers are not color-only       | R8     | Component | —                                                        | ☐      |
| M6-1 | Contract suite detects an upstream shape change      | R2     | Contract  | —                                                        | ☐      |
| M6-2 | Final score equals the sum of quarters in the cache  | R4     | Data      | —                                                        | ☐      |

## 8. Environments

| Environment      | Data source       | Used for                           |
| ---------------- | ----------------- | ---------------------------------- |
| Local dev        | Mock (default)    | Development, unit, component, e2e  |
| CI               | Mock              | All PR checks                      |
| Preview (per PR) | Live, via proxy   | Manual review                      |
| Production       | Live, via proxy   | —                                  |
| Contract run     | Live ESPN, direct | Scheduled schema verification only |

## 9. Reporting

Playwright's HTML report and traces upload as CI artifacts on every run, pass or fail;
traces are captured on first retry. Failures are triaged as product defect, test defect, or
environment. Flaky tests (retried then passed) are listed in `docs/NOTES.md` with the date
first seen, and are fixed or quarantined with a note — never silently retried.
