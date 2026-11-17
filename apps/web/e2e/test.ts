import { test as base, type Browser, type BrowserContextOptions } from '@playwright/test';

/**
 * Existing journeys predate the "Set a password" popup that follows an OTP login. They behave as if
 * the user pressed "Later" (the popup's own session flag). password.spec.ts uses `@playwright/test`
 * directly so it sees the popup.
 */
const LATER = () => {
  try {
    sessionStorage.setItem('mc_pw_later', '1');
  } catch {
    /* ignore */
  }
};

export const test = base.extend({
  context: async ({ context }, use) => {
    await context.addInitScript(LATER);
    await use(context);
  },
});
export { expect } from '@playwright/test';

/** Same as browser.newContext, with the password popup deferred. */
export async function newContext(browser: Browser, options: BrowserContextOptions = {}) {
  const ctx = await browser.newContext(options);
  await ctx.addInitScript(LATER);
  return ctx;
}
