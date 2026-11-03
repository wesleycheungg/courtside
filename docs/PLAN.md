# Courtside — Delivery Plan

Milestones ship one at a time, each on its own branch and PR. A milestone is done when
every acceptance criterion below is demonstrably true, CI is green, and `docs/NOTES.md`
has been updated.

Legend: ☐ not started · ◐ in progress · ☑ done

---

## M1 — Foundation ◐ (deploy pending dashboard setup)

Docs, scaffold, theme, app shell, mock data layer, first tests, CI, deploy.

**Acceptance criteria**

- ☑ `CLAUDE.md`, `docs/PLAN.md`, `docs/TEST_PLAN.md`, `docs/NOTES.md`, and `README.md`
  exist; the README carries the ESPN disclaimer.
- ☑ `npm install && npm run dev` works from a clean clone with no network access to any
  sports API and no environment variables set.
- ☑ Design tokens are defined once in `src/styles/tokens.css`; no hardcoded color values
  exist anywhere else in `src/`.
- ☑ Bottom nav shows Games, Leagues, Following, and News; tapping each navigates to its
  route; the active tab is styled with the accent color and carries `aria-current="page"`.
- ☑ Direct navigation to every route works (no 404 on refresh or deep link).
- ☑ `DataProvider` is defined in `src/data/provider.ts` with `getGames`, `getGame`,
  `getStandings`, `getPlayer`, and `getPlayByPlay`.
- ☑ `getProvider()` returns MockProvider unless `VITE_DATA_PROVIDER=espn`.
- ☑ No type imported from outside `src/data/` describes a provider's wire format.
- ☑ Mock fixtures cover scheduled, live, halftime, final, and overtime games.
- ☑ The simulated live game's state is a pure function of an injected clock; passing a
  clock past the end of its timeline yields status `final`.
- ☑ `?simOffset=<ms>` shifts that clock and `?simTime=<epoch ms>` pins it outright;
  `VITE_SIM_OFFSET` and `VITE_SIM_TIME` do the same at build time.
- ☑ At least one Vitest unit test, one RTL component test, and one Playwright smoke test
  (via a Page Object) pass locally.
- ☑ Playwright runs a desktop project and a 390×844 mobile project.
- ☑ CI runs typecheck, lint, unit tests, and Playwright on every PR, and uploads the HTML
  report and traces as artifacts.
- ☐ The app is deployed and reachable at a public URL; PRs get a preview URL.

---

## M2 — Proxy, EspnProvider, Games feed ☐

The first real data, behind a serverless proxy, rendered as the Games feed.

**Build order (revised 2026-11-02).** The feed UI comes first, built entirely against
the MockProvider — including the live game that already ticks. That puts a real screen
in front of us with no API risk, and because the proxy and `EspnProvider` sit behind the
same `DataProvider` interface, swapping in live data afterwards changes no component.
Deliverables below are unchanged; only their order is.

1. Date strip, filters, game cards, grouping — all on mock data.
2. Serverless proxy, Zod validation, caching.
3. `EspnProvider`, fixture capture, polling against real data.

**Acceptance criteria**

- ☐ A Vercel function under `api/` proxies ESPN scoreboard, summary, and standings.
- ☐ Responses are cached 10–15s; a second request inside that window does not hit ESPN.
- ☐ Responses are validated with Zod; a validation failure logs the specific field path
  that broke and returns a typed error rather than throwing raw.
- ☐ The browser makes zero requests to any `espn.com` host — verifiable in the network tab
  and asserted by an e2e test.
- ☐ `EspnProvider` implements `DataProvider` and normalizes into the same domain types the
  MockProvider produces; swapping providers changes no component code.
- ☐ Real ESPN responses for a live, a final, and a scheduled game are captured as fixtures
  with the capture date recorded.
- ☑ The feed shows a date strip; selecting a date loads that date's games and updates the URL.
- ☑ Filters All and Live work; the Live chip shows an accurate count.
- ☑ Games are grouped as live, then final, then scheduled, under a league header.
- ☑ TanStack Query polls every 15s while a game is live and stops when none are.
- ☑ Loading, empty (no games on this date), and error states each render deliberately.

