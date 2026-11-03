import { expect, test } from '@playwright/test';
import { AppPage, type Section } from '../pages/AppPage';

const SECTIONS: Section[] = ['Games', 'Leagues', 'Following', 'News'];

test.describe('app shell', () => {
  test('loads with the Games screen', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    await expect(app.heading).toHaveText('Courtside');
    await expect(app.nav).toBeVisible();
    await app.expectCurrentSection('Games');
  });

  test('bottom nav navigates to every section', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    for (const section of SECTIONS) {
      await app.openSection(section);

      await expect(page).toHaveURL(new RegExp(`${app.routeFor(section)}$`));
      await expect(app.main).toBeVisible();
      await app.expectCurrentSection(section);
    }
  });

  test('every route is reachable directly, not just by navigation', async ({ page }) => {
    const app = new AppPage(page);

    for (const section of SECTIONS) {
      await app.goto(app.routeFor(section));

      await expect(app.heading).toBeVisible();
      await app.expectCurrentSection(section);
    }
  });

  test('an unknown route renders the not-found screen', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto('/not-a-real-route');

    await expect(app.heading).toHaveText('Not found');
    await expect(app.nav).toBeVisible();
  });

  test('keyboard users reach a skip link before the content', async ({ page }) => {
    const app = new AppPage(page);
    await app.goto();

    await page.keyboard.press('Tab');
    await expect(app.skipLink).toBeFocused();
  });

  test('makes no requests to ESPN — the mock provider needs no network', async ({
    page,
  }) => {
    const external: string[] = [];
    page.on('request', (request) => {
      const url = new URL(request.url());
      if (!['localhost', '127.0.0.1'].includes(url.hostname))
        external.push(request.url());
    });

    const app = new AppPage(page);
    await app.goto();
    await app.openSection('Leagues');

    expect(external).toEqual([]);
  });
});
