'use client';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, ChevronRight, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import type { DoctorQueueRow, DoctorSummaryView, QueueStatus } from '@medicos/shared/client';
import { Badge, Button, Card, EmptyState, Skeleton, StatusTag, Tabs, cn } from '@medicos/ui';
import { SummaryPanel } from '@/components/doctor/summary-panel';
import { api, ApiError } from '@/lib/api';
import { useDoctor } from '@/lib/use-doctor';

type StatusKey = 'statusReady' | 'statusProgress' | 'statusWalkin' | 'statusIdle' | 'statusDone';
const STATUS: Record<QueueStatus, { tag: 'ready' | 'progress' | 'walkin' | 'idle'; key: StatusKey }> = {
  ready: { tag: 'ready', key: 'statusReady' },
  progress: { tag: 'progress', key: 'statusProgress' },
  walkin: { tag: 'walkin', key: 'statusWalkin' },
  idle: { tag: 'idle', key: 'statusIdle' },
  done: { tag: 'ready', key: 'statusDone' },
};
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata' });

export default function DoctorTodayPage() {
  return (
    <Suspense>
      <Today />
    </Suspense>
  );
}

function Today() {
  const t = useTranslations('doctor');
  const tf = useTranslations('finalise');
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<'today' | 'upcoming'>('today');
  const me = useDoctor();
  const queue = useQuery({ queryKey: ['doctor-queue'], queryFn: () => api<DoctorQueueRow[]>('/doctor/queue'), enabled: me.data?.verificationStatus === 'verified', refetchInterval: 30_000 });
  const rows = queue.data ?? [];
  const selectedId = params.get('appt') ?? rows[0]?.appointmentId ?? null;
  const showDetailOnPhone = params.has('appt');
  const detail = useQuery({ queryKey: ['doctor-appt', selectedId], queryFn: () => api<DoctorSummaryView>(`/doctor/appointments/${selectedId}`), enabled: !!selectedId });
  const select = (id: string) => router.replace(`${pathname}?appt=${id}`, { scroll: false });

  if (me.data && me.data.verificationStatus !== 'verified') {
    return (
      <div className="p-4 md:p-6">
        <Card>
          <EmptyState art="people" title={t('verified')} body={tf('notVerified')} />
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        <Card className={cn('h-fit min-w-0 p-0 md:p-0 lg:sticky lg:top-20 print:hidden', showDetailOnPhone && 'hidden lg:block')}>
          <div className="flex items-center justify-between gap-3 p-4 pb-0">
            <h1 className="font-display text-xl font-semibold">{t('queue')}</h1>
          </div>
          <div className="px-4 pt-2">
            <Tabs label={t('queue')} value={tab} onChange={setTab} items={[{ value: 'today', label: t('today', { n: rows.length }) }, { value: 'upcoming', label: t('upcoming', { n: 0 }) }]} />
          </div>
          {queue.isLoading || me.isLoading ? (
            <div className="flex flex-col gap-2 p-4" aria-busy>
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} className="h-16" />
              ))}
            </div>
          ) : tab === 'upcoming' || !rows.length ? (
            <EmptyState art="calendar" className="py-6" title={t('queue')} body={tf('empty')} />
          ) : (
            <ul className="flex flex-col p-2" aria-label={t('queue')}>
              {rows.map((r) => (
                <li key={r.appointmentId}>
                  <button
                    type="button"
                    aria-current={r.appointmentId === selectedId ? 'true' : undefined}
                    onClick={() => select(r.appointmentId)}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-[var(--radius-control)] border-l-[3px] border-transparent px-3 py-3 text-left transition-colors hover:bg-surface-2',
                      r.appointmentId === selectedId && 'border-brand bg-brand-soft hover:bg-brand-soft',
                    )}
                  >
                    <span className="tabular w-12 shrink-0 pt-0.5 text-sm font-semibold text-muted">{time(r.time)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.label ?? r.medicosId}</span>
                      <span className="block truncate text-sm text-muted">{r.complaint ?? r.medicosId}</span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <StatusTag status={STATUS[r.status].tag}>{t(STATUS[r.status].key)}</StatusTag>
                        {r.safety ? (
                          <Badge tone="neutral" className="whitespace-normal text-[13px]">
                            <AlertTriangle aria-hidden className="size-3.5" />
                            {t('safetyMarker')}
                          </Badge>
                        ) : null}
                      </span>
                    </span>
                    <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted lg:hidden" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <div className={cn('min-w-0', !showDetailOnPhone && 'hidden lg:block')}>
          <Button variant="ghost" className="-ml-2 mb-2 lg:hidden print:hidden" onClick={() => router.replace(pathname, { scroll: false })}>
            <ArrowLeft aria-hidden />
            {t('backToQueue')}
          </Button>
          {!selectedId ? (
            <Card className="flex min-h-80 items-center justify-center">
              <p className="flex items-center gap-2 text-muted">
                <Info aria-hidden className="size-5" />
                {t('empty')}
              </p>
            </Card>
          ) : detail.isLoading ? (
            <Skeleton className="h-[600px] w-full rounded-card" />
          ) : detail.error ? (
            <Card>
              <p role="alert" className="text-danger">{detail.error instanceof ApiError ? detail.error.message : t('empty')}</p>
            </Card>
          ) : detail.data ? (
            <SummaryPanel key={detail.data.appointmentId} view={detail.data} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
