import type { ReactNode } from 'react';
import { PatientShell } from '@/components/shell/patient-shell';

export default function PatientAppLayout({ children }: { children: ReactNode }) {
  return <PatientShell>{children}</PatientShell>;
}
