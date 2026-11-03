import { expect, type Locator, type Page } from '@playwright/test';

/** The games feed. */
export class GamesFeedPage {
  readonly datePicker: Locator;
  readonly calendar: Locator;
  readonly filters: Locator;
  readonly leagueSection: Locator;
  readonly gameRows: Locator;
  readonly disclaimer: Locator;

  constructor(private readonly page: Page) {
    this.datePicker = page.locator('.date-picker');
    this.calendar = page.getByRole('dialog', { name: 'Choose a date' });
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

  /** The bar's centre button: reads "Today" and opens the calendar. */
  get currentDate(): Locator {
    return this.datePicker.locator('.date-picker__current');
  }

  async stepDay(direction: 'Previous' | 'Next'): Promise<void> {
    await this.datePicker.getByRole('button', { name: `${direction} day` }).click();
  }

  async openCalendar(): Promise<void> {
    await this.currentDate.click();
    await this.calendar.waitFor();
  }

  async pageMonth(direction: 'Previous' | 'Next'): Promise<void> {
    await this.calendar.getByRole('button', { name: `${direction} month` }).click();
  }

  /**
   * A day in the month on show, by its number. Matched on the visible glyph
   * rather than the accessible name, which is locale-formatted and would make
   * the spec depend on the browser's locale.
   */
  calendarDay(dayOfMonth: number): Locator {
    return this.calendar.locator('.calendar__day', {
      has: this.page.locator('span[aria-hidden="true"]', {
        hasText: new RegExp(`^${dayOfMonth}$`),
      }),
    });
  }

  monthHeading(): Locator {
    return this.calendar.getByRole('heading');
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
