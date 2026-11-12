'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Pencil } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import type { IntakeReview, IntakeView, ReviewItem } from '@medicos/shared/client';
import { Button, Skeleton } from '@medicos/ui';
import { SafetyCard } from '@/components/intake/chat-parts';
import { container } from '@/components/shell/layout';
import { api, post } from '@/lib/api';

/** "What you told us" (spec §6.5): plain words, no SOAP letters, editable before submit. */
export default function ReviewPage() {
  const t = useTranslations('review');
  const tc = useTranslations('common');
  const { id } = useParams<{ id: string }>();
  const qc = useQueryClient();
  const [safetyLine, setSafetyLine] = useState<string | null>(null);
  const review = useQuery({ queryKey: ['intake-review', id], queryFn: () => api<IntakeReview>(`/intake/sessions/${id}/review`) });
  const submit = useMutation({
    mutationFn: () => post<IntakeView>(`/intake/sessions/${id}/submit`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['intake-review', id] }),
  });

  if (!review.data) {
    return (
      <main className={`${container} flex max-w-3xl flex-col gap-4 py-10`} aria-busy>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  const data = review.data;
  const sent = data.status === 'submitted' || submit.isSuccess;
  const bySection = ([1, 2, 3] as const).map((step) => ({ step, items: data.items.filter((i) => i.step === step) }));

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <div className="mx-auto max-w-3xl">
        <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
        <p className="mt-2 text-muted">{t('subtitle')}</p>
        <p className="mt-4 rounded-card border border-[#f3dfb3] bg-accent-soft px-4 py-3 text-[15px] font-medium text-accent-ink">{t('notDiagnosis')}</p>

        {safetyLine ? (
          <div className="mt-4">
            <SafetyCard text={safetyLine} onContinue={() => setSafetyLine(null)} pending={false} showContinue />
          </div>
        ) : null}

        {bySection.map(({ step, items }) =>
          items.length ? (
            <section key={step} className="mt-8">
              <h2 className="font-display text-xl font-semibold">{t(`sections.${step}`)}</h2>
              <dl className="mt-3 divide-y divide-line rounded-card border border-line bg-surface px-5 shadow-sm">
                {items.map((item) => (
                  <ReviewRow key={item.questionId} item={item} sessionId={id} editable={!sent} onSafety={setSafetyLine} />
                ))}
              </dl>
            </section>
          ) : null,
        )}

        {data.attachments.length ? (
          <div className="mt-6 flex flex-wrap gap-2">
            {data.attachments.map((a) =>
              a.mime.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element -- short-lived signed URL
                <img key={a.id} src={a.url} alt={a.label ?? a.kind} className="size-20 rounded-xl border border-line object-cover" />
              ) : (
                <span key={a.id} className="grid size-20 place-items-center rounded-xl border border-line bg-surface text-sm font-semibold text-brand">
                  PDF
                </span>
              ),
            )}
          </div>
        ) : null}

        {sent ? (
          <div className="mt-8 flex flex-col gap-4 rounded-card border border-brand/30 bg-brand-tint p-5 md:flex-row md:items-center md:justify-between">
            <p className="flex items-center gap-2 font-semibold text-brand">
              <CheckCircle2 aria-hidden className="size-6" />
              {t('sent')}
            </p>
            <Button asChild variant="secondary">
              <Link href="/p/home">{t('backHome')}</Link>
            </Button>
          </div>
        ) : (
          <>
            {submit.isError ? (
              <p role="alert" className="mt-6 font-medium text-danger">
                {tc('errorGeneric')}
              </p>
            ) : null}
            <Button size="lg" block="phone" className="mt-8" loading={submit.isPending} onClick={() => submit.mutate()}>
              {t('confirm')}
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

function ReviewRow({ item, sessionId, editable, onSafety }: { item: ReviewItem; sessionId: string; editable: boolean; onSafety: (s: string | null) => void }) {
  const t = useTranslations('review');
  const qc = useQueryClient();
  const answer = item.answers[item.answers.length - 1]!;
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(answer.text);
  const save = useMutation({
    mutationFn: () =>
      api<IntakeReview & { safetyLine: string | null }>(`/intake/sessions/${sessionId}/answers/${answer.messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ text: value }),
      }),
    onSuccess: (res) => {
      qc.setQueryData(['intake-review', sessionId], res);
      onSafety(res.safetyLine);
      setEditing(false);
    },
  });

  return (
    <div className="py-4">
      <dt className="text-[0.9375rem] text-muted">{item.question}</dt>
      {editing ? (
        <dd className="mt-2 flex flex-col gap-2">
          <label className="sr-only" htmlFor={`edit-${answer.messageId}`}>
            {item.question}
          </label>
          <textarea
            id={`edit-${answer.messageId}`}
            value={value}
            maxLength={2000}
            onChange={(e) => setValue(e.target.value)}
            className="min-h-24 rounded-[var(--radius-control)] border border-brand bg-surface p-3 shadow-sm focus:outline-none focus:ring-4 focus:ring-brand/15"
          />
          <div className="flex gap-2">
            <Button size="sm" loading={save.isPending} disabled={!value.trim()} onClick={() => save.mutate()}>
              {t('save')}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              {t('cancel')}
            </Button>
          </div>
        </dd>
      ) : (
        <dd className="mt-1 flex items-start justify-between gap-3">
          <span className="font-medium">{item.answers.map((a) => a.text).join(' · ')}</span>
          {editable ? (
            <button type="button" className="inline-flex min-h-11 shrink-0 items-center gap-1 text-sm font-semibold text-brand" onClick={() => setEditing(true)}>
              <Pencil aria-hidden className="size-4" />
              {t('change')}
            </button>
          ) : null}
        </dd>
      )}
    </div>
  );
}
