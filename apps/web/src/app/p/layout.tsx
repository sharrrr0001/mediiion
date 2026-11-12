import type { ReactNode } from 'react';

/** Patient PWA shell: mobile-first column, 17px base type (spec §8). */
export default function PatientLayout({ children }: { children: ReactNode }) {
  return <div className="mx-auto min-h-dvh w-full max-w-md text-[17px]">{children}</div>;
}
