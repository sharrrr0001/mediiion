import { expect, test, type Page } from '@playwright/test';
import { expectNoSeriousA11yViolations, signUpPatient } from './helpers';

/**
 * Phase 3 done-when: a voice-only Hinglish interview on a low-end Android profile produces a correct
 * summary. Chromium's fake microphone supplies audio; STT runs on the mock provider (scripted Hinglish).
 */
test.use({
  launchOptions: { args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'] },
  permissions: ['microphone'],
});
test.describe.configure({ timeout: 300_000 });

/** Moto-G-class phone: small screen, 4x slower CPU, slow mobile network. */
async function lowEndAndroid(page: Page) {
  await page.setViewportSize({ width: 360, height: 640 });
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await cdp.send('Network.enable');
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: (1.6 * 1024 * 1024) / 8, uploadThroughput: (750 * 1024) / 8 });
}

/** The patient chose Hinglish, so the mic is labelled in Hinglish. */
const MIC = 'Bolne ke liye daba kar rakhein';

async function speak(page: Page) {
  const mic = page.getByRole('button', { name: MIC });
  await expect(mic).toBeEnabled({ timeout: 30_000 });
  const box = (await mic.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.waitForTimeout(1300);
  await page.mouse.up();
  const card = page.getByRole('region', { name: 'Humne yeh suna:' });
  await expect(card).toBeVisible({ timeout: 30_000 });
  return card;
}

test('voice-only Hinglish interview on a low-end Android profile produces a correct summary', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'low-end Android profile runs in the mobile project');
  await signUpPatient(page, { name: 'Rahul Mehta', language: 'hi-Latn' });
  await lowEndAndroid(page);

  await page.goto('/p/intake/new');
  // On a 4x-slowed CPU, wait until the page is hydrated (doctor list loaded) before tapping.
  await expect(page.locator('#doctor option')).not.toHaveCount(1, { timeout: 60_000 });
  await page.getByText('Bol kar (voice)').click();
  await page.getByRole('button', { name: 'Shuru karein', exact: true }).click();
  await expect(page).toHaveURL(/\/p\/intake\/[0-9a-f-]{36}\?mode=voice$/, { timeout: 60_000 });
  await expect(page.getByRole('button', { name: MIC })).toBeVisible({ timeout: 30_000 });
  await expectNoSeriousA11yViolations(page);

  // First answer: check the confirm card shows what was heard before anything is sent.
  let card = await speak(page);
  await expect(card).toContainText('Haan, main hi hoon');
  await card.getByRole('button', { name: 'Haan, bhejein' }).click();

  const doneLink = page.getByRole('link', { name: /Dekhiye aapne kya bataya/ });
  for (let i = 0; i < 25; i++) {
    // Wait for the next turn to settle: either the mic is back or the interview is finished.
    // (The mic stays visible but disabled while the reply is loading, so wait for it to be ENABLED.)
    await expect
      .poll(async () => (await doneLink.isVisible()) || (await page.getByRole('button', { name: MIC }).isEnabled().catch(() => false)), { timeout: 60_000 })
      .toBe(true);
    if (await doneLink.isVisible()) break;
    card = await speak(page);
    await card.getByRole('button', { name: 'Haan, bhejein' }).click();
    await expect(card).toBeHidden({ timeout: 30_000 });
  }
  await expect(page.getByText('Mujhe do din se bukhar hai, raat ko 101 tak jaata hai')).toBeVisible();

  await page.getByRole('link', { name: /Dekhiye aapne kya bataya/ }).click();
  await page.getByRole('button', { name: /Sahi hai, aage badhein/ }).click();
  await expect(page.getByText(/Bhej diya/)).toBeVisible({ timeout: 60_000 });

  // The summary in the record book cites the spoken (confirmed) Hinglish answers.
  await page.goto('/p/records');
  await page.getByRole('link', { name: /AI pre-visit summary/ }).click();
  await expect(page.getByText(/do din se bukhar hai/).first()).toBeVisible();
});

test('an answer typed offline is saved and sent automatically when back online', async ({ page, context }) => {
  await signUpPatient(page, { name: 'Rahul Mehta' });
  await page.getByRole('link', { name: /Start now/ }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await page.getByRole('button', { name: 'Yes, it’s me' }).click();
  await page.getByRole('button', { name: 'Yes, start' }).click();
  await expect(page.getByText('What is the main problem you want to see the doctor for?')).toBeVisible();

  await context.setOffline(true);
  await page.getByLabel('Type your answer…').fill('Fever since yesterday');
  await page.getByRole('button', { name: 'Send' }).click();
  await expect(page.getByText("Saved. We'll send this as soon as you're back online.")).toBeVisible();

  await context.setOffline(false);
  await expect(page.getByText('Since when have you had this?')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByText("Saved. We'll send this as soon as you're back online.")).toBeHidden();
});
