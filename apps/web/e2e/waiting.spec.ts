import type { Page } from '@playwright/test';
import { expect, newContext, test } from './test';
import { createVerifiedDoctor, createVisitNow, totpNow } from './doctor-db';
import { expectNoSeriousA11yViolations, readOtp, signUpPatient } from './helpers';

/** Waiting room: patient "I have arrived" (2½-minute lock) → doctor sees it → "Please come in" → patient sees it. */
test.describe.configure({ timeout: 240_000 });

async function doctorSignIn(dr: Page, digits: string) {
  await dr.goto('/d/login');
  await dr.getByLabel('Mobile number').fill(digits);
  await dr.getByRole('button', { name: 'Send code' }).click();
  await dr.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(await readOtp(dr, digits));
  await dr.getByRole('button', { name: 'Verify and continue' }).click();
  const secret = (await dr.getByTestId('totp-secret').textContent())!.trim();
  await dr.getByRole('group', { name: 'Authenticator code' }).getByRole('textbox').first().fill(totpNow(secret));
  await dr.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(dr).toHaveURL(/\/d\/today/, { timeout: 60_000 });
}

test('patient says "I have arrived", the doctor replies "Please come in", the patient sees it', async ({ browser, isMobile }) => {
  const doctor = await createVerifiedDoctor();
  const ctx = () => newContext(browser, isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {});

  const patientCtx = await ctx();
  const patient = await patientCtx.newPage();
  await signUpPatient(patient, { name: 'Rahul Mehta' });
  const me = (await (await patient.request.get('/api/me')).json()) as { profiles: Array<{ medicosId: string }> };
  await createVisitNow(doctor.id, doctor.clinicId, me.profiles[0]!.medicosId);

  await patient.goto('/p/home');
  const card = patient.getByRole('region', { name: 'At the clinic today' });
  await expect(card.getByText(doctor.name)).toBeVisible({ timeout: 20_000 });
  await card.getByRole('button', { name: 'I have arrived' }).click();
  await expect(card.getByText('Checked in. Please wait in the waiting room.')).toBeVisible();
  // No spamming: the next button is locked with a countdown.
  await expect(card.getByRole('button', { name: 'May I come in?' })).toBeDisabled();
  await expect(card.getByText(/You can send again in 2:\d\d/)).toBeVisible();
  await expectNoSeriousA11yViolations(patient);

  const doctorCtx = await ctx();
  const dr = await doctorCtx.newPage();
  await doctorSignIn(dr, doctor.digits);
  const panel = dr.locator('li', { hasText: me.profiles[0]!.medicosId });
  await expect(panel.getByText('Arrived')).toBeVisible({ timeout: 20_000 });
  await panel.getByRole('button', { name: 'Please come in' }).click();
  await expect(panel.getByText('Replied: Come in')).toBeVisible();

  await expect(card.getByText('Please come in now.')).toBeVisible({ timeout: 20_000 });
  await expect(card.getByText('from the doctor')).toBeVisible();

  await patientCtx.close();
  await doctorCtx.close();
});
