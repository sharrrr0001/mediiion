'use client';
import { CalendarDays, ChevronRight, FolderHeart, Lock, QrCode as QrIcon, Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, Skeleton } from '@medicos/ui';
import { PatientTopBar } from '@/components/patient-top-bar';
import { usePatientGate } from '@/lib/use-me';

export default function HomePage() {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const { me, isError, refetch } = usePatientGate();

  if (isError && !me) {
    return (
      <main className="px-5 pt-20">
        <p className="text-muted">{tc('errorGeneric')}</p>
        <Button variant="secondary" className="mt-4" onClick={() => refetch()}>
          {tc('retry')}
        </Button>
      </main>
    );
  }
  if (!me) return <HomeSkeleton />;

  const primary = me.profiles[0]!;
  const firstName = primary.name.split(' ')[0] ?? primary.name;

  return (
    <>
      <PatientTopBar />
      <main className="flex flex-col px-5 pb-10">
        <span className="mt-2 self-start rounded-full bg-surface-2 px-3 py-1.5 text-sm font-medium text-muted">
          {t('forWhom', { name: firstName })}
        </span>

        <h1 className="mt-5 font-display text-[2.25rem] font-bold leading-[1.1] tracking-tight">
          {t('greeting', { name: firstName })}
        </h1>
        <p className="mt-2 max-w-[30ch] text-muted">{t('subtitle')}</p>

        {/* The one dominant action. Intake arrives in Phase 1. */}
        <div className="mt-8 rounded-[20px] bg-brand p-5 text-brand-ink">
          <div className="flex items-center gap-3">
            <Sparkles aria-hidden className="size-7" />
            <span className="font-display text-xl font-semibold">{t('startPrevisit')}</span>
          </div>
          <p className="mt-2 opacity-90">{t('startPrevisitHint')}</p>
          <span className="mt-4 inline-block rounded-full bg-white/15 px-3 py-1 text-sm font-medium">{t('comingSoon')}</span>
        </div>

        <ul className="mt-8 flex flex-col divide-y divide-line border-y border-line">
          <Row icon={<CalendarDays aria-hidden />} title={t('upcoming')} body={t('noUpcoming')} />
          <Row icon={<FolderHeart aria-hidden />} title={t('records')} body={t('recordsHint')} />
          <Row
            icon={<QrIcon aria-hidden />}
            title={t('myId')}
            body={<span className="font-mono tracking-wide">{primary.medicosId}</span>}
            href="/p/id"
          />
        </ul>

        <p className="mt-8 flex gap-2 text-sm text-muted">
          <Lock aria-hidden className="mt-0.5 size-4 shrink-0" />
          {tc('privacyNote')}
        </p>
      </main>
    </>
  );
}

function Row({ icon, title, body, href }: { icon: ReactNode; title: string; body: ReactNode; href?: string }) {
  const inner = (
    <>
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-6">{icon}</span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="font-semibold">{title}</span>
        <span className="text-[0.9375rem] text-muted">{body}</span>
      </span>
      {href ? <ChevronRight aria-hidden className="size-5 text-muted" /> : null}
    </>
  );
  return (
    <li>
      {href ? (
        <Link href={href} className="flex min-h-[72px] items-center gap-4 py-3">
          {inner}
        </Link>
      ) : (
        <div className="flex min-h-[72px] items-center gap-4 py-3">{inner}</div>
      )}
    </li>
  );
}

function HomeSkeleton() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-20" aria-busy>
      <Skeleton className="h-10 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-36 w-full rounded-[20px]" />
      <Skeleton className="h-16 w-full" />
      <Skeleton className="h-16 w-full" />
    </main>
  );
}
