'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellOff } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { Badge, Button, Card, EmptyState, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { api, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';
import { usePatientGate } from '@/lib/use-me';

type Kind = 'medicine' | 'follow_up' | 'visit' | 'freshness';

/** Reminders from the doctor's finalised note and visits (spec §7.1 #13); the patient can turn them off. */
export default function RemindersPage() {
  const t = useTranslations('reminders');
  const locale = useLocale();
  usePatientGate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['reminders'], queryFn: () => api<Array<{ id: string; kind: Kind; nextAt: string }>>('/reminders') });
  const off = useMutation({ mutationFn: (kind: Kind) => post('/reminders/off', { kind }), onSuccess: () => void qc.invalidateQueries({ queryKey: ['reminders'] }) });
  const kinds = [...new Set((data ?? []).map((r) => r.kind))];

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('body')}</p>
      {isLoading ? (
        <Skeleton className="mt-6 h-32" />
      ) : !data?.length ? (
        <Card className="mt-6">
          <EmptyState art="calendar" title={t('none')} />
        </Card>
      ) : (
        <>
          <div className="mt-6 flex flex-wrap gap-2">
            {kinds.map((k) => (
              <Button key={k} variant="secondary" size="sm" loading={off.isPending && off.variables === k} onClick={() => off.mutate(k)}>
                <BellOff aria-hidden />
                {t('off')}: {t(`kinds.${k}`)}
              </Button>
            ))}
          </div>
          <ul className="mt-4 flex flex-col gap-2">
            {data.map((r) => (
              <li key={r.id}>
                <Card className="flex items-center gap-3">
                  <Badge tone="brand">{t(`kinds.${r.kind}`)}</Badge>
                  <span className="text-muted">{fmtDateTime(r.nextAt, locale)}</span>
                </Card>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
