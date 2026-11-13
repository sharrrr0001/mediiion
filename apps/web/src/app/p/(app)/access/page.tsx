'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import type { AccessGrantView } from '@medicos/shared/client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { api, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';
import { usePatientGate } from '@/lib/use-me';

/** Settings → who has access (spec §7.1 #14): active and past grants, revoke any time (rule 10). */
export default function AccessPage() {
  const t = useTranslations('access');
  const locale = useLocale();
  usePatientGate();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ['access-grants'], queryFn: () => api<AccessGrantView[]>('/access/grants') });
  const revoke = useMutation({
    mutationFn: (id: string) => post(`/access/grants/${id}/revoke`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: ['access-grants'] }),
  });

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      {isLoading ? (
        <Skeleton className="mt-6 h-32" />
      ) : !data?.length ? (
        <Card className="mt-6">
          <EmptyState art="people" title={t('emptyTitle')} body={t('emptyBody')} />
        </Card>
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {data.map((g) => (
            <li key={g.id}>
              <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{g.doctor.name}</p>
                    <Badge tone={g.active ? 'brand' : 'neutral'} dot>
                      {g.active ? t('active') : g.revokedAt ? t('revoked') : t('ended')}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted">
                    {g.profileName} · {t(`via.${g.via}`)} · {fmtDateTime(g.grantedAt, locale)}
                  </p>
                  {g.active ? <p className="text-sm text-muted">{t('until', { time: fmtDateTime(g.expiresAt, locale) })}</p> : null}
                </div>
                {g.active ? (
                  <Button variant="secondary" loading={revoke.isPending && revoke.variables === g.id} onClick={() => revoke.mutate(g.id)}>
                    {t('revoke')}
                  </Button>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
