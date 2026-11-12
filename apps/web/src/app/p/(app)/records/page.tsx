'use client';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, FileText, Pill, Sparkles, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { RecordEntryView } from '@medicos/shared/client';
import { Badge, Card, EmptyState, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { api } from '@/lib/api';
import { usePatientGate } from '@/lib/use-me';

const ICON = { doctor_note: Stethoscope, prescription: Pill, pre_visit_summary: Sparkles, uploaded_report: FileText } as const;

/** Medical Record Book: doctor notes and prescriptions (after finalise) and AI pre-visit drafts. */
export default function RecordsPage() {
  const t = useTranslations('records');
  const tr = useTranslations('recordDetail');
  const { me } = usePatientGate();
  const records = useQuery({ queryKey: ['records'], queryFn: () => api<RecordEntryView[]>('/records'), enabled: !!me });

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <Card className="mt-6 p-0 md:mt-8 md:p-0">
        {records.isLoading || !me ? (
          <div className="flex flex-col gap-3 p-5" aria-busy>
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : !records.data?.length ? (
          <EmptyState art="folder" title={t('emptyTitle')} body={t('emptyBody')} />
        ) : (
          <ul className="divide-y divide-line">
            {records.data.map((r) => {
              const Icon = ICON[r.kind];
              return (
                <li key={r.id}>
                  <Link href={`/p/records/${r.id}`} className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-surface-2">
                    <span className="grid size-11 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                      <Icon aria-hidden className="size-5 stroke-[1.75]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{r.title}</span>
                      <span className="text-sm text-muted">
                        {new Date(r.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {r.patientName}
                      </span>
                    </span>
                    <Badge tone={r.kind === 'pre_visit_summary' ? 'accent' : 'brand'} className="hidden sm:inline-flex">
                      {tr(`kinds.${r.kind}`)}
                    </Badge>
                    <ChevronRight aria-hidden className="size-5 text-muted" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
