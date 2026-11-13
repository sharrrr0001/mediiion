'use client';
import { useQuery } from '@tanstack/react-query';
import { Printer, ShieldAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useParams } from 'next/navigation';
import type { SharedSummaryView, SummaryLine } from '@medicos/shared/client';
import { Button, Card, EmptyState, Logo, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { api } from '@/lib/api';

function Lines({ title, lines }: { title: string; lines: SummaryLine[] }) {
  if (!lines.length) return null;
  return (
    <section>
      <h2 className="text-sm font-semibold text-muted">{title}</h2>
      <ul className="mt-1 list-inside list-disc">
        {lines.map((l, i) => (
          <li key={i}>{l.text}</li>
        ))}
      </ul>
    </section>
  );
}

/** What a doctor not on Medicos sees from a patient's share link (spec §7.1 #9). AI draft, S only. */
export default function SharedSummaryPage() {
  const tf = useTranslations('finalise');
  const tc = useTranslations('common');
  const { token } = useParams<{ token: string }>();
  const { data, error, isLoading } = useQuery({ queryKey: ['shared', token], queryFn: () => api<SharedSummaryView>(`/shared/${token}`), retry: false });

  return (
    <main className={`${container} max-w-3xl py-6 md:py-10`}>
      <div className="no-print flex items-center justify-between">
        <Logo />
        {data ? (
          <Button variant="secondary" size="sm" onClick={() => window.print()}>
            <Printer aria-hidden />
            PDF
          </Button>
        ) : null}
      </div>
      {isLoading ? (
        <Skeleton className="mt-6 h-96" />
      ) : error || !data ? (
        <Card className="mt-6">
          <EmptyState title={error?.message ?? tc('errorGeneric')} />
        </Card>
      ) : (
        <Card className="mt-6">
          <h1 className="font-display text-2xl font-semibold">Pre-visit summary</h1>
          <p className="text-sm text-muted">
            {data.patient.firstName}
            {data.patient.age !== null ? ` · ${data.patient.age}` : ''}
            {data.patient.sex ? ` ${data.patient.sex}` : ''} · shared {new Date(data.sharedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}
          </p>
          <p className="mt-4 flex items-start gap-2 rounded-card border border-[#f3dfb3] bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink">
            <ShieldAlert aria-hidden className="mt-0.5 size-5 shrink-0" />
            {data.aiLabel}
          </p>
          <div className="mt-6 flex flex-col gap-4">
            <Lines title={tf('openings.hpi')} lines={[data.summary.subjective.chiefComplaint, ...data.summary.subjective.historyOfPresentIllness]} />
            <Lines title={tf('openings.meds')} lines={data.summary.subjective.medications} />
            <Lines title={tf('openings.allergies')} lines={data.summary.subjective.allergies} />
            <Lines title={tf('openings.questions')} lines={data.summary.subjective.patientQuestions} />
          </div>
          <p className="mt-6 text-sm text-muted">Link works until {new Date(data.expiresAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}. The patient can stop it at any time.</p>
        </Card>
      )}
    </main>
  );
}
