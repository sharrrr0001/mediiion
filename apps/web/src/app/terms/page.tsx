import type { Metadata } from 'next';
import { IntlProvider } from '@/components/intl-provider';
import { LegalPage } from '@/components/legal/legal-page';
import { PublicShell } from '@/components/shell/public-shell';

export const metadata: Metadata = { title: 'Terms of use' };

export default function Page() {
  return (
    <IntlProvider namespaces={['common', 'nav', 'footer']}>
      <PublicShell>
        <LegalPage kind="terms" />
      </PublicShell>
    </IntlProvider>
  );
}
