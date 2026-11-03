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

  test('stepping a day updates the URL @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    await expect(feed.currentDate).toContainText('Today');
    await feed.stepDay('Previous');

    await expect(page).toHaveURL(/date=\d{4}-\d{2}-\d{2}/);
    await expect(feed.currentDate).toContainText('Yesterday');
    await expect(feed.leagueSection).toBeVisible();
  });

  test('stepping back and forward returns to today @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    await feed.stepDay('Next');
    await expect(feed.currentDate).toContainText('Tomorrow');

    await feed.stepDay('Previous');
    await expect(feed.currentDate).toContainText('Today');
  });

  // These two pin ?date= to a fixed day rather than starting from today, so
  // the month on show and the day they click are the same whatever the wall
  // clock says when CI runs them.
  test('picking a date from the calendar loads it @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await page.goto('/?date=2026-11-20');
    await feed.leagueSection.waitFor();

    await feed.openCalendar();
    await feed.calendarDay(15).click();

    await expect(feed.calendar).toBeHidden();
    await expect(page).toHaveURL(/date=2026-11-15/);
    await expect(feed.leagueSection).toBeVisible();
  });

  test('pages the calendar a month at a time @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await page.goto('/?date=2026-11-20');
    await feed.leagueSection.waitFor();

    await feed.openCalendar();
    await expect(feed.monthHeading()).toHaveText(/November 2026/);

    await feed.pageMonth('Next');
    await expect(feed.monthHeading()).toHaveText(/December 2026/);

    // Paging the view alone must not load a different day.
    await expect(page).toHaveURL(/date=2026-11-20/);

    await feed.pageMonth('Previous');
    await expect(feed.monthHeading()).toHaveText(/November 2026/);
  });

  test('closes the calendar on Escape @regression', async ({ page }) => {
    const feed = new GamesFeedPage(page);
    await feed.goto(simTime.thirdQuarter);

    await feed.openCalendar();
    await page.keyboard.press('Escape');

    await expect(feed.calendar).toBeHidden();
    await expect(feed.currentDate).toBeFocused();
  });

  test('ignores a malformed date rather than breaking @regression', async ({ page }) => {
    await page.goto('/?date=2026-13-45');

    // Falls back to today, so the picker still renders and games still load.
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
