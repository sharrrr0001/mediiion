'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, CalendarDays, ChevronRight, FolderHeart, Lock, Pill, QrCode, FileText, Sparkles, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { Button, Card, EmptyState, SectionHeader, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { api } from '@/lib/api';
import { usePatientGate } from '@/lib/use-me';

export default function HomePage() {
  const t = useTranslations('home');
  const tc = useTranslations('common');
  const tx = useTranslations('extra');
  const ti = useTranslations('intake');
  const tv = useTranslations('visits');
  const tr = useTranslations('records');
  const { me, isError, refetch } = usePatientGate();
  const open = useQuery({
    queryKey: ['intake-open'],
    queryFn: () => api<Array<{ id: string }>>('/intake/sessions'),
    enabled: !!me,
  });

  if (isError && !me) {
    return (
      <div className={`${container} py-16`}>
        <EmptyState art="chat" title={tc('errorGeneric')} action={<Button onClick={() => refetch()}>{tc('retry')}</Button>} />
      </div>
    );
  }
  // Render the page shell immediately (fast LCP); only the personal bits wait for /me.
  const primary = me?.profiles[0];
  const firstName = primary ? (primary.name.split(' ')[0] ?? primary.name) : null;
  const idText = primary?.medicosId;
  const resume = open.data?.[0];
  const steps = ti.raw('steps') as string[];
  const stepIcons = [Stethoscope, Pill, FileText];

  return (
    <div className={`${container} py-6 md:py-10`}>
      {/* Greeting row */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-page-title font-display font-bold tracking-tight">
            {firstName ? tx('greetingWave', { name: firstName }) : <Skeleton className="inline-block h-10 w-64 align-middle" />}
          </h1>
          <p className="mt-1 text-muted">{t('subtitle')}</p>
        </div>
        <Link
          href="/p/id"
          className="hidden items-center gap-2 rounded-full border border-line bg-surface px-4 py-2 shadow-sm transition-colors hover:border-brand md:inline-flex"
        >
          <QrCode aria-hidden className="size-5 stroke-[1.75] text-brand" />
          <span className="font-mono text-sm font-semibold tracking-wide">{idText ?? '—'}</span>
        </Link>
      </div>

      {/* Hero CTA */}
      <section className="relative mt-6 overflow-hidden rounded-[16px] border border-line bg-gradient-to-br from-surface via-surface to-brand-tint shadow-sm md:mt-8">
        <span aria-hidden className="absolute inset-y-0 left-0 w-1 bg-brand" />
        <div className="grid gap-6 p-6 md:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
          <div className="flex gap-4">
            <span className="grid size-12 shrink-0 place-items-center rounded-full bg-brand text-brand-ink shadow-sm">
              <Sparkles aria-hidden className="size-6 stroke-[1.75]" />
            </span>
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">{t('startPrevisit')}</h2>
              <p className="mt-1 max-w-[52ch] text-muted">{t('startPrevisitHint')}</p>
              <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg" block="phone">
                  <Link href={resume ? `/p/intake/${resume.id}` : '/p/intake/new'}>
                    {resume ? ti('resume') : tx('startNow')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                {resume ? (
                  <Button asChild size="lg" variant="secondary" block="phone">
                    <Link href="/p/intake/new">{tx('startNow')}</Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
          <ol className="hidden gap-3 lg:flex" aria-label={ti('chooseTitle')}>
            {steps.map((s, i) => {
              const Icon = stepIcons[i] ?? FileText;
              return (
                <li key={s} className="flex w-36 flex-col items-center gap-2 rounded-card border border-line bg-surface p-4 text-center shadow-sm">
                  <span className="grid size-10 place-items-center rounded-full bg-brand-soft text-brand">
                    <Icon aria-hidden className="size-5 stroke-[1.75]" />
                  </span>
                  <span className="text-sm font-medium">
                    {i + 1}. {s}
                  </span>
                </li>
              );
            })}
          </ol>
        </div>
      </section>

      {/* Cards grid */}
      <div className="mt-6 grid animate-in gap-5 md:mt-8 md:grid-cols-2 lg:grid-cols-3">
        <DashCard icon={<CalendarDays aria-hidden />} title={t('upcoming')}>
          <EmptyState
            art="calendar"
            className="py-4"
            title={tv('emptyTitle')}
            action={
              <Button asChild variant="secondary">
                <Link href="/p/visits">{tx('findDoctor')}</Link>
              </Button>
            }
          />
        </DashCard>
        <DashCard icon={<FolderHeart aria-hidden />} title={t('records')} href="/p/records" linkLabel={tx('viewAll')}>
          <EmptyState art="folder" className="py-4" title={tr('emptyTitle')} body={tx('noRecordsBody')} />
        </DashCard>
        <DashCard icon={<QrCode aria-hidden />} title={t('myId')} className="md:col-span-2 lg:col-span-1">
          <div className="flex flex-col items-center gap-4 py-2 text-center">
            <span aria-hidden className="grid size-28 place-items-center rounded-card border-2 border-brand/30 bg-surface-2">
              <QrCode className="size-16 stroke-[1.25] text-brand-deep" />
            </span>
            {idText ? <p className="font-mono text-lg font-semibold tracking-wide">{idText}</p> : <Skeleton className="h-7 w-44" />}
            <p className="text-sm text-muted">{t('myIdHint')}</p>
            <Button asChild block>
              <Link href="/p/id">{tx('showQr')}</Link>
            </Button>
          </div>
        </DashCard>
      </div>

      <p className="mt-8 flex items-center gap-2 text-sm text-muted">
        <Lock aria-hidden className="size-4 shrink-0" />
        {tc('privacyNote')}
      </p>
    </div>
  );
}

function DashCard({ icon, title, href, linkLabel, children, className }: { icon: ReactNode; title: string; href?: string; linkLabel?: string; children: ReactNode; className?: string }) {
  return (
    <Card className={`flex flex-col ${className ?? ''}`}>
      <SectionHeader
        as="h2"
        title={title}
        action={
          href && linkLabel ? (
            <Link href={href} className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand hover:text-brand-hover">
              {linkLabel}
              <ChevronRight aria-hidden className="size-4" />
            </Link>
          ) : (
            <span className="inline-flex min-h-11 items-center text-brand [&_svg]:size-5 [&_svg]:stroke-[1.75]">{icon}</span>
          )
        }
      />
      <div className="flex flex-1 flex-col justify-center">{children}</div>
    </Card>
  );
}

