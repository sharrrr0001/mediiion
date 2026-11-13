'use client';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock, ThumbsUp, Timer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Card, Skeleton, StatCard } from '@medicos/ui';
import { api } from '@/lib/api';
import { useDoctor } from '@/lib/use-doctor';

interface Insights {
  months: Array<{ month: string; summaries: number }>;
  avgInterviewMinutes: number | null;
  completionRate: number | null;
  minutesSavedEstimate: number;
  usefulPercent: number | null;
  feedbackCount: number;
}

/** Doctor Insights (spec §7.3): own numbers only. */
export default function InsightsPage() {
  const t = useTranslations('insights');
  useDoctor();
  const { data: d } = useQuery({ queryKey: ['doctor-insights'], queryFn: () => api<Insights>('/doctor/insights') });
  if (!d) return <Skeleton className="h-96" />;
  const max = Math.max(1, ...d.months.map((m) => m.summaries));
  return (
    <div className="animate-in flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">{t('title')}</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('avg')} value={d.avgInterviewMinutes === null ? '—' : t('min', { n: d.avgInterviewMinutes })} icon={<Clock aria-hidden />} />
        <StatCard label={t('completion')} value={d.completionRate === null ? '—' : `${d.completionRate}%`} icon={<CheckCircle2 aria-hidden />} />
        <StatCard label={t('saved')} value={String(d.minutesSavedEstimate)} trend={t('savedNote')} icon={<Timer aria-hidden />} />
        <StatCard label={t('useful')} value={d.usefulPercent === null ? '—' : `${d.usefulPercent}%`} trend={t('ratings', { n: d.feedbackCount })} icon={<ThumbsUp aria-hidden />} />
      </div>
      <Card className="p-5">
        <h2 className="font-display text-xl font-semibold">{t('months')}</h2>
        <ul className="mt-4 flex h-48 items-end gap-3" aria-label={t('months')}>
          {d.months.map((m) => (
            <li key={m.month} className="flex flex-1 flex-col items-center gap-1">
              <span className="text-sm font-semibold">{m.summaries}</span>
              <span aria-hidden className="w-full rounded-t-md bg-brand" style={{ height: `${Math.max(2, (m.summaries / max) * 140)}px` }} />
              <span className="text-xs text-muted">{m.month.slice(5)}/{m.month.slice(2, 4)}</span>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
