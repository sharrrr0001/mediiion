import { expect, test } from '@playwright/test';
import { expectNoSeriousA11yViolations, signUpPatient } from './helpers';

/** First login by OTP → "Set a password" popup → log out → "I already have an account" with mobile + password. */
test.describe.configure({ timeout: 180_000 });

test('after the first OTP login the patient sets a password, then logs in with it', async ({ page }) => {
  const phone = await signUpPatient(page, { name: 'Rahul Mehta' });

  const dialog = page.getByRole('dialog', { name: 'Set a password' });
  await expect(dialog).toBeVisible({ timeout: 20_000 });
  await expectNoSeriousA11yViolations(page);
  await dialog.getByLabel('New password').fill('Mango2026walk');
  await dialog.getByLabel('Confirm password').fill('Mango2026wal');
  await dialog.getByRole('button', { name: 'Save password' }).click();
  await expect(dialog.getByText('Passwords do not match')).toBeVisible();
  await dialog.getByLabel('Confirm password').fill('Mango2026walk');
  await dialog.getByRole('button', { name: 'Save password' }).click();
  await expect(dialog).toBeHidden();

  // Log out, then use "I already have an account".
  await page.request.post('/api/auth/logout', { headers: { Origin: new URL(page.url()).origin } });
  await page.goto('/p/login');
  await page.getByRole('tab', { name: 'I already have an account' }).click();
  await page.getByLabel('Email or mobile number').fill(phone);
  await page.getByLabel('Password', { exact: true }).fill('wrong-pass-9');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page.getByText(/Email or password is wrong/)).toBeVisible();
  await page.getByLabel('Password', { exact: true }).fill('Mango2026walk');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/p\/home$/, { timeout: 30_000 });
  await expect(page.getByRole('dialog', { name: 'Set a password' })).toBeHidden();

  // Next visit on this device opens on the password tab.
  await page.request.post('/api/auth/logout', { headers: { Origin: new URL(page.url()).origin } });
  await page.goto('/p/login');
  await expect(page.getByRole('tab', { name: 'I already have an account' })).toHaveAttribute('aria-selected', 'true');
});
