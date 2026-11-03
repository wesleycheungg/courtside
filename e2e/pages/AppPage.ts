import { expect, type Locator, type Page } from '@playwright/test';

export type Section = 'Games' | 'Leagues' | 'Following' | 'News';

/** Route each nav section lands on, used to assert navigation actually moved. */
const ROUTES: Record<Section, string> = {
  Games: '/',
  Leagues: '/leagues',
  Following: '/following',
  News: '/news',
};

/**
 * The app shell: the bottom nav and the main content region, which every screen
 * shares. Screen-specific Page Objects arrive alongside their screens.
 */
export class AppPage {
  readonly nav: Locator;
  readonly main: Locator;
  readonly heading: Locator;
  readonly skipLink: Locator;

  constructor(private readonly page: Page) {
    this.nav = page.getByRole('navigation', { name: 'Main' });
    this.main = page.getByRole('main');
    this.heading = page.getByRole('heading', { level: 1 });
    this.skipLink = page.getByRole('link', { name: 'Skip to content' });
  }

  async goto(path = '/'): Promise<void> {
    await this.page.goto(path);
  }

  navLink(section: Section): Locator {
    return this.nav.getByRole('link', { name: section });
  }

  async openSection(section: Section): Promise<void> {
    await this.navLink(section).click();
    await this.page.waitForURL(`**${ROUTES[section]}`);
  }

  /** Asserts the given section is the one marked current. */
  async expectCurrentSection(section: Section): Promise<void> {
    await expect(this.navLink(section)).toHaveAttribute('aria-current', 'page');
  }

  routeFor(section: Section): string {
    return ROUTES[section];
  }
}
