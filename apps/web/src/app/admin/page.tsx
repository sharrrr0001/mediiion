import { Logo } from '@medicos/ui';

/** Internal panels (Admin / Founder / Developer) arrive in Phase 5. */
export default function AdminHome() {
  return (
    <main className="p-8 text-[15px]">
      <Logo />
      <p className="mt-4 text-muted">Internal panels are not built yet.</p>
    </main>
  );
}
