import { NextIntlClientProvider } from 'next-intl';
import { getMessages } from 'next-intl/server';
import type { ReactNode } from 'react';

/**
 * Sends only the translation namespaces a route's client components need, instead of every string in
 * the app on every page (keeps HTML small on slow mobile networks).
 */
export async function IntlProvider({ namespaces, children }: { namespaces: string[]; children: ReactNode }) {
  const all = (await getMessages()) as Record<string, unknown>;
  const messages = Object.fromEntries(namespaces.filter((n) => n in all).map((n) => [n, all[n]]));
  return <NextIntlClientProvider messages={messages as never}>{children}</NextIntlClientProvider>;
}
