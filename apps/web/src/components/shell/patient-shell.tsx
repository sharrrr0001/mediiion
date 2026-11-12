'use client';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, ChevronDown, FolderHeart, Home, LogOut, QrCode, Settings, Sparkles, CalendarDays, User } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, type ReactNode } from 'react';
import { Avatar, Button, Logo, Menu, cn, menuItemClass } from '@medicos/ui';
import { OfflineBanner } from '@/components/offline-banner';
import { post } from '@/lib/api';
import { useMe } from '@/lib/use-me';
import { container } from './layout';

const ITEMS = [
  { href: '/p/home', key: 'home', icon: Home, match: /^\/p\/home/ },
  { href: '/p/intake/new', key: 'previsit', icon: Sparkles, match: /^\/p\/intake/ },
  { href: '/p/visits', key: 'visits', icon: CalendarDays, match: /^\/p\/visits/ },
  { href: '/p/records', key: 'records', icon: FolderHeart, match: /^\/p\/records/ },
  { href: '/p/id', key: 'myId', icon: QrCode, match: /^\/p\/id/ },
] as const;

/** The live chat owns the bottom of the phone screen (composer), so the tab bar steps aside there. */
const CHAT_ROUTE = /^\/p\/intake\/[0-9a-f-]{36}$/;

export function PatientShell({ children }: { children: ReactNode }) {
  const t = useTranslations('nav');
  const pathname = usePathname();
  const { data: me } = useMe();
  const firstName = me?.profiles[0]?.name.split(' ')[0];
  const hideTabBar = CHAT_ROUTE.test(pathname);

  // Offline app shell (production only, so it never interferes with development).
  useEffect(() => {
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js', { scope: '/p/' }).catch(() => undefined);
    }
  }, []);

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-surface focus:px-4 focus:py-2 focus:shadow-md">
        {t('skip')}
      </a>
      <header className="sticky top-0 z-30 border-b border-line bg-surface/90 backdrop-blur">
        <OfflineBanner />
        <div className={`${container} flex h-16 items-center gap-4`}>
          <Link href="/p/home" aria-label="Medicos home" className="shrink-0">
            <Logo />
          </Link>
          <nav aria-label={t('main')} className="ml-4 hidden items-center gap-1 md:flex">
            {ITEMS.map((it) => {
              const active = it.match.test(pathname);
              return (
                <Link
                  key={it.key}
                  href={it.href}
                  aria-current={active ? 'page' : undefined}
                  className={cn(
                    'inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-[15px] font-medium text-muted transition-colors hover:bg-surface-2 hover:text-ink [&_svg]:size-5 [&_svg]:stroke-[1.75]',
                    active && 'bg-brand-soft text-brand-deep hover:bg-brand-soft hover:text-brand-deep',
                  )}
                >
                  <it.icon aria-hidden />
                  <span className="hidden lg:inline">{t(it.key)}</span>
                  <span className="sr-only lg:hidden">{t(it.key)}</span>
                </Link>
              );
            })}
          </nav>
          <div className="ml-auto flex items-center gap-1 md:gap-2">
            {firstName ? (
              <span className="hidden items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-sm font-medium text-ink lg:inline-flex">
                {t('forWhom', { name: firstName })}
                <ChevronDown aria-hidden className="size-4 text-muted" />
              </span>
            ) : null}
            <Button variant="ghost" size="icon" aria-label={t('notifications')}>
              <Bell aria-hidden />
            </Button>
            <AccountMenu name={me?.profiles[0]?.name ?? ''} />
          </div>
        </div>
      </header>

      <main id="main" className={cn('flex-1', hideTabBar ? '' : 'pb-safe-bar md:pb-12')}>
        {children}
      </main>

      {hideTabBar ? null : (
        <nav
          aria-label={t('main')}
          className="fixed inset-x-0 bottom-0 z-30 grid h-[calc(var(--bottom-bar)+env(safe-area-inset-bottom))] grid-cols-5 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] shadow-[0_-4px_16px_-8px_rgba(16,40,30,0.12)] backdrop-blur md:hidden"
        >
          {ITEMS.map((it) => {
            const active = it.match.test(pathname);
            return (
              <Link
                key={it.key}
                href={it.href}
                aria-current={active ? 'page' : undefined}
                className={cn('flex flex-col items-center justify-center gap-1 text-[11px] font-semibold text-muted', active && 'text-brand-deep')}
              >
                <span className={cn('grid h-7 w-12 place-items-center rounded-full transition-colors', active && 'bg-brand-soft')}>
                  <it.icon aria-hidden className="size-5 stroke-[1.75]" />
                </span>
                {t(it.key)}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

function AccountMenu({ name }: { name: string }) {
  const t = useTranslations('nav');
  const router = useRouter();
  const qc = useQueryClient();
  return (
    <Menu label={t('account')} trigger={<Avatar name={name} className="size-10 border border-line" />}>
      <Link role="menuitem" href="/p/id" className={menuItemClass}>
        <User aria-hidden />
        {t('profile')}
      </Link>
      <Link role="menuitem" href="/p/home" className={menuItemClass}>
        <Settings aria-hidden />
        {t('settings')}
      </Link>
      <button
        role="menuitem"
        type="button"
        className={menuItemClass}
        onClick={async () => {
          await post('/auth/logout').catch(() => undefined);
          qc.clear();
          router.replace('/p/login');
        }}
      >
        <LogOut aria-hidden />
        {t('logout')}
      </button>
    </Menu>
  );
}
