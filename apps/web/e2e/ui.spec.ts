import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations } from './helpers';

/** UI acceptance: light-only theme, no sideways scroll, accessible public/doctor/admin pages. */
const PUBLIC_PAGES = ['/', '/p/login', '/d/today', '/admin'];

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

test('doctor dashboard: list → detail on phone, A and P left empty for the doctor', async ({ page, isMobile }) => {
  await page.goto('/d/today');
  await page.waitForSelector('h1');
  if (isMobile) {
    await expect(page.getByRole('heading', { name: 'Pre-Visit Summary' })).toBeHidden();
    await page.getByRole('button', { name: /RK · 46 M/ }).click();
    await expect(page.getByRole('button', { name: 'Back to queue' })).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Pre-Visit Summary' })).toBeVisible();
  await expect(page.getByLabel('Assessment')).toHaveValue('');
  await expect(page.getByLabel('Plan / Rx')).toHaveValue('');
  await expect(page.getByText('AI-generated draft. Not a diagnosis or prescription. Treating doctor must review.')).toBeVisible();
});
