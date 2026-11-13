'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, FileText, ShieldCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { DoctorPatientView } from '@medicos/shared/client';
import { Badge, Card, EmptyState, Skeleton } from '@medicos/ui';
import { api, ApiError } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';

/** A patient's record book, opened after they tapped Allow (rule 10). Access ends with the grant. */
export default function DoctorPatientPage() {
  const t = useTranslations('doctorAccess');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const { data, error, isLoading } = useQuery({ queryKey: ['doctor-patient', id], queryFn: () => api<DoctorPatientView>(`/doctor/patients/${id}`), retry: false });

  return (
    <div className="animate-in">
      <Link href="/d/today" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-hover">
        <ArrowLeft aria-hidden className="size-4" />
        {tc('back')}
      </Link>
      {isLoading ? (
        <Skeleton className="mt-4 h-40" />
      ) : error || !data ? (
        <Card className="mt-4">
          <EmptyState title={error instanceof ApiError && error.status === 404 ? t('expired') : tc('errorGeneric')} />
        </Card>
      ) : (
        <Card className="mt-4 p-5 md:p-6">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-2xl font-bold tracking-tight">{t('recordsTitle')}</h1>
            <Badge tone="brand">
              <ShieldCheck aria-hidden className="size-4" />
              {t('accessUntil', { time: fmtDateTime(data.grantExpiresAt, 'en') })}
            </Badge>
          </div>
          <p className="mt-1 text-muted">
            {data.label} · <span className="font-mono">{data.medicosId}</span>
          </p>
          {data.entries.length ? (
            <ul className="mt-5 divide-y divide-line rounded-card border border-line">
              {data.entries.map((e) => (
                <li key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <FileText aria-hidden className="size-5 shrink-0 text-brand" />
                  <span className="min-w-0 flex-1 font-medium">{e.title}</span>
                  <time className="text-sm text-muted" dateTime={e.date}>
                    {fmtDateTime(e.date, 'en')}
                  </time>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-5 text-muted">{t('noEntries')}</p>
          )}
        </Card>
      )}
    </div>
  );
}
