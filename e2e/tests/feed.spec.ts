import { expect, test } from '@playwright/test';
import { GamesFeedPage } from '../pages/GamesPage';
import { GameDetailPage } from '../pages/GameDetailPage';
import { simTime } from '../support/simClock';

test.describe('games feed', () => {
  test('shows the slate grouped under a league header @smoke', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    await expect(feed.leagueSection).toBeVisible();
    await expect(feed.gameRows).toHaveCount(5);
    await expect(feed.disclaimer).toBeVisible();
  });

  test('orders live games before finals and scheduled @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    const statuses = await feed.gameRows.evaluateAll((rows) =>
      rows.map((row) => row.querySelector('.game-row__status')?.textContent ?? ''),
    );

    const firstFinal = statuses.findIndex((s) => s.includes('Final'));
    const firstScheduled = statuses.findIndex(
      (s) => /\d{1,2}:\d{2}/.test(s) && !s.includes('Live'),
    );

    expect(statuses[0]).toContain('Live');
    expect(firstFinal).toBeGreaterThan(0);
    expect(firstScheduled).toBeGreaterThan(firstFinal);
  });

  test('filters to live games and back @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    await feed.expectLiveCount(1);
    await feed.chooseFilter(/^Live/);

    await expect(feed.gameRows).toHaveCount(1);
    await expect(page).toHaveURL(/filter=live/);

    await feed.chooseFilter('All');
    await expect(feed.gameRows).toHaveCount(5);
  });

  test('says so when a filter matches nothing @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    // Past full time, nothing is live.
    await feed.goto(simTime.afterFullTime);

    await feed.chooseFilter('All');
    await feed.chooseFilter(/^Live$/);

    await expect(page.getByText('No games are live right now.')).toBeVisible();
  });

  test('selecting a date updates the URL @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    await feed.dateButton(0).click();

    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    await expect(feed.leagueSection).toBeVisible();
  });

  test('ignores a malformed date rather than breaking @regression', async ({ page }) => {
    await page.goto('/?date=2026-13-45');

    // Falls back to today, so the strip still renders and games still load.
    await expect(page.getByRole('heading', { name: 'NBA' })).toBeVisible();
    await expect(page.getByText('Today')).toBeVisible();
  });

  test('opens a game from the feed @smoke', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);
    await feed.openFirstGame();

    const detail = new GameDetailPage(page);
    await expect(detail.tabs).toBeVisible();
  });
});

test.describe('simulated live game', () => {
  test('reports live mid-game and final afterwards @smoke', async ({ page }) => {
    const feed = new GamesFeedPage(page);

    await feed.goto(simTime.thirdQuarter);
    await expect(feed.liveRows()).toHaveCount(1);

    // Same game, clock pinned past the end of its timeline.
    await feed.goto(simTime.afterFullTime);
    await expect(feed.liveRows()).toHaveCount(0);
  });

  test('advances the score as the clock moves @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);

    const scoreAt = async (at: number) => {
      await feed.goto(at);
      const text = await feed.gameRows.first().innerText();
      return [...text.matchAll(/\b\d{1,3}\b/g)].map((m) => Number(m[0]));
    };

    const early = await scoreAt(simTime.firstQuarter);
    const late = await scoreAt(simTime.fourthQuarter);

    expect(Math.max(...late)).toBeGreaterThan(Math.max(...early));
  });

  test('shows halftime without a running clock @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.halftime);

    await expect(feed.gameRows.first()).toContainText('Half');
  });
});
