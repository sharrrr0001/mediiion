import { CheckCircle2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Logo } from '@medicos/ui';
import { LanguagePicker } from '@/components/language-picker';

/**
 * Focused layout for login, consent and profile (spec §4.2): on laptop a brand-tint panel with
 * tagline and trust points on the left, the form in a white card on the right; on phone just the form.
 */
export function AuthSplit({ children }: { children: ReactNode }) {
  const t = useTranslations('auth');
  const points = t.raw('points') as string[];
  return (
    <div className="grid min-h-dvh bg-bg lg:grid-cols-2">
      <aside className="relative hidden overflow-hidden bg-brand-tint lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div aria-hidden className="pointer-events-none absolute -left-24 -top-24 size-[480px] rounded-full bg-[radial-gradient(circle,rgba(14,122,85,0.14),transparent_65%)]" />
        <Link href="/" className="relative" aria-label="Medicos home">
          <Logo className="text-2xl" />
        </Link>
        <div className="relative max-w-md">
          <p className="font-display text-4xl font-semibold leading-tight tracking-tight text-brand-deep">{t('panelTitle')}</p>
          <ul className="mt-8 flex flex-col gap-4">
            {points.map((p) => (
              <li key={p} className="flex items-start gap-3 text-lg text-ink">
                <CheckCircle2 aria-hidden className="mt-0.5 size-6 shrink-0 stroke-[1.75] text-brand" />
                {p}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-muted">© {new Date().getFullYear()} Medicos</p>
      </aside>
      <div className="flex flex-col">
        <div className="flex items-center justify-between gap-3 px-4 py-4 md:px-8">
          <Link href="/" className="lg:invisible" aria-label="Medicos home">
            <Logo />
          </Link>
          <LanguagePicker />
        </div>
        <main id="main" className="flex flex-1 justify-center px-4 pb-10 pt-4 md:items-center md:px-8">
          <div className="w-full max-w-[460px]">{children}</div>
        </main>
      </div>
    </div>
  );
}
