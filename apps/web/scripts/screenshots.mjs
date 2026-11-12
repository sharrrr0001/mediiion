/**
 * UI review screenshots + overflow check. Fictional data only.
 * Usage: node apps/web/scripts/screenshots.mjs <before|after> [baseUrl]
 * Browser runs in DARK colour scheme on purpose: the site must still be white + green.
 */
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const label = process.argv[2] ?? 'after';
const base = process.argv[3] ?? 'http://localhost:3001';
const out = resolve(import.meta.dirname, '../../../docs/screenshots/ui-upgrade', label);
mkdirSync(out, { recursive: true });

const SIZES = { phone: [390, 844], tablet: [768, 1024], laptop: [1440, 900] };
const OVERFLOW_WIDTHS = [360, 390, 768, 1024, 1440, 1920];
const overflow = [];

const browser = await chromium.launch();
const ctx = await browser.newContext({ colorScheme: 'dark', deviceScaleFactor: 1 });
const page = await ctx.newPage();
const api = (path, data) => page.request.post(`${base}/api${path}`, { data, headers: { Origin: base } });

async function shoot(name) {
  for (const [size, [w, h]] of Object.entries(SIZES)) {
    await page.setViewportSize({ width: w, height: h });
    await page.waitForTimeout(350);
    await page.screenshot({ path: join(out, `${name}-${size}.png`), fullPage: true });
  }
  for (const w of OVERFLOW_WIDTHS) {
    await page.setViewportSize({ width: w, height: 900 });
    await page.waitForTimeout(120);
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    if (sw > w) overflow.push(`${name} @${w}px: scrollWidth ${sw}`);
  }
  await page.setViewportSize({ width: 1440, height: 900 });
}

async function visit(path, name, waitFor = 'h1') {
  await page.goto(base + path);
  await page.waitForSelector(waitFor, { timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(500);
  await shoot(name);
}

// Public + auth
await visit('/', 'landing');
await visit('/p/login', 'login');
const phone = '94' + String(Date.now()).slice(-8);
await page.getByLabel(/Mobile number/).fill(phone);
await page.getByRole('button', { name: /Send (code|OTP)/ }).click();
await page.waitForSelector('text=Enter the code');
const { code } = await (await page.request.get(`${base}/api/dev/outbox?to=%2B91${phone}`)).json();
await page.getByRole('group').getByRole('textbox').first().fill(code);
await shoot('login-otp');
await page.getByRole('button', { name: /Verify/ }).click();
await page.waitForURL('**/p/consent');
await page.waitForSelector('h1');
await shoot('consent');
await page.getByLabel(/I have read this/).check();
await page.getByRole('button', { name: /I agree/ }).click();
await page.waitForURL('**/p/profile');
await page.waitForSelector('h1');
await shoot('profile');
await page.getByLabel('Full name').fill('Pranov Sharma');
await page.getByLabel('Age', { exact: true }).fill('31');
await page.getByLabel('City').fill('Indore');
await page.getByLabel('Male', { exact: true }).check();
await page.getByRole('button', { name: /Save/ }).click();
await page.waitForURL('**/p/home');

// Patient area
await visit('/p/home', 'home');
await visit('/p/id', 'medicos-id', 'img[alt^="QR"]');
await visit('/p/intake/new', 'previsit-start');
for (const p of ['/p/visits', '/p/records']) {
  const res = await page.goto(base + p);
  if (res && res.status() < 400) await visit(p, p.split('/').pop());
}

// Chat: start an interview, answer a few questions, trigger the safety card
const me = await (await page.request.get(`${base}/api/me`)).json();
const session = await (await api('/intake/sessions', { profileId: me.profiles[0].id })).json();
for (const t of ['Haan, main hi hoon', 'Haan, shuru karein', '2 din se bukhar hai, 101 tak gaya', '2–3 din', 'mujhe kya hua hai?']) {
  await api(`/intake/sessions/${session.id}/messages`, { text: t });
}
await visit(`/p/intake/${session.id}`, 'previsit-chat', 'textarea');
await api(`/intake/sessions/${session.id}/messages`, { text: 'chalne par seene mein dard hota hai' });
await visit(`/p/intake/${session.id}`, 'previsit-safety', 'text=112');
await api(`/intake/sessions/${session.id}/continue`);
for (let i = 0; i < 25; i++) {
  const v = await (await api(`/intake/sessions/${session.id}/messages`, { text: 'Nahi' })).json();
  if (v.awaiting !== 'answer') break;
}
await visit(`/p/intake/${session.id}/review`, 'previsit-review');

// Doctor + admin
await visit('/d/login', 'doctor-login');
await visit('/admin', 'admin', 'main');

await browser.close();
writeFileSync(join(out, 'overflow.txt'), overflow.length ? overflow.join('\n') + '\n' : 'No horizontal overflow at 360/390/768/1024/1440/1920.\n');
console.log(`screenshots → ${out}`);
console.log(overflow.length ? `OVERFLOW:\n${overflow.join('\n')}` : 'no overflow');
