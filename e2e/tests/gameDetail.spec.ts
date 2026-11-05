import { expect, test } from '@playwright/test';
import { GameDetailPage } from '../pages/GameDetailPage';
import { simTime } from '../support/simClock';

const SIM_GAME = 'sim-live-nyk-bos';
const FINAL_GAME = 'mock-final-gsw-okc';
const OT_GAME = 'mock-final-ot-den-lal';
const SCHEDULED_GAME = 'mock-sched-cle-mil';

test.describe('game detail', () => {
  test('opens on the summary tab @smoke', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(FINAL_GAME);

    await expect(detail.tab('Summary')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('Linescore')).toBeVisible();
  });

  test('moves between all four tabs @smoke', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(FINAL_GAME);

    for (const tab of ['Box score', 'Plays', 'Shots', 'Summary'] as const) {
      await detail.openTab(tab);
    }
  });

  test('keeps the open tab across a reload @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(FINAL_GAME);

    await detail.openTab('Plays');
    await expect(page).toHaveURL(/tab=plays/);

    await page.reload();
    await expect(detail.tab('Plays')).toHaveAttribute('aria-selected', 'true');
  });

  test('each team s quarter scores sum to its total @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(FINAL_GAME);

    const rows = await detail.quarterTotals();
    expect(rows).toHaveLength(2);

    for (const row of rows) {
      const sum = row.cells.reduce((a, b) => a + b, 0);
      expect(sum, `${row.label} quarters should sum to its total`).toBe(row.total);
    }
  });

  test('an overtime game includes its extra period @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(OT_GAME);

    await expect(page.getByRole('columnheader', { name: 'OT1' })).toBeVisible();

    const rows = await detail.quarterTotals();
    for (const row of rows) {
      expect(row.cells).toHaveLength(5);
      expect(row.cells.reduce((a, b) => a + b, 0)).toBe(row.total);
    }
  });

  test('box score switches between teams @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(FINAL_GAME, { tab: 'boxscore' });

    await expect(detail.teamChip('OKC')).toBeVisible();
    await detail.teamChip('GSW').click();

    await expect(page.getByRole('link', { name: 'S. Curry' })).toBeVisible();
  });

  test('a pre-game box score lists the roster with season averages @regression', async ({
    page,
  }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(SCHEDULED_GAME, { tab: 'boxscore' });

    // The home side, so the Bucks roster from the fixtures.
    await expect(detail.rosterRows()).toHaveCount(8);
    await expect(page.getByText('Season averages')).toBeVisible();
    for (const column of ['PTS', 'REB', 'AST', 'FG%']) {
      await expect(page.getByRole('columnheader', { name: column })).toBeVisible();
    }

    // Best scorer first, and the player with no games played dashed out last.
    await expect(detail.rosterRows().first()).toContainText('G. Antetokounmpo');
    await expect(detail.rosterRows().last()).toContainText('C. Livingston');
    await expect(detail.rosterRow('C. Livingston')).toContainText('—');
  });

  test('the team chip switches rosters before tip-off @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(SCHEDULED_GAME, { tab: 'boxscore' });

    await expect(page.getByRole('link', { name: 'D. Lillard' })).toBeVisible();
    await detail.teamChip('CLE').click();

    await expect(page.getByRole('link', { name: 'D. Mitchell' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'D. Lillard' })).toBeHidden();
  });

  test('a box score row opens that player @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(SIM_GAME, { tab: 'boxscore', simTime: simTime.thirdQuarter });

    await page.getByRole('link', { name: 'J. Tatum' }).click();

    await expect(page).toHaveURL(/\/player\/tatum/);
    await expect(page.getByRole('heading', { name: 'Jayson Tatum' })).toBeVisible();
  });

  test('plays are newest first with a running score @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(SIM_GAME, { tab: 'plays', simTime: simTime.thirdQuarter });

    await expect(detail.playRows().first()).toContainText('4:12');
    await expect(detail.playRows().first()).toContainText('82-87');
  });

  test('the shots tab explains itself rather than showing nothing @regression', async ({
    page,
  }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(FINAL_GAME, { tab: 'shots' });

    await expect(page.getByText(/Shot charts need per-shot coordinates/)).toBeVisible();
  });

  test('an unknown game reports a failure with a way back @regression', async ({
    page,
  }) => {
    await page.goto('/game/not-a-game');

    await expect(page.getByRole('alert')).toContainText('Unknown game');
    await expect(page.getByRole('link', { name: 'Back to games' })).toBeVisible();
  });

  test('a live game shows its period and clock @regression', async ({ page }) => {
    const detail = new GameDetailPage(page);
    await detail.goto(SIM_GAME, { simTime: simTime.thirdQuarter });

    await expect(page.getByText(/Q3 · \d{1,2}:\d{2}/)).toBeVisible();
  });
});

test.describe('standings', () => {
  test('shows both conferences @smoke', async ({ page }) => {
    await page.goto('/leagues');

    await expect(page.getByRole('button', { name: 'East' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('table')).toBeVisible();

    await page.getByRole('button', { name: 'West' }).click();
    await expect(page).toHaveURL(/conf=west/);
  });

  test('marks playoff and play-in seeds for assistive tech @regression', async ({
    page,
  }) => {
    await page.goto('/leagues');

    const rows = page.locator('.standings tbody tr');
    await expect(rows).toHaveCount(15);
    await expect(rows.nth(0)).toContainText('Playoff position');
    await expect(rows.nth(6)).toContainText('Play-in position');
    await expect(rows.nth(10)).not.toContainText('position');
  });

  test('games behind is zero for the leader and rises down the table @regression', async ({
    page,
  }) => {
    await page.goto('/leagues');

    const gb = await page
      .locator('.standings tbody tr')
      .evaluateAll((rows) =>
        rows.map((row) => row.querySelectorAll('td')[3]?.textContent?.trim() ?? ''),
      );

    expect(gb[0]).toBe('—');
    expect(Number(gb[14])).toBeGreaterThan(Number(gb[1]));
  });
});

test.describe('player', () => {
  test('shows averages, log and splits @smoke', async ({ page }) => {
    await page.goto('/player/tatum');

    await expect(page.getByRole('heading', { name: 'Jayson Tatum' })).toBeVisible();
    await expect(page.getByText('Season averages')).toBeVisible();
    await expect(page.getByText('Game log')).toBeVisible();
    await expect(page.getByText('Shooting')).toBeVisible();
  });

  test('an unknown player reports a failure @regression', async ({ page }) => {
    await page.goto('/player/nobody');

    await expect(page.getByRole('alert')).toContainText('Unknown player');
  });
});
