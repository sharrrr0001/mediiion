import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';

// Shared summaries are private: never indexed, never cached by referrers.
export const metadata: Metadata = { title: 'Shared pre-visit summary', robots: { index: false, follow: false }, referrer: 'no-referrer' };

export default function SharedLayout({ children }: { children: ReactNode }) {
  return <IntlProvider namespaces={['common', 'finalise', 'recordDetail']}>{children}</IntlProvider>;
}
