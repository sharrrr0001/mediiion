import AxeBuilder from '@axe-core/playwright';
import { expect, type Page } from '@playwright/test';

/** Fictional test number; dev SMS goes to the in-memory outbox only. */
export function testPhone(prefix = '91'): string {
  return `${prefix}${String(Date.now()).slice(-8)}`;
}

export async function readOtp(page: Page, phone: string): Promise<string> {
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

export async function expectNoSeriousA11yViolations(page: Page) {
  // Next 15 streams metadata on dynamic pages; wait for <title> before auditing.
  await expect(page).toHaveTitle(/Medicos/);
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
  const serious = results.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical');
  expect(serious, serious.map((v) => `${v.id}: ${v.help}`).join('\n')).toEqual([]);
}

/** Login → consent → profile, ending on /p/home. */
export async function signUpPatient(page: Page, opts: { name: string; language?: 'en' | 'hi' | 'hi-Latn' }) {
  const phone = testPhone('92');
  await page.goto('/p/login');
  await page.getByLabel('Mobile number').fill(phone);
  await page.getByRole('button', { name: 'Send code' }).click();
  const code = await readOtp(page, phone);
  await page.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(code);
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  await page.getByLabel('I have read this and I agree').check();
  await page.getByRole('button', { name: 'I agree' }).click();
  await page.getByLabel('Full name').fill(opts.name);
  await page.getByLabel('Age', { exact: true }).fill('28');
  await page.getByLabel('City').fill('Indore');
  await page.getByLabel('Male', { exact: true }).check();
  await page.getByLabel('Preferred language').selectOption(opts.language ?? 'en');
  await page.getByRole('button', { name: /Save/ }).click();
  await expect(page).toHaveURL(/\/p\/home$/);
}
