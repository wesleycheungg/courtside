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
