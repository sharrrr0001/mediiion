import { expect, test, type Page } from '@playwright/test';
import { createVerifiedDoctor, totpNow } from './doctor-db';
import { expectNoSeriousA11yViolations, readOtp, signUpPatient } from './helpers';

/**
 * Phase 4 done-when (spec §12): login → AI → summary → book → clinic QR → allow → finalise → record book.
 * AI-first order: the patient talks to the AI, then picks the doctor; the doctor scans the patient's
 * Medicos ID at the clinic and only sees records after the patient taps Allow.
 */
test.describe.configure({ timeout: 300_000 });

async function doctorSignIn(dr: Page, digits: string) {
  await dr.goto('/d/login');
  await dr.getByLabel('Mobile number').fill(digits);
  await dr.getByRole('button', { name: 'Send code' }).click();
  await dr.getByRole('group', { name: '6-digit code' }).getByRole('textbox').first().fill(await readOtp(dr, digits));
  await dr.getByRole('button', { name: 'Verify and continue' }).click();
  const secret = (await dr.getByTestId('totp-secret').textContent())!.trim();
  await dr.getByRole('group', { name: 'Authenticator code' }).getByRole('textbox').first().fill(totpNow(secret));
  await dr.getByRole('button', { name: 'Verify and sign in' }).click();
  // First visit compiles /d/today on the dev server: allow for that.
  await expect(dr).toHaveURL(/\/d\/today/, { timeout: 60_000 });
}

test('Phase 4 journey: AI first → book → clinic QR → allow → finalise → record book', async ({ browser, isMobile }) => {
  const doctor = await createVerifiedDoctor();
  const ctx = () => browser.newContext(isMobile ? { viewport: { width: 412, height: 915 }, isMobile: true, hasTouch: true } : {});

  // ── Patient: AI interview without choosing a doctor ──
  const patientCtx = await ctx();
  const patient = await patientCtx.newPage();
  await signUpPatient(patient, { name: 'Rahul Mehta' });
  await patient.getByRole('link', { name: /Start now/ }).click();
  await patient.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(patient).toHaveURL(/\/p\/intake\/[0-9a-f-]{36}$/);
  const sessionId = patient.url().split('/').pop()!;
  for (let i = 0; i < 30; i++) {
    const res = await patient.request.post(`/api/intake/sessions/${sessionId}/messages`, { data: { text: i === 2 ? 'Fever for 2 days, up to 101' : 'No' } });
    if ((await res.json()).awaiting === 'done') break;
  }
  await patient.goto(`/p/intake/${sessionId}/review`);
  await patient.getByRole('button', { name: 'Looks right, continue' }).click();

  // ── Patient: choose the doctor and book (the summary goes only to them) ──
  await patient.getByRole('link', { name: 'Choose your doctor' }).click();
  await expect(patient).toHaveURL(/\/p\/doctors\?session=/);
  await patient.getByLabel('Area').fill('');
  await patient.getByRole('link', { name: `Select ${doctor.name}` }).click();
  await expect(patient.getByRole('heading', { name: doctor.name })).toBeVisible();
  const times = patient.getByRole('radiogroup', { name: 'Pick a time' }).getByRole('radio');
  if ((await times.count()) === 0) await patient.getByRole('radiogroup', { name: 'Pick a day' }).getByRole('radio').nth(1).click();
  await times.first().click();
  await expectNoSeriousA11yViolations(patient);
  await patient.getByRole('button', { name: 'Book appointment' }).click();
  await expect(patient.getByRole('heading', { name: 'Appointment booked' })).toBeVisible();
  await expect(patient.getByText('Pre-visit summary attached — only shared with your chosen doctor.')).toBeVisible();
  const me = (await (await patient.request.get('/api/me')).json()) as { profiles: Array<{ medicosId: string }> };
  const medicosId = me.profiles[0]!.medicosId;

  // ── Doctor at the clinic: scan / type the Medicos ID → waits for the patient ──
  const doctorCtx = await ctx();
  const dr = await doctorCtx.newPage();
  await doctorSignIn(dr, doctor.digits);
  await dr.getByRole('button', { name: 'Scan QR' }).click();
  const dialog = dr.getByRole('dialog', { name: 'Open a patient’s records' });
  await dialog.getByLabel('Medicos ID').fill(medicosId);
  await dialog.getByRole('button', { name: 'Send request' }).click();
  await expect(dialog.getByText('Waiting for the patient to tap Allow…')).toBeVisible();

  // ── Patient: Allow on the phone ──
  await patient.goto('/p/home');
  const prompt = patient.getByRole('dialog', { name: 'Access request' });
  await expect(prompt.getByText(`${doctor.name} wants to see Rahul Mehta’s records for today’s visit.`)).toBeVisible({ timeout: 20_000 });
  await prompt.getByRole('button', { name: 'Allow' }).click();
  await expect(patient.getByText('Allowed. The doctor can see your records for 24 hours.')).toBeVisible();

  // ── Doctor: records open; finalise from today's queue ──
  await dialog.getByRole('link', { name: 'Open records' }).click({ timeout: 20_000 });
  await expect(dr.getByRole('heading', { name: 'Patient records' })).toBeVisible();
  await expect(dr.getByText(/AI pre-visit summary/)).toBeVisible();
  await dr.goto('/d/today');
  const row = dr.getByRole('button', { name: /RM · \d+ M/ }).first();
  await expect(row).toBeVisible();
  await row.click();
  await dr.getByLabel('Assessment', { exact: true }).fill('Phase 4 doctor assessment');
  await dr.getByLabel('Plan / Rx', { exact: true }).fill('Phase 4 doctor plan');
  await dr.getByRole('button', { name: 'Review & finalise' }).click();
  await dr.getByRole('dialog').getByRole('button', { name: 'Finalise' }).click();
  await expect(dr.getByText('Phase 4 doctor plan')).toBeVisible();

  // ── Patient: the finalised note is in the record book; access is listed and can be stopped ──
  await patient.goto('/p/records');
  await patient.getByRole('link', { name: new RegExp(`Visit note · ${doctor.name}`) }).click();
  await expect(patient.getByText('Phase 4 doctor plan')).toBeVisible();
  await patient.goto('/p/access');
  await expect(patient.getByText('You allowed a QR scan')).toBeVisible();
  await patient.getByRole('button', { name: 'Stop access' }).first().click();
  await expectNoSeriousA11yViolations(patient);

  await patientCtx.close();
  await doctorCtx.close();
});
