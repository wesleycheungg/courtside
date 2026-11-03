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
CI:       first run pending
```

Bugs caught by tests:

- **Play-by-play ordering assertion was inverted.** The period clock counts
  down, so a newest-first list has _ascending_ seconds remaining. The test as
  first written would have passed on a wrongly-ordered feed. Caught at unit
  level before any UI consumed it.
- **Redundant accessible text on the active nav tab.** A visually-hidden
  "(current section)" span duplicated what `aria-current` already conveys, and
  the accessible-name assertion failing is what surfaced it. The span came out.

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
