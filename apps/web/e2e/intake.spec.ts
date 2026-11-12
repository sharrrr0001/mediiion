import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, signUpPatient } from './helpers';

/** Runs against the dev stack with LLM_PROVIDER=mock (deterministic questions). */
test.describe.configure({ timeout: 180_000 });

async function startInterview(page: Page) {
  await page.getByRole('link', { name: /Start now/ }).click();
  await expect(page).toHaveURL(/\/p\/intake\/new$/);
  await expectNoSeriousA11yViolations(page);
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/intake\/[0-9a-f-]{36}$/);
  await expect(page.getByText(/Am I speaking with Rahul/)).toBeVisible();
}

async function answer(page: Page, text: string) {
  const before = await page.locator('main p').count();
  await page.getByLabel('Type your answer…').fill(text);
  await page.getByRole('button', { name: 'Send' }).click();
  await expect.poll(() => page.locator('main p').count()).toBeGreaterThan(before);
}

test('safety line: fixed text + Call 112, interview continues only when the patient chooses', async ({ page }) => {
  await signUpPatient(page, { name: 'Rahul Mehta' });
  await startInterview(page);
  await page.getByRole('button', { name: 'Yes, it’s me' }).click();
  await page.getByRole('button', { name: 'Yes, start' }).click();
  await expect(page.getByText('What is the main problem you want to see the doctor for?')).toBeVisible();

  await answer(page, 'I get chest pain when I walk fast');
  const card = page.getByRole('alert').filter({ hasText: 'contact emergency services (112)' });
  await expect(card).toBeVisible();
  await expect(card.getByRole('link', { name: 'Call 112' })).toHaveAttribute('href', 'tel:112');
  // No answer box while the safety card waits for the patient's choice.
  await expect(page.getByLabel('Type your answer…')).toHaveCount(0);
  await expectNoSeriousA11yViolations(page);

  await card.getByRole('button', { name: 'I understand, continue' }).click();
  await expect(page.getByText('Since when have you had this?')).toBeVisible();
});

test('full chat interview → What you told us → edit → submit', async ({ page }) => {
  await signUpPatient(page, { name: 'Rahul Mehta' });
  await startInterview(page);
  await page.getByRole('button', { name: 'Yes, it’s me' }).click();
  await page.getByRole('button', { name: 'Yes, start' }).click();
  await expect(page.getByText('Step 1 of 3: Symptoms & history')).toBeAttached();
  await expectNoSeriousA11yViolations(page);

  await answer(page, 'Fever for 2 days, up to 101');
  await page.getByRole('button', { name: '2–3 days' }).click();
  await answer(page, 'What do I have? Which medicine should I take?');
  await expect(page.getByText('That’s a good question for the doctor. I’m noting it down for them.')).toBeVisible();

  // Answer the rest with "Don't know"-style replies until the closing message.
  for (let i = 0; i < 20; i++) {
    if (await page.getByRole('link', { name: 'See what you told us' }).isVisible()) break;
    await answer(page, 'No');
  }
  await page.getByRole('link', { name: 'See what you told us' }).click();
  await expect(page.getByRole('heading', { name: 'What you told us' })).toBeVisible();
  await expect(page.getByText('This is not a diagnosis. Your doctor will check you.')).toBeVisible();
  await expectNoSeriousA11yViolations(page);

  await page.getByRole('button', { name: 'Change' }).first().click();
  await page.getByRole('textbox').first().fill('Fever for 2 days, highest 101°F, with sore throat');
  await page.getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Fever for 2 days, highest 101°F, with sore throat')).toBeVisible();

  await page.getByRole('button', { name: 'Looks right, continue' }).click();
  await expect(page.getByText('Sent. Your doctor will see this before your visit.')).toBeVisible();
});
