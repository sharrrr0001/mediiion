import type { Metadata } from 'next';
import { IntlProvider } from '@/components/intl-provider';
import { LegalPage } from '@/components/legal/legal-page';
import { PublicShell } from '@/components/shell/public-shell';

export const metadata: Metadata = { title: 'Privacy policy' };

export default function Page() {
  return (
    <IntlProvider namespaces={['common', 'nav', 'footer']}>
      <PublicShell>
        <LegalPage kind="privacy" />
      </PublicShell>
    </IntlProvider>
  );
}
