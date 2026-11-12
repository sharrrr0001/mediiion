import Link from 'next/link';
import { Logo } from '@medicos/ui';

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
      <Logo />
      <h1 className="font-display text-2xl font-bold">Yeh page nahi mila. / Page not found.</h1>
      <Link href="/p/home" className="font-semibold text-brand underline">
        Go to home
      </Link>
    </main>
  );
}
