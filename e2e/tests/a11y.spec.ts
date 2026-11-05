import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { GamesFeedPage } from '../pages/GamesPage';
import { simTime } from '../support/simClock';

/**
 * Fails on serious and critical violations only. Minor and moderate findings
 * are reported in the attachment but do not block — they are tracked in
 * docs/NOTES.md rather than silently suppressed.
 */
async function scan(
  page: Page,
  testInfo: { attach: (name: string, body: string) => void },
) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  testInfo.attach(
    'axe',
    JSON.stringify(
      results.violations.map((v) => ({
        id: v.id,
        impact: v.impact,
        nodes: v.nodes.length,
        help: v.help,
      })),
      null,
      2,
    ),
  );

  return results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );
}

const SCREENS = [
  { name: 'games feed', path: `/?simTime=${simTime.thirdQuarter}` },
  {
    name: 'game detail — summary',
    path: `/game/sim-live-nyk-bos?simTime=${simTime.thirdQuarter}`,
  },
  { name: 'game detail — box score', path: '/game/mock-final-gsw-okc?tab=boxscore' },
  {
    name: 'game detail — pre-game roster',
    path: '/game/mock-sched-cle-mil?tab=boxscore',
  },
  { name: 'game detail — plays', path: '/game/mock-final-gsw-okc?tab=plays' },
  { name: 'game detail — shots', path: '/game/mock-final-gsw-okc?tab=shots' },
  { name: 'standings', path: '/leagues' },
  { name: 'player', path: '/player/tatum' },
  { name: 'not found', path: '/nope' },
];

for (const screen of SCREENS) {
  test(`${screen.name} has no serious or critical a11y violations @regression`, async ({
    page,
  }, testInfo) => {
    await page.goto(screen.path);
    // Let the query settle so the scan sees real content, not a spinner.
    await page.getByRole('main').waitFor();
    await page.waitForLoadState('networkidle');

    const blocking = await scan(page, {
      attach: (name, body) =>
        void testInfo.attach(name, { body, contentType: 'application/json' }),
    });

    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
  });
}

/**
 * The calendar only exists once opened, so the path-driven scans above never
 * see it. Its grid is the densest markup in the app and the easiest to get
 * wrong, which makes it worth a scan of its own.
 */
test('the open calendar has no serious or critical a11y violations @regression', async ({
  page,
}, testInfo) => {
  const feed = new GamesFeedPage(page);
  await feed.goto(simTime.thirdQuarter);
  await feed.openCalendar();

  const blocking = await scan(page, {
    attach: (name, body) =>
      void testInfo.attach(name, { body, contentType: 'application/json' }),
  });

  expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
});

test('every interactive element is reachable by keyboard @regression', async ({
  page,
}) => {
  await page.goto(`/?simTime=${simTime.thirdQuarter}`);
  await page.getByRole('heading', { name: 'NBA' }).waitFor();

  const interactive = await page
    .locator('a[href], button:not([disabled])')
    .evaluateAll((els) => els.length);

  const reached = new Set<string>();
  for (let i = 0; i < interactive + 5; i += 1) {
    await page.keyboard.press('Tab');
    const id = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      // aria-label comes before textContent: the date picker's arrows are
      // icon-only, so without it they share an empty identity and two
      // genuinely distinct tab stops collapse into one.
      const name =
        el.getAttribute('href') ??
        el.getAttribute('aria-label') ??
        el.textContent?.slice(0, 20) ??
        '';
      return `${el.tagName}:${name}`;
    });
    if (id) reached.add(id);
  }

  // Tab order should reach essentially everything focusable on the screen.
  expect(reached.size).toBeGreaterThanOrEqual(interactive);
});

test('focus is always visible @regression', async ({ page }) => {
  await page.goto('/leagues');
  await page.keyboard.press('Tab');

  const outline = await page.evaluate(() => {
    const el = document.activeElement;
    if (!el) return null;
    const style = getComputedStyle(el);
    return { width: style.outlineWidth, style: style.outlineStyle };
  });

  expect(outline?.style).not.toBe('none');
  expect(parseFloat(outline?.width ?? '0')).toBeGreaterThan(0);
});
