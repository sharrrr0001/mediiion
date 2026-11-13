'use client';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Printer } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import type { ReactNode } from 'react';
import type { RecordDetailView, SummaryLine } from '@medicos/shared/client';
import { Badge, Button, Card, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { api } from '@/lib/api';
import { ShareSummary } from '@/components/share-summary';
import { usePatientGate } from '@/lib/use-me';

function Lines({ title, lines }: { title: string; lines: SummaryLine[] }) {
  if (!lines.length) return null;
  return (
    <div>
      <p className="text-sm font-semibold text-muted">{title}</p>
      <ul className="mt-1 list-inside list-disc">
        {lines.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ul>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap">{children}</dd>
    </div>
  );
}

export default function RecordDetailPage() {
  const t = useTranslations('recordDetail');
  const tf = useTranslations('finalise');
  const { id } = useParams<{ id: string }>();
  const { me } = usePatientGate();
  const q = useQuery({
    queryKey: ['record', id],
    queryFn: () => api<RecordDetailView>(`/records/${id}`),
    enabled: !!me,
  });
  const r = q.data;

  return (
    <div className={`${container} animate-in max-w-3xl py-6 md:py-10`}>
      <div className="no-print flex items-center justify-between gap-3">
        <Link
          href="/p/records"
          className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand"
        >
          <ArrowLeft aria-hidden className="size-5" />
          {t('back')}
        </Link>
        <Button variant="secondary" size="sm" onClick={() => window.print()}>
          <Printer aria-hidden />
          PDF
        </Button>
      </div>
      {!r ? (
        <Skeleton className="mt-6 h-96 w-full rounded-card" />
      ) : (
        <Card className="mt-4">
          <Badge tone={r.kind === 'pre_visit_summary' ? 'accent' : 'brand'}>{t(`kinds.${r.kind}`)}</Badge>
          <h1 className="mt-3 font-display text-2xl font-semibold">{r.title}</h1>
          <p className="text-sm text-muted">
            {new Date(r.date).toLocaleString('en-IN')} · {r.patientName}
          </p>

          {r.summary ? (
            <div className="mt-6 flex flex-col gap-4">
              <p className="rounded-card border border-[#f3dfb3] bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink">
                {t('aiLabel')}
              </p>
              <Lines
                title={tf('openings.hpi')}
                lines={[r.summary.subjective.chiefComplaint, ...r.summary.subjective.historyOfPresentIllness]}
              />
              <Lines title={tf('openings.meds')} lines={r.summary.subjective.medications} />
              <Lines title={tf('openings.allergies')} lines={r.summary.subjective.allergies} />
              <Lines title={tf('openings.questions')} lines={r.summary.subjective.patientQuestions} />
            </div>
          ) : null}
          {r.summary && r.kind === 'pre_visit_summary' ? (
            <ShareSummary recordId={r.id} />
          ) : null}

          {r.note ? (
            <>
              <p className="mt-6 font-semibold text-brand-deep">
                {t('byDoctor', { name: r.note.doctorName })}
              </p>
              <dl className="mt-4 flex flex-col gap-5">
                <Row label={t('assessment')}>{r.note.assessment}</Row>
                <Row label={t('plan')}>{r.note.plan}</Row>
                {r.note.examination ? <Row label={t('examination')}>{r.note.examination}</Row> : null}
                {r.note.testsAdvised ? <Row label={t('tests')}>{r.note.testsAdvised}</Row> : null}
                {r.note.followUpDate ? (
                  <Row label={t('followUp')}>{new Date(r.note.followUpDate).toLocaleDateString('en-IN')}</Row>
                ) : null}
                {r.note.prescription.length ? (
                  <Row label={t('prescription')}>
                    <ul className="flex flex-col gap-2">
                      {r.note.prescription.map((p, i) => (
                        <li key={i} className="rounded-[var(--radius-control)] bg-surface-2 px-4 py-3">
                          <span className="font-semibold">{p.drug}</span> — {p.dose}, {p.frequency},{' '}
                          {p.duration}
                          {p.instructions ? (
                            <span className="block text-sm text-muted">{p.instructions}</span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </Row>
                ) : null}
              </dl>
            </>
          ) : null}
        </Card>
      )}
    </div>
  );
}