---

## M3 — Game detail ☐

**Acceptance criteria**

- ☐ Tabs Summary, Box score, Plays, and Shots are reachable; the active tab is reflected in
  the URL and survives a refresh.
- ☐ The header shows both teams, logos, records, score, and live period plus clock.
- ☐ Score by quarter renders all played periods including overtime, and each team's quarter
  values sum to its displayed total.
- ☐ Team stat comparison renders paired bars for the stats in the design.
- ☐ Box score lists both teams' players with per-player stat lines, scrollable on mobile.
- ☐ Play-by-play is ordered newest first and labels scoring plays distinctly.
- ☐ A live game's detail view updates on the same 15s poll.
- ☐ Shots tab is present; if shot data is unavailable it shows an explicit empty state
  rather than a blank panel.

---

## M4 — Quality pass ☐

Test-first was paused after M1 (see `docs/NOTES.md`), so this milestone now carries the
catch-up as well as the new quality tooling. It is the gate where CI starts blocking.

**Acceptance criteria**

- ☐ Coverage is backfilled for everything shipped in M2, M3, and M5: unit tests for new
  logic, component tests per rendering state, e2e for each user journey.
- ☐ Branch protection on `main` is enabled and requires the `quality` and `e2e` checks.
- ☐ `CLAUDE.md` drops the paused-testing note and restores "every feature ships with
  tests" as a standing rule.
- ☐ axe scans run against Games, Game detail, Standings, and Player with zero serious or
  critical violations.
- ☐ Keyboard-only navigation reaches every interactive element with a visible focus ring.
- ☐ Visual regression snapshots exist for the main screens at both viewports and fail on
  unintended change.
- ☐ Tests are tagged `@smoke` and `@regression`; `npm run test:e2e -- --grep @smoke`
  completes in under two minutes.
- ☐ CI reports flaky tests (retried-then-passed) distinctly from failures.
- ☐ Test IDs in `docs/TEST_PLAN.md` map to real test names, and the traceability table has
  no unfilled rows for shipped features.

---

## M5 — Standings and Player ☐

**Acceptance criteria**

- ☐ Standings has East and West tabs with team, W, L, PCT, GB, and streak columns.
- ☐ Seeds 1–6 are marked as playoff and 7–10 as play-in, with a legend, and the marking is
  conveyed by more than color alone.
- ☐ Rows are ordered by the same rule the source uses, and GB is correct relative to the
  conference leader.
- ☐ Player page shows the season-average tiles, recent-games chart, game log, and shooting
  splits from the design.
- ☐ Navigating from a box score row to that player's page works.

---

## M6 — Contract tests and cache ☐

**Acceptance criteria**

- ☐ A contract suite validates live ESPN responses against the stored schemas and fails with
  the offending field path when ESPN changes shape.
- ☐ Schema snapshots are committed and versioned; a diff is reviewable in a PR.
- ☐ The contract suite runs on a schedule, separately from the PR suite, so upstream drift
  never breaks an unrelated PR.
- ☐ A Postgres cache (Supabase or Neon) stores fetched games and standings.
- ☐ SQL data-validation tests assert each final score equals the sum of its quarters, and
  that standings GB math is consistent with W/L.
- ☐ A deliberately corrupted row makes those validation tests fail.

---

## M7 — Observability and polish ☐

**Acceptance criteria**

- ☐ Errors report to Sentry, or a health page shows proxy status, cache age, and last schema
  validation result.
- ☐ Lighthouse mobile scores ≥ 90 for performance, accessibility, and best practices.
- ☐ Skeleton loaders replace layout-shifting spinners on the main screens.
- ☐ The README shows screenshots, the architecture, the test strategy, and live metrics.

---

## Later

Shot charts · win probability · following and alerts · other leagues (the data model and
feed grouping already allow for this) · news.
