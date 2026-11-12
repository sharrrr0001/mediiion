import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';
import { AuthSplit } from '@/components/shell/auth-split';

export const metadata: Metadata = { title: 'Doctor login' };

export default function DoctorAuthLayout({ children }: { children: ReactNode }) {
  return (
    <IntlProvider namespaces={['common', 'nav', 'auth', 'login', 'doctorAuth']}>
      <AuthSplit>{children}</AuthSplit>
    </IntlProvider>
  );
}
