import { expect, test } from '@playwright/test';
import { simTime } from '../support/simClock';

/**
 * Snapshots of the main screens at both viewports.
 *
 * Every screen is pinned with `?simTime=` where a live game is involved, so
 * the simulated clock cannot shift a pixel between runs. Animations are
 * disabled and the mock provider is deterministic, which is what makes these
 * safe to diff.
 *
 * Baselines are platform-specific: font rasterisation on macOS and Linux
 * differ enough to blow past any sane tolerance. The committed baselines are
 * macOS, so `npm run test:visual` is a local check and the main CI e2e run
 * excludes this file via `--grep-invert @visual`.
 *
 * To add Linux baselines, run the `visual-baselines` workflow, download the
 * artifact, and commit it. CI can then run this suite too.
 *
 * Refresh deliberately with `npm run test:visual:update` and review the diff
 * like any other change.
 */

const SCREENS = [
  { name: 'games-feed', path: `/?simTime=${simTime.thirdQuarter}` },
  { name: 'games-feed-final', path: `/?simTime=${simTime.afterFullTime}` },
  {
    name: 'game-summary',
    path: `/game/sim-live-nyk-bos?simTime=${simTime.thirdQuarter}`,
  },
  { name: 'game-boxscore', path: '/game/mock-final-gsw-okc?tab=boxscore' },
  {
    name: 'game-plays',
    path: '/game/sim-live-nyk-bos?tab=plays&simTime=' + simTime.thirdQuarter,
  },
  { name: 'game-shots', path: '/game/mock-final-gsw-okc?tab=shots' },
  { name: 'standings-east', path: '/leagues' },
  { name: 'standings-west', path: '/leagues?conf=west' },
  { name: 'player', path: '/player/tatum' },
];

for (const screen of SCREENS) {
  test(`${screen.name} looks right @visual @regression`, async ({ page }, testInfo) => {
    await page.goto(screen.path);
    await page.getByRole('main').waitFor();
    await page.waitForLoadState('networkidle');

    await expect(page).toHaveScreenshot(`${screen.name}-${testInfo.project.name}.png`, {
      fullPage: true,
      animations: 'disabled',
      // Font rasterisation differs between a local mac and CI's linux, so a
      // tiny per-pixel tolerance keeps these from crying wolf.
      maxDiffPixelRatio: 0.02,
    });
  });
}
