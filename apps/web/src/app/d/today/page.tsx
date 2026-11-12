'use client';
import { AlertTriangle, ArrowLeft, CheckCircle2, ChevronRight, Clock, FileText, Info, MessageSquareQuote, Plus, Printer, QrCode, SquarePen, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { AI_DRAFT_LABEL } from '@medicos/shared/client';
import { Badge, Button, Card, SectionHeader, SoapSection, StatusTag, Tabs, TimelineItem, Toast, UsageBar, cn } from '@medicos/ui';
import { SAMPLE_QUEUE, type QueueRow } from './sample-data';

export default function DoctorTodayPage() {
  return (
    <Suspense>
      <Today />
    </Suspense>
  );
}

function Today() {
  const t = useTranslations('doctor');
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [tab, setTab] = useState<'today' | 'upcoming'>('today');
  const [toast, setToast] = useState<string | null>(null);
  const selectedId = params.get('patient') ?? SAMPLE_QUEUE[0]!.id;
  const selected = SAMPLE_QUEUE.find((r) => r.id === selectedId) ?? SAMPLE_QUEUE[0]!;
  const showDetailOnPhone = params.has('patient');
  // Safety marker rows first (neutral marker, not a score), then by time.
  const rows = [...SAMPLE_QUEUE].sort((a, b) => Number(b.safety) - Number(a.safety) || a.time.localeCompare(b.time));
  const select = (id: string) => router.replace(`${pathname}?patient=${id}`, { scroll: false });

  return (
    <div className="p-4 md:p-6">
      <p className="mb-4 flex items-start gap-2 rounded-card border border-[#f3dfb3] bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('preview')}
      </p>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[360px_minmax(0,1fr)]">
        {/* Queue */}
        <Card className={cn('h-fit min-w-0 p-0 md:p-0 lg:sticky lg:top-20', showDetailOnPhone && 'hidden lg:block')}>
          <div className="flex items-center justify-between gap-3 p-4 pb-0">
            <h1 className="font-display text-xl font-semibold">{t('queue')}</h1>
            <Button size="sm" onClick={() => setToast(t('preview'))}>
              <Plus aria-hidden />
              {t('addWalkin')}
            </Button>
          </div>
          <div className="px-4 pt-2">
            <Tabs
              label={t('queue')}
              value={tab}
              onChange={setTab}
              items={[
                { value: 'today', label: t('today', { n: SAMPLE_QUEUE.length }) },
                { value: 'upcoming', label: t('upcoming', { n: 8 }) },
              ]}
            />
          </div>
          <ul className="flex flex-col p-2" aria-label={t('queue')}>
            {rows.map((r) => (
              <li key={r.id}>
                <button
                  type="button"
                  aria-current={r.id === selected.id ? 'true' : undefined}
                  onClick={() => select(r.id)}
                  className={cn(
                    'flex w-full items-start gap-3 rounded-[var(--radius-control)] border-l-[3px] border-transparent px-3 py-3 text-left transition-colors hover:bg-surface-2',
                    r.id === selected.id && 'border-brand bg-brand-soft hover:bg-brand-soft',
                  )}
                >
                  <span className="tabular w-12 shrink-0 pt-0.5 text-sm font-semibold text-muted">{r.time}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{r.label}</span>
                    <span className="block truncate text-sm text-muted">{r.complaint}</span>
                    <span className="mt-2 flex flex-wrap gap-1.5">
                      <StatusTag status={r.status}>{t(STATUS_LABEL[r.status])}</StatusTag>
                      {r.safety ? (
                        <Badge tone="neutral" className="whitespace-normal text-[13px]">
                          <AlertTriangle aria-hidden className="size-3.5" />
                          {t('safetyMarker')}
                        </Badge>
                      ) : null}
                    </span>
                  </span>
                  <ChevronRight aria-hidden className="mt-1 size-4 shrink-0 text-muted lg:hidden" />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        {/* Summary panel */}
        <div className={cn('min-w-0', !showDetailOnPhone && 'hidden lg:block')}>
          <Button variant="ghost" className="-ml-2 mb-2 lg:hidden" onClick={() => router.replace(pathname, { scroll: false })}>
            <ArrowLeft aria-hidden />
            {t('backToQueue')}
          </Button>
          <SummaryPanel row={selected} onAction={() => setToast(t('preview'))} />
        </div>
      </div>

      {/* Bottom row */}
      <div className={cn('mt-5 grid gap-5 md:grid-cols-2 xl:grid-cols-3', showDetailOnPhone && 'hidden lg:grid')}>
        <Card>
          <SectionHeader title={t('history')} />
          <ol className="mt-4">
            {['15 Oct 2026', '2 Aug 2026', '11 Mar 2026'].map((d, i, all) => (
              <TimelineItem key={d} date={d} title={t('completed')} icon={<CheckCircle2 aria-hidden />} last={i === all.length - 1} />
            ))}
          </ol>
        </Card>
        <Card>
          <SectionHeader title={t('schedule')} />
          <ul className="mt-4 divide-y divide-line">
            {SAMPLE_QUEUE.slice(2, 6).map((r) => (
              <li key={r.id} className="flex items-center gap-3 py-2.5">
                <span className="tabular w-14 text-sm font-semibold text-muted">{r.time}</span>
                <span className="min-w-0 flex-1 truncate font-mono text-sm">{r.medicosId}</span>
                <StatusTag status={r.status}>{t(STATUS_LABEL[r.status])}</StatusTag>
              </li>
            ))}
          </ul>
        </Card>
        <Card className="md:col-span-2 xl:col-span-1">
          <SectionHeader title={t('month')} />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MiniStat label={t('reviewed')} value="42" />
            <MiniStat label={t('saved')} value="126" />
            <MiniStat label={t('completed')} value="38" />
            <MiniStat label={t('quality')} value="94%" />
          </div>
          <div className="mt-5">
            <UsageBar used={42} total={300} label={t('usage')} />
          </div>
        </Card>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}

const STATUS_LABEL = { ready: 'statusReady', progress: 'statusProgress', walkin: 'statusWalkin', idle: 'statusIdle' } as const;

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[var(--radius-control)] bg-surface-2 p-3">
      <p className="text-sm text-muted">{label}</p>
      <p className="tabular mt-1 font-display text-2xl font-semibold">{value}</p>
    </div>
  );
}

/** One summary line with its source: the patient's own words (rule 7), shown on hover/focus. */
function SourcedLine({ text, quote }: { text: string; quote: string }) {
  const t = useTranslations('doctor');
  return (
    <li className="group relative flex items-start gap-2">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
      <span className="flex-1">{text}</span>
      <button type="button" className="peer grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-brand" aria-label={`${t('source')}: “${quote}”`}>
        <MessageSquareQuote aria-hidden className="size-4 stroke-[1.75]" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden max-w-xs rounded-lg bg-ink px-3 py-2 text-sm text-white shadow-lg peer-hover:block peer-focus-visible:block">
        “{quote}”
      </span>
    </li>
  );
}

function SummaryPanel({ row, onAction }: { row: QueueRow; onAction: () => void }) {
  const t = useTranslations('doctor');
  if (!row.summary) {
    return (
      <Card className="flex min-h-80 flex-col items-center justify-center gap-2 text-center">
        <Clock aria-hidden className="size-8 stroke-[1.5] text-muted" />
        <p className="font-semibold">{row.label}</p>
        <p className="text-muted">{t(STATUS_LABEL[row.status])}</p>
      </Card>
    );
  }
  const s = row.summary;
  return (
    <Card className="p-0 md:p-0">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <p className="font-mono text-lg font-semibold">{row.medicosId}</p>
          <p className="text-sm text-muted">
            {t('arrived', { time: row.time })} · {row.followUp ? t('visitFollow') : t('visitNew')}
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone="brand" dot>
              {t('aiDone')}
            </Badge>
            {s.files.map((f) => (
              <Badge key={f} tone="neutral">
                <FileText aria-hidden className="size-3.5" />
                {f}
              </Badge>
            ))}
          </div>
        </div>
        <Button variant="secondary" onClick={onAction}>
          <QrCode aria-hidden />
          {t('scanQr')}
        </Button>
      </header>

      <div className="flex flex-col gap-4 p-5">
        <section className="rounded-card bg-surface-2 p-4 md:p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
            <Zap aria-hidden className="size-5 stroke-[1.75] text-brand" />
            {t('thirty')}
          </h2>
          <ul className="mt-3 flex flex-col gap-1.5">
            {s.thirty.map((l) => (
              <li key={l} className="flex items-start gap-2">
                <CheckCircle2 aria-hidden className="mt-0.5 size-4 shrink-0 text-brand" />
                {l}
              </li>
            ))}
          </ul>
        </section>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold">{t('summaryTitle')}</h2>
          <Badge tone="danger" dot>
            {t('reviewRequired')}
          </Badge>
        </div>
        <p className="text-sm font-medium text-muted">{AI_DRAFT_LABEL}</p>

        <SoapSection letter="S" title={t('subjective')}>
          <ul className="flex flex-col gap-1">
            {s.subjective.map((l) => (
              <SourcedLine key={l.text} {...l} />
            ))}
          </ul>
        </SoapSection>
        <SoapSection letter="O" title={t('objective')}>
          <ul className="flex flex-col gap-1">
            {s.objective.map((l) => (
              <SourcedLine key={l.text} {...l} />
            ))}
          </ul>
          <p className="mt-3 text-sm italic text-muted">{t('exam')}</p>
        </SoapSection>
        {/* Rule 5: A and P are ALWAYS empty editors for the doctor. */}
        <SoapSection letter="A" title={t('assessment')} forDoctor forDoctorLabel={t('forDoctor')}>
          <label className="sr-only" htmlFor="assessment">
            {t('assessment')}
          </label>
          <textarea id="assessment" rows={3} placeholder={t('assessmentPlaceholder')} className="w-full resize-y rounded-[var(--radius-control)] border border-line bg-surface p-3 text-[15px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15" />
        </SoapSection>
        <SoapSection letter="P" title={t('plan')} forDoctor forDoctorLabel={t('forDoctor')}>
          <label className="sr-only" htmlFor="plan">
            {t('plan')}
          </label>
          <textarea id="plan" rows={3} placeholder={t('planPlaceholder')} className="w-full resize-y rounded-[var(--radius-control)] border border-line bg-surface p-3 text-[15px] focus:border-brand focus:outline-none focus:ring-4 focus:ring-brand/15" />
        </SoapSection>
      </div>

      <footer className="sticky bottom-0 flex flex-wrap justify-end gap-2 rounded-b-card border-t border-line bg-surface/95 p-4 backdrop-blur">
        <Button variant="secondary" onClick={onAction}>
          <SquarePen aria-hidden />
          {t('editDraft')}
        </Button>
        <Button variant="secondary" onClick={onAction}>
          <Printer aria-hidden />
          {t('print')}
        </Button>
        <Button onClick={onAction}>
          <CheckCircle2 aria-hidden />
          {t('finalise')}
        </Button>
      </footer>
    </Card>
  );
}

