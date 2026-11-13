import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';
import { AdminShell } from '@/components/shell/doctor-shell';

export const metadata: Metadata = { title: 'Admin' };

export default function AdminLayout({ children }: { children: ReactNode }) {
  return <IntlProvider namespaces={["common","nav","doctor","admin","verify","panels"]}><AdminShell>{children}</AdminShell></IntlProvider>;
}
