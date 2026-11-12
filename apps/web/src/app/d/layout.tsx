import type { ReactNode } from 'react';
import { Logo } from '@medicos/ui';

/** Doctor/staff dashboard shell (desktop first, 15px base). Full dashboard arrives in Phase 2. */
export default function DoctorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh text-[15px]">
      <aside className="hidden w-64 shrink-0 bg-brand-deep p-6 text-white md:block">
        <Logo className="text-white [&_svg_path:last-child]:fill-[var(--brand-deep)]" />
      </aside>
      <main className="flex-1 p-8">{children}</main>
    </div>
  );
}
