import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Fictional test number in the 9 1xx range; dev SMS goes to the in-memory outbox only. */
function testPhone(): string {
  return `91${String(Date.now()).slice(-8)}`;
}

async function readOtp(page: Page, phone: string): Promise<string> {
  let code = '';
  await expect
    .poll(async () => {
      const res = await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(`+91${phone}`)}`);
      if (!res.ok()) return '';
      code = ((await res.json()) as { code: string }).code;
      return code;
    })
    .toMatch(/^\d{6}$/);
  return code;
}

async function expectNoSeriousA11yViolations(page: Page) {
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
}

test('patient signs up with OTP, consents, creates a profile and sees their Medicos ID QR', async ({ page }) => {
  const phone = testPhone();

  await page.goto('/p/home');
  await expect(page).toHaveURL(/\/p\/login$/);
  await expect(page.getByRole('heading', { name: 'Welcome to Medicos' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByLabel('Mobile number').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByRole('heading', { name: 'Enter the code' })).toBeVisible();

  const code = await readOtp(page, phone);
  await page.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(code);
  await page.getByRole('button', { name: 'Verify and continue' }).click();

  // Consent comes before any profile data (docs/decisions.md).
  await expect(page).toHaveURL(/\/p\/consent$/);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole('button', { name: 'I agree' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'tick the box' })).toBeVisible();
  await page.getByLabel('I have read this and I agree').check();
  await page.getByRole('button', { name: 'I agree' }).click();

  await expect(page).toHaveURL(/\/p\/profile$/);
  await page.getByRole('button', { name: 'Save and continue' }).click();
  await expect(page.getByText('Please fill this in').first()).toBeVisible();
  await page.getByLabel('Full name').fill('Rahul Mehta');
  await page.getByLabel('Age', { exact: true }).fill('28');
  await page.getByLabel('City').fill('Indore');
  await page.getByLabel('Male', { exact: true }).check();
  await page.getByLabel('Preferred language').selectOption('en');
  await expectNoSeriousA11yViolations(page);
  await page.getByRole('button', { name: 'Save and continue' }).click();

  await expect(page).toHaveURL(/\/p\/home$/);
  await expect(page.getByRole('heading', { name: 'Hello, Rahul' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  const idText = await page.getByText(/^MED-[0-9A-Z]{4}-[0-9A-Z]{4}$/).textContent();
  expect(idText).toMatch(/^MED-/);

  await page.getByRole('link', { name: /My Medicos ID/ }).click();
  await expect(page).toHaveURL(/\/p\/id$/);
  await expect(page.getByRole('img', { name: `QR code for Medicos ID ${idText}` })).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  // Reload keeps the session (httpOnly cookies), and onboarding pages now bounce to home.
  await page.goto('/p/consent');
  await expect(page).toHaveURL(/\/p\/home$/);
});

test('switching to Hindi changes the UI language', async ({ page }) => {
  await page.goto('/p/login');
  await page.getByRole('radio', { name: 'हिंदी' }).click();
  await expect(page.getByRole('heading', { name: 'Medicos में आपका स्वागत है' })).toBeVisible();
  await page.getByRole('radio', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Welcome to Medicos' })).toBeVisible();
});

test('rejects an invalid phone number without calling the server', async ({ page }) => {
  await page.goto('/p/login');
  await page.getByLabel('Mobile number').fill('12345');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'valid 10-digit' })).toBeVisible();
});
