import { expect, type Locator, type Page } from '@playwright/test';

export type DetailTab = 'Summary' | 'Box score' | 'Plays' | 'Shots';

export class GameDetailPage {
  readonly tabs: Locator;
  readonly backLink: Locator;
  readonly quarters: Locator;

  constructor(private readonly page: Page) {
    this.tabs = page.getByRole('tablist', { name: 'Game sections' });
    this.backLink = page.getByRole('link', { name: 'Back to games' });
    this.quarters = page.getByRole('table');
  }

  async goto(
    gameId: string,
    options: { tab?: string; simTime?: number } = {},
  ): Promise<void> {
    const params = new URLSearchParams();
    if (options.tab) params.set('tab', options.tab);
    if (options.simTime !== undefined) params.set('simTime', String(options.simTime));

    const query = params.toString();
    await this.page.goto(`/game/${gameId}${query ? `?${query}` : ''}`);
    await this.tabs.waitFor();
  }

  tab(name: DetailTab): Locator {
    return this.tabs.getByRole('tab', { name });
  }

  async openTab(name: DetailTab): Promise<void> {
    await this.tab(name).click();
    await expect(this.tab(name)).toHaveAttribute('aria-selected', 'true');
  }

  /** The score heading, which names both teams for assistive tech. */
  scoreline(): Locator {
    return this.page.locator('.game-header__numbers');
  }

  teamChip(abbreviation: string): Locator {
    return this.page.getByRole('button', { name: abbreviation });
  }

  playRows(): Locator {
    return this.page.locator('.plays__row');
  }

  /** The pre-game roster table, which replaces the box score before tip-off. */
  rosterRows(): Locator {
    return this.page.locator('table.roster tbody tr');
  }

  rosterRow(player: string): Locator {
    return this.rosterRows().filter({ hasText: player });
  }

  /** Stat lines once the game has tipped off, as opposed to `rosterRows`. */
  boxScoreRows(): Locator {
    return this.page.locator('table.box-score:not(.roster) tbody tr');
  }

  boxScoreRow(player: string): Locator {
    return this.boxScoreRows().filter({ hasText: player });
  }

  /** The leading `#` cell of a row in either table. */
  jersey(row: Locator): Locator {
    return row.locator('.box-score__jersey');
  }

  /** Each team's quarter values, so a test can check they sum to the total. */
  async quarterTotals(): Promise<{ label: string; cells: number[]; total: number }[]> {
    return this.page.locator('.quarters tbody tr').evaluateAll((rows) =>
      rows.map((row) => {
        const label = row.querySelector('th')?.textContent?.trim() ?? '';
        const values = [...row.querySelectorAll('td')].map((td) =>
          Number(td.textContent?.trim()),
        );
        return { label, cells: values.slice(0, -1), total: values.at(-1) ?? 0 };
      }),
    );
  }
}
