'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, FileText, MessageSquareQuote, Plus, Printer, SquarePen, ThumbsDown, ThumbsUp, Trash2, Zap } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRef, useState } from 'react';
import { AI_DRAFT_LABEL, type DoctorSummaryView, type SummaryLine } from '@medicos/shared/client';
import { Badge, Button, Card, Dialog, Input, SoapSection, Textarea, Toast } from '@medicos/ui';
import { ApiError, post } from '@/lib/api';

/** One summary line with its source — the patient's own words (rule 7), on hover/focus. */
function Sourced({ line }: { line: SummaryLine }) {
  const t = useTranslations('doctor');
  const quote = line.sources.map((s) => s.quote).join(' … ');
  return (
    <li className="group relative flex items-start gap-2">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-brand" aria-hidden />
      <span className="flex-1">{line.text}</span>
      <button type="button" className="peer grid size-8 shrink-0 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-brand" aria-label={`${t('source')}: “${quote}”`}>
        <MessageSquareQuote aria-hidden className="size-4 stroke-[1.75]" />
      </button>
      <span role="tooltip" className="pointer-events-none absolute right-0 top-full z-10 mt-1 hidden max-w-xs rounded-lg bg-ink px-3 py-2 text-sm text-white shadow-lg peer-hover:block peer-focus-visible:block">
        “{quote}”
      </span>
    </li>
  );
}

function Group({ title, lines }: { title: string; lines: SummaryLine[] }) {
  if (!lines.length) return null;
  return (
    <div className="mt-3 first:mt-0">
      <p className="text-sm font-semibold text-muted">{title}</p>
      <ul className="mt-1 flex flex-col gap-0.5">
        {lines.map((l, i) => (
          <Sourced key={i} line={l} />
        ))}
      </ul>
    </div>
  );
}

interface RxRow {
  drug: string;
  dose: string;
  frequency: string;
  duration: string;
  instructions: string;
}
const emptyRx = (): RxRow => ({ drug: '', dose: '', frequency: '', duration: '', instructions: '' });

