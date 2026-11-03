# Courtside

A FotMob-style NBA scores web app. Portfolio project demonstrating SDET practice:
test strategy, automation at every level, CI/CD, and contract testing.

## Stack

Vite · React · TypeScript (strict) · React Router · TanStack Query · Zod
Plain CSS with design tokens as CSS variables — no UI kit.
Vitest + React Testing Library · Playwright · GitHub Actions · Vercel

## Structure

```
src/app/         router, providers, App shell
src/components/  shared UI
src/features/    one folder per route: games, leagues, following, news
src/data/        provider interface, domain types, Zod schemas, mock/
src/styles/      tokens.css, global.css
src/test/        setup, render helpers
e2e/pages/       Playwright Page Objects
e2e/tests/       Playwright specs
api/             Vercel serverless functions (ESPN proxy, M2+)
docs/            PLAN.md, TEST_PLAN.md, NOTES.md, design/
```

## Commands

```
npm run dev          vite dev server
npm run build        typecheck + production build
npm run typecheck    tsc --noEmit
npm run lint         eslint
npm run format       prettier --write
npm run test:unit    vitest run
npm run test:watch   vitest
npm run test:e2e     playwright test
npm run test:e2e:ui  playwright test --ui
```

## Conventions

**Data.** Every external response is parsed with Zod at the boundary in `src/data/`.
Provider shapes never leak past that folder — components only see our domain types
from `src/data/types.ts`. All data access goes through the `DataProvider` interface;
`getProvider()` picks the implementation from `VITE_DATA_PROVIDER` and defaults to
mock, so a fresh clone and CI run with no network.

**The browser never calls ESPN directly.** Requests go through the Vercel function in
`api/`, which fetches, caches, validates, and logs the field that broke on failure.

**TypeScript.** Strict. No `any`, no non-null `!` assertions. Prefer discriminated
unions over optional-field soup for things like game status.

**CSS.** Mobile-first. Colors, spacing, radii, and fonts come from CSS variables in
`src/styles/tokens.css` — no hardcoded hex anywhere else. Component styles live in a
`.css` file next to the component.

**Testing.** Every feature ships with tests. Query by role, label, or text; reach for
`data-testid` only when no accessible query can target the element. Page Objects for
all e2e specs — no raw selectors in a spec file. Tests must be deterministic: no
`waitForTimeout`, no dependence on wall-clock time (inject the clock instead).

**Mock live game.** One fixture simulates a game advancing in real time. Its state is
derived from an injected clock plus an offset, settable with `?simOffset=<ms>` or
`VITE_SIM_OFFSET`, so tests jump to any point — live, halftime, final — instantly.

**Git.** One feature branch and PR per milestone, small commits with clear messages.
Run typecheck, lint, and all tests locally before claiming anything is done.

**Docs.** Update `docs/NOTES.md` at the end of each milestone with test counts, CI
times, and any bug the tests caught. Keep acceptance criteria in `docs/PLAN.md` and
the traceability table in `docs/TEST_PLAN.md` current as features land.

## Scope

NBA only. The data model carries a `league` field and the feed groups by league so
other competitions are a data change, not a refactor.

## Attribution

Data comes from ESPN's unofficial, undocumented endpoints. Not affiliated with or
endorsed by the NBA or ESPN. Non-commercial portfolio project.
