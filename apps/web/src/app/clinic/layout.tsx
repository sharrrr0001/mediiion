import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';
import { container } from '@/components/shell/layout';

export const metadata: Metadata = { title: 'Clinic desk' };

/** Clinic staff area (spec §7.4): no clinical data, so a simple shell is enough. */
export default function ClinicLayout({ children }: { children: ReactNode }) {
  return (
    <IntlProvider namespaces={['common', 'clinicDesk', 'doctorAccess']}>
      <main id="main" className={`${container} py-6 md:py-10`}>
        {children}
      </main>
    </IntlProvider>
  );
}
