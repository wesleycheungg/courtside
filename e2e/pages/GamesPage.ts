import { expect, type Locator, type Page } from '@playwright/test';

/** The games feed. */
export class GamesFeedPage {
  readonly dateStrip: Locator;
  readonly filters: Locator;
  readonly leagueSection: Locator;
  readonly gameRows: Locator;
  readonly disclaimer: Locator;

  constructor(private readonly page: Page) {
    this.dateStrip = page.getByRole('group', { name: 'Select a date' });
    this.filters = page.getByRole('group', { name: 'Filter games' });
    this.leagueSection = page.getByRole('heading', { name: 'NBA' });
    this.gameRows = page.locator('.game-row');
    this.disclaimer = page.getByText(/Sample data|Unofficial data from ESPN/);
  }

  /** @param simTime absolute epoch ms, pinning the simulated game's state. */
  async goto(simTime?: number): Promise<void> {
    const query = simTime === undefined ? '' : `?simTime=${simTime}`;
    await this.page.goto(`/${query}`);
    await this.leagueSection.waitFor();
  }

  filterChip(name: 'All' | RegExp): Locator {
    return this.filters.getByRole('button', { name });
  }

  async chooseFilter(name: 'All' | RegExp): Promise<void> {
    await this.filterChip(name).click();
  }

  dateButton(index: number): Locator {
    return this.dateStrip.getByRole('button').nth(index);
  }

  /** Rows whose status column reads Live. */
  liveRows(): Locator {
    return this.gameRows.filter({ hasText: 'Live' });
  }

  async openFirstGame(): Promise<void> {
    await this.gameRows.first().click();
    await this.page.waitForURL('**/game/**');
  }

  async expectLiveCount(count: number): Promise<void> {
    await expect(this.filterChip(new RegExp(`^Live \\(${count}\\)$`))).toBeVisible();
  }
}
