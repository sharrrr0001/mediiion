import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations } from './helpers';

/** UI acceptance: light-only theme, no sideways scroll, accessible public/doctor/admin pages. */
const PUBLIC_PAGES = ['/', '/p/login', '/d/login', '/admin'];

test.describe('light theme only', () => {
  test.use({ colorScheme: 'dark' });
  for (const path of PUBLIC_PAGES) {
    test(`stays white + green with the OS in dark mode: ${path}`, async ({ page }) => {
      await page.goto(path);
      await page.waitForSelector('h1, main');
      const bg = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
      expect(bg).toBe('rgb(255, 255, 255)');
      const scheme = await page.evaluate(() => getComputedStyle(document.documentElement).colorScheme);
      expect(scheme).toBe('light');
    });
  }
});

for (const path of PUBLIC_PAGES) {
  test(`no serious accessibility issues and no horizontal scroll: ${path}`, async ({ page }) => {
    await page.goto(path);
    await page.waitForSelector('h1, main');
    await expectNoSeriousA11yViolations(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('keyboard: the first Tab reaches the skip link with a visible focus ring', async ({ page }) => {
  await page.goto('/');
  await page.keyboard.press('Tab');
  const focused = page.locator(':focus');
  await expect(focused).toHaveAttribute('href', '#main');
  const outline = await focused.evaluate((el) => getComputedStyle(el).outlineStyle);
  expect(outline).not.toBe('none');
});

