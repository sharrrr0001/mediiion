import { expect, test, type Page } from '@playwright/test';
import { totpNow } from './doctor-db';
import { expectNoSeriousA11yViolations } from './helpers';

/** Doctor self-signup by email (spec §7.2) → 2FA → onboarding checklist, pending until staff verify. */
test.describe.configure({ timeout: 240_000 });

async function emailCode(page: Page, email: string, previous = '') {
  let code = '';
  await expect
    .poll(async () => {
      const res = await page.request.get(`/api/dev/outbox?to=${encodeURIComponent(email)}`);
      code = res.ok() ? ((await res.json()) as { code: string }).code : '';
      // A new code must differ from the previous one still sitting in the outbox.
      return /^\d{6}$/.test(code) && code !== previous;
    }, { timeout: 30_000 })
    .toBe(true);
  return code;
}

test('a doctor signs up, sets up 2FA and sees the onboarding checklist (pending verification)', async ({ page }) => {
  const email = `e2e.doctor.${Date.now()}@example.test`;
  await page.goto('/');
  await page.getByRole('link', { name: 'Create doctor account' }).click();
  await expect(page).toHaveURL(/\/d\/signup/);
  await page.getByRole('tab', { name: /Email/ }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  const firstCode = await emailCode(page, email);
  await page.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(firstCode);
  await page.getByRole('button', { name: 'Verify and continue' }).click();

  await expect(page.getByRole('heading', { name: 'Your details' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
  await page.getByLabel('Full name').fill('Nisha Testverma');
  await page.getByLabel('Specialty').selectOption('dermatology');
  await page.getByLabel('City').fill('Indore');
  await page.getByLabel('Registration number').fill('MP-88888');
  await page.getByLabel('Medical council').fill('Madhya Pradesh Medical Council');
  await page.getByLabel('Degrees').fill('MBBS, MD (Dermatology)');
  await page.getByLabel('Years of experience').fill('5');
  await page.getByRole('button', { name: 'Create account' }).click();

  await expect(page).toHaveURL(/\/d\/login\?registered=1/);
  await expect(page.getByText('Account created. Log in again to set up 2-step verification.')).toBeVisible();
  // Resend wait: the signup code was just sent to this email.
  await page.waitForTimeout(31_000);
  await page.getByRole('tab', { name: /Email/ }).click();
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(await emailCode(page, email, firstCode));
  await page.getByRole('button', { name: 'Verify and continue' }).click();
  const secret = (await page.getByTestId('totp-secret').textContent())!.trim();
  await page.getByRole('group', { name: 'Authenticator code' }).getByRole('textbox').first().fill(totpNow(secret));
  await page.getByRole('button', { name: 'Verify and sign in' }).click();

  // Unverified doctors land on onboarding, never on a patient queue.
  await expect(page).toHaveURL(/\/d\/onboarding/, { timeout: 60_000 });
  await expect(page.getByText(/Verification in progress/)).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Medical licence verification' })).toBeVisible();
  await page.getByLabel('Clinic name').fill('Testverma Skin Clinic');
  await page.getByLabel('Address').fill('7 Test Road');
  await page.getByLabel('City').fill('Indore');
  await page.getByLabel('Consultation fee (₹)').fill('600');
  await page.getByLabel('Follow-up fee (₹)').fill('300');
  await page.getByRole('button', { name: 'Save' }).first().click();
  await expect(page.getByRole('status').filter({ hasText: 'Saved' })).toBeVisible();
  await expectNoSeriousA11yViolations(page);
});
