'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState } from 'react';
import type { VerificationQueueItem } from '@medicos/shared/client';
import { Badge, Button, Card, EmptyState, Field, Input, Skeleton } from '@medicos/ui';
import { api, ApiError, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';

const KEY = ['admin-verifications'] as const;

/** Admin verification queue (spec §7.5): documents next to the claimed registration; human decision only. */
export default function VerificationsPage() {
  const t = useTranslations('verify');
  const { data, error, isLoading } = useQuery({ queryKey: KEY, queryFn: () => api<VerificationQueueItem[]>('/admin/verifications'), retry: false });
  return (
    <div className="animate-in flex flex-col gap-4">
      <div>
        <h1 className="font-display text-2xl font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-muted">{t('subtitle')}</p>
      </div>
      {isLoading ? (
        <Skeleton className="h-40" />
      ) : error ? (
        <Card>
          <EmptyState
            title={error instanceof ApiError && (error.status === 401 || error.status === 403) ? t('signIn') : error.message}
            action={
              <Button asChild>
                <Link href="/d/login">Log in</Link>
              </Button>
            }
          />
        </Card>
      ) : !data?.length ? (
        <Card>
          <EmptyState art="people" title={t('empty')} />
        </Card>
      ) : (
        data.map((d) => <Item key={d.doctorId} d={d} />)
      )}
    </div>
  );
}

function Item({ d }: { d: VerificationQueueItem }) {
  const t = useTranslations('verify');
  const qc = useQueryClient();
  const [note, setNote] = useState('');
  const decide = useMutation({
    mutationFn: (decision: 'approve' | 'reject') => post(`/admin/verifications/${d.doctorId}`, { decision, ...(note ? { note } : {}) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="font-display text-xl font-semibold">{d.name}</h2>
        <Badge>{d.specialty.replace('_', ' ')}</Badge>
        <span className="text-sm text-muted">{t('submitted', { time: fmtDateTime(d.submittedAt, 'en') })}</span>
      </div>
      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted">{t('reg')}</dt>
          <dd className="font-medium">
            {d.registrationNo} · {d.council}
          </dd>
        </div>
        <div>
          <dt className="text-muted">Degrees</dt>
          <dd className="font-medium">{d.degrees.join(', ')}</dd>
        </div>
        <div>
          <dt className="text-muted">City</dt>
          <dd className="font-medium">
            {d.city} · {d.yearsExperience ?? 0} yrs
          </dd>
        </div>
      </dl>
      <h3 className="mt-4 text-sm font-semibold">{t('docs')}</h3>
      <ul className="mt-2 flex flex-wrap gap-2">
        {d.documents.map((doc) => (
          <li key={doc.id}>
            <a href={doc.url} target="_blank" rel="noreferrer noopener" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm font-medium hover:border-brand">
              {doc.kind.replace(/_/g, ' ')}
              <ExternalLink aria-hidden className="size-4" />
            </a>
          </li>
        ))}
      </ul>
      <Field label={t('reason')} htmlFor={`note-${d.doctorId}`} hint={t('reasonHint')} className="mt-4">
        <Input id={`note-${d.doctorId}`} value={note} onChange={(e) => setNote(e.target.value)} />
      </Field>
      {decide.error ? <p role="alert" className="mt-2 font-medium text-danger">{decide.error.message}</p> : null}
      <div className="mt-4 flex gap-3">
        <Button loading={decide.isPending && decide.variables === 'approve'} onClick={() => decide.mutate('approve')}>
          {t('approve')}
        </Button>
        <Button variant="danger" disabled={!note.trim()} loading={decide.isPending && decide.variables === 'reject'} onClick={() => decide.mutate('reject')}>
          {t('reject')}
        </Button>
      </div>
    </Card>
  );
}
