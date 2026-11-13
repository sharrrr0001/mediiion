import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { IntlProvider } from '@/components/intl-provider';
import { DoctorShell } from '@/components/shell/doctor-shell';

export const metadata: Metadata = { title: 'Doctor dashboard' };

export default function DoctorLayout({ children }: { children: ReactNode }) {
  return <IntlProvider namespaces={["common","nav","doctor","finalise","doctorAccess","onboarding","clinicDesk","billing","insights"]}><DoctorShell>{children}</DoctorShell></IntlProvider>;
}
