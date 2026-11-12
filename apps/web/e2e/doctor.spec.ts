import { expect, test } from '@playwright/test';
import { createVerifiedDoctor, totpNow } from './doctor-db';
import { expectNoSeriousA11yViolations, readOtp, signUpPatient } from './helpers';

test.describe.configure({ timeout: 240_000 });

test('patient → chosen doctor → summary → finalise → patient record book', async ({ browser, isMobile }) => {
  const doctor = await createVerifiedDoctor();

  // ── Patient: pre-visit with the chosen doctor ──
  const patientCtx = await browser.newContext(isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {});
  const patient = await patientCtx.newPage();
  await signUpPatient(patient, { name: 'Rahul Mehta' });
  await patient.getByRole('link', { name: /Start now/ }).click();
  const option = patient.locator('#doctor option', { hasText: doctor.name });
  await expect(option).toHaveCount(1);
  await patient.getByLabel('Doctor (optional)').selectOption((await option.getAttribute('value'))!);
  await patient.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(patient).toHaveURL(/\/p\/intake\/[0-9a-f-]{36}$/);
  const sessionId = patient.url().split('/').pop()!;
  // Answer through the API for speed (the chat UI itself is covered in intake.spec.ts).
  for (let i = 0; i < 30; i++) {
    const res = await patient.request.post(`/api/intake/sessions/${sessionId}/messages`, { data: { text: i === 2 ? 'Fever for 2 days, up to 101' : 'No' } });
    if ((await res.json()).awaiting === 'done') break;
  }
  await patient.goto(`/p/intake/${sessionId}/review`);
  await patient.getByRole('button', { name: 'Looks right, continue' }).click();
  await expect(patient.getByText('Sent. Your doctor will see this before your visit.')).toBeVisible();

  // ── Doctor: OTP + TOTP enrolment ──
  const doctorCtx = await browser.newContext(isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {});
  const dr = await doctorCtx.newPage();
  await dr.goto('/d/today');
  await expect(dr).toHaveURL(/\/d\/login/);
  await expect(dr.getByRole('heading', { name: 'Doctor login' })).toBeVisible();
  await expectNoSeriousA11yViolations(dr);
  await dr.getByLabel('Mobile number').fill(doctor.digits);
  await dr.getByRole('button', { name: 'Send code' }).click();
  const otp = await readOtp(dr, doctor.digits);
  await dr.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(otp);
  await dr.getByRole('button', { name: 'Verify and continue' }).click();
  await expect(dr.getByRole('heading', { name: 'Set up 2-step verification' })).toBeVisible();
  const secret = (await dr.getByTestId('totp-secret').textContent())!.trim();
  await dr.getByRole('group', { name: 'Authenticator code' }).getByRole('textbox').first().fill(totpNow(secret));
  await dr.getByRole('button', { name: 'Verify and sign in' }).click();
  await expect(dr).toHaveURL(/\/d\/today/);

  // ── Doctor: queue → summary ──
  const row = dr.getByRole('button', { name: /RM · \d+ M/ });
  await expect(row).toBeVisible();
  if (isMobile) await row.click();
  await expect(dr.getByRole('heading', { name: 'Pre-Visit Summary' })).toBeVisible();
  await expect(dr.getByText('AI-generated draft. Not a diagnosis or prescription. Treating doctor must review.')).toBeVisible();
  await expect(dr.getByLabel('Assessment', { exact: true })).toHaveValue('');
  await expect(dr.getByLabel('Plan / Rx', { exact: true })).toHaveValue('');
  await expectNoSeriousA11yViolations(dr);

  // ── Doctor: write A/P + Rx, finalise ──
  await dr.getByLabel('Assessment', { exact: true }).fill('E2E doctor assessment');
  await dr.getByLabel('Plan / Rx', { exact: true }).fill('E2E doctor plan');
  await dr.getByRole('button', { name: 'Add medicine' }).click();
  await dr.getByRole('textbox', { name: 'Medicine', exact: true }).fill('Sample medicine');
  await dr.getByRole('textbox', { name: 'Dose' }).fill('1 tab');
  await dr.getByRole('textbox', { name: 'Frequency' }).fill('Twice daily');
  await dr.getByRole('textbox', { name: 'Duration' }).fill('3 days');
  await dr.getByRole('button', { name: 'Review & finalise' }).click();
  await dr.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
  await expect(dr.getByText('E2E doctor plan')).toBeVisible();
  await dr.getByRole('button', { name: 'Yes' }).click();
  await expect(dr.getByText('Thanks for the feedback.')).toBeVisible();

  // ── Patient: the finalised note is in the record book ──
  await patient.goto('/p/records');
  await patient.getByRole('link', { name: new RegExp(`Visit note · ${doctor.name}`) }).click();
  await expect(patient.getByText('E2E doctor plan')).toBeVisible();
  await expect(patient.getByText('Sample medicine')).toBeVisible();
  await expectNoSeriousA11yViolations(patient);

  await patientCtx.close();
  await doctorCtx.close();
});