export function SummaryPanel({ view }: { view: DoctorSummaryView }) {
  const t = useTranslations('doctor');
  const tf = useTranslations('finalise');
  const qc = useQueryClient();
  const [form, setForm] = useState({ assessment: '', plan: '', examination: '', testsAdvised: '', followUpDate: '' });
  const [rx, setRx] = useState<RxRow[]>([]);
  const [confirm, setConfirm] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [rated, setRated] = useState(false);
  const assessmentRef = useRef<HTMLTextAreaElement>(null);
  const s = view.summary;
  const so = s?.subjective;

  const finalise = useMutation({
    mutationFn: () =>
      post<DoctorSummaryView>(`/doctor/appointments/${view.appointmentId}/finalise`, {
        assessment: form.assessment,
        plan: form.plan,
        ...(form.examination ? { examination: form.examination } : {}),
        ...(form.testsAdvised ? { testsAdvised: form.testsAdvised } : {}),
        ...(form.followUpDate ? { followUpDate: form.followUpDate } : {}),
        prescription: rx.filter((r) => r.drug.trim()).map((r) => ({ ...r, instructions: r.instructions || undefined })),
      }),
    onSuccess: (v) => {
      qc.setQueryData(['doctor-appt', view.appointmentId], v);
      void qc.invalidateQueries({ queryKey: ['doctor-queue'] });
      setConfirm(false);
      setToast(tf('done'));
    },
    onError: (e) => {
      setConfirm(false);
      setError(e instanceof ApiError ? e.message : tf('required'));
    },
  });
  const feedback = useMutation({
    mutationFn: (useful: boolean) => post(`/doctor/summaries/${view.summaryId}/feedback`, { useful }),
    onSuccess: () => setRated(true),
  });
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const age = view.patient.age !== null ? ` · ${view.patient.age}` : '';
  const sex = view.patient.gender === 'male' ? ' M' : view.patient.gender === 'female' ? ' F' : '';

  return (
    <Card className="p-0 md:p-0 print:border-0 print:shadow-none">
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-line p-5">
        <div>
          <p className="font-display text-xl font-semibold">
            {view.patient.name}
            <span className="font-sans text-base font-normal text-muted">
              {age}
              {sex}
            </span>
          </p>
          <p className="font-mono text-sm text-muted">{view.patient.medicosId}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge tone={view.visitType === 'follow_up' ? 'neutral' : 'brand'} dot>
              {view.visitType === 'follow_up' ? t('visitFollow') : t('visitNew')}
            </Badge>
            {s ? <Badge tone="brand">{t('aiDone')}</Badge> : null}
            {view.safetyShown ? <Badge tone="neutral">{t('safetyMarker')}</Badge> : null}
            {view.attachments.map((a) => (
              <a key={a.id} href={a.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-sm font-medium hover:bg-brand-soft">
                <FileText aria-hidden className="size-3.5" />
                {a.label ?? a.kind}
              </a>
            ))}
          </div>
        </div>
      </header>

      <div className="flex flex-col gap-4 p-5">
        {s && so ? (
          <>
            {s.thirtySecondSummary.length ? (
              <section className="rounded-card bg-surface-2 p-4 md:p-5">
                <h2 className="flex items-center gap-2 font-display text-lg font-semibold">
                  <Zap aria-hidden className="size-5 stroke-[1.75] text-brand" />
                  {t('thirty')}
                </h2>
                <ul className="mt-3 flex flex-col gap-0.5">
                  {s.thirtySecondSummary.map((l, i) => (
                    <Sourced key={i} line={l} />
                  ))}
                </ul>
              </section>
            ) : null}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-display text-xl font-semibold">{t('summaryTitle')}</h2>
              {view.summaryStatus !== 'reviewed' ? (
                <Badge tone="danger" dot>
                  {t('reviewRequired')}
                </Badge>
              ) : null}
            </div>
            <p className="text-sm font-medium text-muted">{AI_DRAFT_LABEL}</p>
            <SoapSection letter="S" title={t('subjective')}>
              <Group title={t('summaryTitle')} lines={[so.chiefComplaint]} />
              <Group title={tf('openings.hpi')} lines={so.historyOfPresentIllness} />
              <Group title={tf('openings.negatives')} lines={so.pertinentNegatives} />
              <Group title={tf('openings.past')} lines={so.pastHistory} />
              <Group title={tf('openings.meds')} lines={so.medications} />
              <Group title={tf('openings.allergies')} lines={so.allergies} />
              <Group title={tf('openings.social')} lines={so.familySocial} />
              <Group title={tf('openings.extras')} lines={so.specialtyExtras} />
              <Group title={tf('openings.concern')} lines={so.patientConcern ? [so.patientConcern] : []} />
              <Group title={tf('openings.questions')} lines={so.patientQuestions} />
            </SoapSection>
            <SoapSection letter="O" title={t('objective')}>
              <Group title={tf('openings.readings')} lines={s.objectivePatientReported.homeReadings} />
              <p className="mt-3 text-sm italic text-muted">{t('exam')}</p>
            </SoapSection>
            {s.historyGapsForDoctor.length ? (
              <div className="rounded-card border border-line p-4">
                <p className="text-sm font-semibold text-muted">{tf('openings.gaps')}</p>
                <ul className="mt-1 list-inside list-disc text-[15px]">
                  {s.historyGapsForDoctor.map((g) => (
                    <li key={g}>{g}</li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : (
          <p className="rounded-card bg-surface-2 p-4 text-muted">{tf('noSummary')}</p>
        )}

        {view.note ? (
          <SoapSection letter="A" title={`${t('assessment')} · ${t('plan')}`}>
            <p className="whitespace-pre-wrap">{view.note.assessment}</p>
            <p className="mt-3 whitespace-pre-wrap">{view.note.plan}</p>
            {view.note.prescription.length ? (
              <ul className="mt-3 list-inside list-disc text-[15px]">
                {view.note.prescription.map((r, i) => (
                  <li key={i}>
                    {r.drug} — {r.dose}, {r.frequency}, {r.duration}
                    {r.instructions ? ` (${r.instructions})` : ''}
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="mt-3 text-sm text-muted">{tf('finalisedBy', { name: view.note.doctorName, date: new Date(view.note.finalisedAt).toLocaleString('en-IN') })}</p>
          </SoapSection>
        ) : (
          <>
            {/* Rule 5: Assessment and Plan are written by the doctor only. */}
            <SoapSection letter="A" title={t('assessment')} forDoctor forDoctorLabel={t('forDoctor')}>
              <label className="sr-only" htmlFor="assessment">{t('assessment')}</label>
              <Textarea id="assessment" ref={assessmentRef} rows={3} placeholder={t('assessmentPlaceholder')} value={form.assessment} onChange={set('assessment')} />
              <label className="mt-3 block text-sm font-semibold" htmlFor="examination">{tf('examination')}</label>
              <Textarea id="examination" rows={2} className="mt-1.5" value={form.examination} onChange={set('examination')} />
            </SoapSection>
            <SoapSection letter="P" title={t('plan')} forDoctor forDoctorLabel={t('forDoctor')}>
              <label className="sr-only" htmlFor="plan">{t('plan')}</label>
              <Textarea id="plan" rows={3} placeholder={t('planPlaceholder')} value={form.plan} onChange={set('plan')} />
              <p className="mt-4 text-sm font-semibold">{tf('rxTitle')}</p>
              <div className="mt-2 flex flex-col gap-3">
                {rx.map((r, i) => (
                  <fieldset key={i} className="grid gap-2 rounded-[var(--radius-control)] border border-line p-3 sm:grid-cols-2 lg:grid-cols-[2fr_1fr_1fr_1fr_auto]">
                    <legend className="sr-only">{`${tf('rxTitle')} ${i + 1}`}</legend>
                    {(['drug', 'dose', 'frequency', 'duration'] as const).map((k) => (
                      <Input key={k} aria-label={tf(`rx${k[0]!.toUpperCase()}${k.slice(1)}` as 'rxDrug')} placeholder={tf(`rx${k[0]!.toUpperCase()}${k.slice(1)}` as 'rxDrug')} value={r[k]} onChange={(e) => setRx((all) => all.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))} />
                    ))}
                    <Button type="button" variant="ghost" size="icon" aria-label={tf('rxRemove')} onClick={() => setRx((all) => all.filter((_, j) => j !== i))}>
                      <Trash2 aria-hidden />
                    </Button>
                    <Input className="sm:col-span-2 lg:col-span-5" aria-label={tf('rxInstructions')} placeholder={tf('rxInstructions')} value={r.instructions} onChange={(e) => setRx((all) => all.map((x, j) => (j === i ? { ...x, instructions: e.target.value } : x)))} />
                  </fieldset>
                ))}
                <Button type="button" variant="secondary" size="sm" className="self-start" onClick={() => setRx((all) => [...all, emptyRx()])}>
                  <Plus aria-hidden />
                  {tf('rxAdd')}
                </Button>
              </div>
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-semibold" htmlFor="tests">{tf('testsAdvised')}</label>
                  <Input id="tests" className="mt-1.5" value={form.testsAdvised} onChange={set('testsAdvised')} />
                </div>
                <div>
                  <label className="text-sm font-semibold" htmlFor="followup">{tf('followUp')}</label>
                  <Input id="followup" type="date" className="mt-1.5" value={form.followUpDate} onChange={set('followUpDate')} />
                </div>
              </div>
            </SoapSection>
          </>
        )}
        {error ? <p role="alert" className="font-medium text-danger">{error}</p> : null}
      </div>

      <footer className="no-print sticky bottom-0 flex flex-wrap items-center justify-end gap-2 rounded-b-card border-t border-line bg-surface/95 p-4 backdrop-blur">
        {view.note ? (
          view.summaryId && !rated ? (
            <div className="mr-auto flex items-center gap-2 text-sm">
              <span className="font-medium">{tf('useful')}</span>
              <Button variant="ghost" size="sm" onClick={() => feedback.mutate(true)} aria-label={tf('yes')}>
                <ThumbsUp aria-hidden />
                {tf('yes')}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => feedback.mutate(false)} aria-label={tf('no')}>
                <ThumbsDown aria-hidden />
                {tf('no')}
              </Button>
            </div>
          ) : rated ? (
            <p className="mr-auto text-sm text-muted">{tf('thanks')}</p>
          ) : null
        ) : (
          <Button variant="secondary" onClick={() => assessmentRef.current?.focus()}>
            <SquarePen aria-hidden />
            {t('editDraft')}
          </Button>
        )}
        <Button variant="secondary" onClick={() => window.print()}>
          <Printer aria-hidden />
          {t('print')}
        </Button>
        {view.note ? null : (
          <Button
            onClick={() => {
              setError(null);
              if (!form.assessment.trim() || !form.plan.trim()) return setError(tf('required'));
              setConfirm(true);
            }}
          >
            <CheckCircle2 aria-hidden />
            {t('finalise')}
          </Button>
        )}
      </footer>

      <Dialog open={confirm} onClose={() => setConfirm(false)} title={tf('confirmTitle')}>
        <p className="text-muted">{tf('confirmBody')}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setConfirm(false)}>
            {tf('cancel')}
          </Button>
          <Button loading={finalise.isPending} onClick={() => finalise.mutate()}>
            {tf('confirm')}
          </Button>
        </div>
      </Dialog>
      <Toast message={toast} onDone={() => setToast(null)} />
    </Card>
  );
}
