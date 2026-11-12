'use client';
import { Button, Logo } from '@medicos/ui';

/** Friendly error screen — never shows stack traces. */
export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5">
      <Logo />
      <h1 className="font-display text-2xl font-bold">Kuch gadbad ho gayi.</h1>
      <p className="text-muted">Something went wrong. Please try again.</p>
      <Button onClick={reset} className="self-start">
        Try again
      </Button>
    </main>
  );
}
