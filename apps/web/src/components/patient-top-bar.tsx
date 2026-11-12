'use client';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Bell, LogOut } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Logo } from '@medicos/ui';
import { OfflineBanner } from './offline-banner';
import { post } from '@/lib/api';

/** Top bar for signed-in patient screens. `back` shows a back link instead of the logout button. */
export function PatientTopBar({ back }: { back?: string }) {
  const tc = useTranslations('common');
  const router = useRouter();
  const qc = useQueryClient();

  return (
    <header className="no-print sticky top-0 z-10 bg-bg/95 backdrop-blur">
      <OfflineBanner />
      <div className="flex h-16 items-center justify-between px-3">
        {back ? (
          <Link href={back} aria-label={tc('back')} className="grid size-12 place-items-center rounded-full">
            <ArrowLeft aria-hidden className="size-6" />
          </Link>
        ) : (
          <button
            type="button"
            aria-label={tc('logout')}
            className="grid size-12 place-items-center rounded-full text-muted"
            onClick={async () => {
              await post('/auth/logout').catch(() => undefined);
              qc.clear();
              router.replace('/p/login');
            }}
          >
            <LogOut aria-hidden className="size-5" />
          </button>
        )}
        <Logo />
        <button type="button" aria-label={tc('notifications')} className="grid size-12 place-items-center rounded-full text-muted">
          <Bell aria-hidden className="size-6" />
        </button>
      </div>
    </header>
  );
}
