import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';
import { PatientShell } from '@/components/shell/patient-shell';

export default function PatientAppLayout({ children }: { children: ReactNode }) {
  return <IntlProvider namespaces={["common","nav","home","intake","review","medicosId","visits","records","extra"]}><PatientShell>{children}</PatientShell></IntlProvider>;
}
