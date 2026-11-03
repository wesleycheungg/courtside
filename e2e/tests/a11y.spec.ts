import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
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
      return `${el.tagName}:${el.getAttribute('href') ?? el.textContent?.slice(0, 20) ?? ''}`;
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
