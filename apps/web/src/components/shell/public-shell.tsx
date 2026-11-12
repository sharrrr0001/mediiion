'use client';
import { Menu as MenuIcon, ShieldCheck, X } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type ReactNode } from 'react';
import { Button, Logo, Sheet } from '@medicos/ui';
import { LanguagePicker } from '@/components/language-picker';

import { container } from './layout';
export { container };

/** Public pages: sticky white header (sheet menu on phone) + footer. */
export function PublicShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md">
        {t('skip')}
      </a>
      <SiteHeader />
      <main id="main" className="flex-1">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader() {
  const t = useTranslations('nav');
  const [open, setOpen] = useState(false);
  const links = [
    { href: '/#how', label: t('howItWorks') },
    { href: '/#doctors', label: t('forDoctors') },
    { href: '/#trust', label: t('privacy') },
  ];
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
      <div className={`${container} flex h-16 items-center justify-between gap-4`}>
        <Link href="/" aria-label="Medicos home">
          <Logo />
        </Link>
        <nav aria-label={t('main')} className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a key={l.href} href={l.href} className="rounded-lg px-3 py-2 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="hidden items-center gap-2 md:flex">
          <Button asChild variant="ghost">
            <Link href="/p/login">{t('login')}</Link>
          </Button>
          <Button asChild>
            <Link href="/p/login">{t('getStarted')}</Link>
          </Button>
        </div>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label={t('menu')} onClick={() => setOpen(true)}>
          <MenuIcon aria-hidden />
        </Button>
      </div>
      <Sheet open={open} onClose={() => setOpen(false)} label={t('menu')}>
        <div className="flex h-16 items-center justify-between border-b border-line px-4">
          <Logo />
          <Button variant="ghost" size="icon" aria-label={t('closeMenu')} onClick={() => setOpen(false)}>
            <X aria-hidden />
          </Button>
        </div>
        <nav aria-label={t('main')} className="flex flex-col gap-1 p-4">
          {links.map((l) => (
            <a key={l.href} href={l.href} onClick={() => setOpen(false)} className="flex min-h-12 items-center rounded-lg px-3 text-base font-medium hover:bg-surface-2">
              {l.label}
            </a>
          ))}
        </nav>
        <div className="mt-auto flex flex-col gap-3 border-t border-line p-4">
          <LanguagePicker className="self-start" />
          <Button asChild variant="secondary" block>
            <Link href="/p/login">{t('login')}</Link>
          </Button>
          <Button asChild block>
            <Link href="/p/login">{t('getStarted')}</Link>
          </Button>
        </div>
      </Sheet>
    </header>
  );
}

function SiteFooter() {
  const t = useTranslations('footer');
  const cols = [
    { title: t('product'), links: [t('patients'), t('doctors'), t('pricing')] },
    { title: t('company'), links: [t('about'), t('contact')] },
    { title: t('legal'), links: [t('privacyPolicy'), t('terms')] },
  ];
  return (
    <footer className="border-t border-line bg-surface-2">
      <div className={`${container} grid gap-10 py-12 md:grid-cols-[1.5fr_1fr_1fr_1fr]`}>
        <div className="flex flex-col gap-3">
          <Logo />
          <p className="max-w-[34ch] text-muted">{t('tagline')}</p>
          <p className="inline-flex items-center gap-2 text-sm font-medium text-brand-deep">
            <ShieldCheck aria-hidden className="size-5 stroke-[1.75]" />
            {t('dataIndia')}
          </p>
        </div>
        {cols.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-ink">{c.title}</p>
            <ul className="mt-3 flex flex-col gap-2">
              {c.links.map((l) => (
                <li key={l} className="text-[15px] text-muted">
                  {l}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-line">
        <p className={`${container} py-5 text-sm text-muted`}>{t('rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
