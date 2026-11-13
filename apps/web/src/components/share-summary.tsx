'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Copy, Link2 } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useState } from 'react';
import type { ShareLinkView } from '@medicos/shared/client';
import { Button } from '@medicos/ui';
import { api, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';

/** "Share summary with a doctor not on Medicos" (spec §7.1 #9): secret link, 72 h, can be stopped. */
export function ShareSummary({ recordId }: { recordId: string }) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const qc = useQueryClient();
  const key = ['share-links', recordId];
  const [fresh, setFresh] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const { data } = useQuery({ queryKey: key, queryFn: () => api<ShareLinkView[]>(`/share-links/record/${recordId}`) });
  const create = useMutation({
    mutationFn: () => post<ShareLinkView>('/share-links', { recordId }),
    onSuccess: (l) => {
      setFresh(`${window.location.origin}${l.path}`);
      void qc.invalidateQueries({ queryKey: key });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string) => post(`/share-links/${id}/revoke`),
    onSuccess: () => (setFresh(null), void qc.invalidateQueries({ queryKey: key })),
  });
  const active = (data ?? []).filter((l) => !l.revokedAt && new Date(l.expiresAt).getTime() > Date.now());

  return (
    <section className="no-print mt-6 rounded-card border border-line p-4">
      <h2 className="flex items-center gap-2 font-semibold">
        <Link2 aria-hidden className="size-5 text-brand" />
        {t('shareTitle')}
      </h2>
      <p className="mt-1 text-sm text-muted">{t('shareBody')}</p>
      {fresh ? (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row">
          <input readOnly aria-label={t('shareTitle')} value={fresh} className="min-h-11 flex-1 rounded-[var(--radius-control)] border border-line bg-surface-2 px-3 font-mono text-sm" onFocus={(e) => e.target.select()} />
          <Button
            variant="secondary"
            onClick={() => {
              void navigator.clipboard?.writeText(fresh).then(() => setCopied(true));
            }}
          >
            <Copy aria-hidden />
            {copied ? t('shareCopied') : t('shareCopy')}
          </Button>
        </div>
      ) : null}
      <ul className="mt-3 flex flex-col gap-2">
        {active.map((l) => (
          <li key={l.id} className="flex flex-wrap items-center gap-3 text-sm">
            <span className="flex-1 text-muted">{t('shareExpires', { time: fmtDateTime(l.expiresAt, locale) })}</span>
            <Button variant="ghost" size="sm" loading={revoke.isPending && revoke.variables === l.id} onClick={() => revoke.mutate(l.id)}>
              {t('shareRevoke')}
            </Button>
          </li>
        ))}
      </ul>
      {!fresh ? (
        <Button className="mt-3" variant="secondary" loading={create.isPending} onClick={() => create.mutate()}>
          {t('shareCreate')}
        </Button>
      ) : null}
    </section>
  );
}
