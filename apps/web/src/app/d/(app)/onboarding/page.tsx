'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, Circle, Upload } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { DOC_KINDS, type DocKind, type OnboardingView } from '@medicos/shared/client';
import { Badge, Button, Card, Field, Input, Select, Skeleton, Textarea, cn } from '@medicos/ui';
import { api, ApiError } from '@/lib/api';
import { useDoctor } from '@/lib/use-doctor';

const KEY = ['doctor-onboarding'] as const;
type Hours = Record<number, { open: boolean; start: string; end: string }>;

/** Spec §7.2 steps 3–7 on one page: documents, clinic + hours + fee, about. Ends in "Profile live". */
export default function OnboardingPage() {
  const t = useTranslations('onboarding');
  useDoctor();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<OnboardingView>('/doctor/onboarding') });
  if (!data) return <Skeleton className="h-96" />;
  const tone = data.status === 'verified' ? 'brand' : data.status === 'pending' ? 'accent' : 'danger';
  return (
    <div className="animate-in mx-auto flex max-w-3xl flex-col gap-6">
      <div>
        <p className="text-sm font-medium text-brand">{t('progress')}</p>
        <h1 className="mt-1 font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
      </div>
      <div role="status" className={cn('rounded-card border p-4 font-medium', tone === 'brand' ? 'border-brand/30 bg-brand-tint text-brand-deep' : tone === 'accent' ? 'border-accent/30 bg-accent-soft text-ink' : 'border-danger/30 bg-danger-soft text-danger')}>
        {t(`status.${data.status}`)}
        {data.rejectionNote ? <p className="mt-1 text-sm font-normal">{data.rejectionNote}</p> : null}
        {data.status === 'verified' ? (
          <Button asChild className="mt-3">
            <Link href="/d/today">{t('goToday')}</Link>
          </Button>
        ) : null}
      </div>
      <Documents data={data} />
      <ClinicForm data={data} />
      <About data={data} />
    </div>
  );
}

function Section({ title, done, children }: { title: string; done: boolean; children: ReactNode }) {
  const t = useTranslations('onboarding');
  return (
    <Card className="p-5 md:p-6">
      <div className="flex items-center gap-2">
        {done ? <CheckCircle2 aria-hidden className="size-5 text-brand" /> : <Circle aria-hidden className="size-5 text-muted" />}
        <h2 className="font-display text-xl font-semibold">{title}</h2>
        <Badge tone={done ? 'brand' : 'neutral'} className="ml-auto">
          {done ? t('done') : t('todo')}
        </Badge>
      </div>
      <div className="mt-4">{children}</div>
    </Card>
  );
}

function useSave() {
  const qc = useQueryClient();
  return (data: OnboardingView) => qc.setQueryData(KEY, data);
}

function Documents({ data }: { data: OnboardingView }) {
  const t = useTranslations('onboarding');
  const save = useSave();
  const upload = useMutation({
    mutationFn: async ({ kind, file }: { kind: DocKind; file: File }) => {
      const body = new FormData();
      body.set('kind', kind);
      body.set('file', file);
      const res = await fetch('/api/doctor/onboarding/documents', { method: 'POST', body });
      const json: unknown = await res.json();
      if (!res.ok) throw new ApiError(res.status, 'UPLOAD', (json as { error?: { message?: string } }).error?.message ?? 'Upload failed');
      return json as OnboardingView;
    },
    onSuccess: save,
  });
  return (
    <Section title={t('docsTitle')} done={data.steps.documents}>
      <p className="text-sm text-muted">{t('docsBody')}</p>
      <ul className="mt-4 divide-y divide-line rounded-card border border-line">
        {DOC_KINDS.map((kind) => {
          const has = data.documents.some((d) => d.kind === kind);
          const required = kind === 'registration_certificate' || kind === 'government_id';
          return (
            <li key={kind} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <span className="min-w-0 flex-1 font-medium">
                {t(`kinds.${kind}`)}
                {required && !has ? <span className="ml-2 text-sm text-danger">{t('required')}</span> : null}
              </span>
              {has ? <Badge tone="brand">{t('uploaded')}</Badge> : null}
              <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-[var(--radius-control)] border border-brand px-4 font-semibold text-brand hover:bg-brand-tint focus-within:ring-4 focus-within:ring-brand/20">
                <Upload aria-hidden className="size-5" />
                {t('upload')}
                <span className="sr-only">{t(`kinds.${kind}`)}</span>
                <input
                  type="file"
                  accept="image/jpeg,image/png,application/pdf"
                  className="sr-only"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) upload.mutate({ kind, file });
                    e.target.value = '';
                  }}
                />
              </label>
            </li>
          );
        })}
      </ul>
      {upload.error ? <p role="alert" className="mt-3 font-medium text-danger">{upload.error.message}</p> : null}
    </Section>
  );
}

function ClinicForm({ data }: { data: OnboardingView }) {
  const t = useTranslations('onboarding');
  const save = useSave();
  const days = t.raw('days') as string[];
  const c = data.clinic;
  const [f, setF] = useState({ name: c?.name ?? '', address: c?.address ?? '', city: c?.city ?? '', area: c?.area ?? '', slotMinutes: String(c?.slotMinutes ?? 15), consult: String(c?.fee.consult ?? ''), followUp: String(c?.fee.followUp ?? ''), clinicPay: c ? c.fee.modes.includes('pay_at_clinic') : true, upi: c ? c.fee.modes.includes('upi') : true });
  const [hours, setHours] = useState<Hours>(() =>
    Object.fromEntries(
      [0, 1, 2, 3, 4, 5, 6].map((d) => {
        const h = c?.hours.find((x) => x.weekday === d);
        return [d, { open: c ? !!h : d >= 1 && d <= 6, start: h?.start ?? '10:00', end: h?.end ?? '14:00' }];
      }),
    ),
  );
  const [savedAt, setSavedAt] = useState(0);
  useEffect(() => {
    if (!savedAt) return;
    const id = setTimeout(() => setSavedAt(0), 3000);
    return () => clearTimeout(id);
  }, [savedAt]);
  const submit = useMutation({
    mutationFn: () =>
      api<OnboardingView>('/doctor/onboarding/clinic', {
        method: 'PUT',
        body: JSON.stringify({
          name: f.name,
          address: f.address,
          city: f.city,
          ...(f.area ? { area: f.area } : {}),
          slotMinutes: Number(f.slotMinutes),
          hours: Object.entries(hours).filter(([, h]) => h.open).map(([d, h]) => ({ weekday: Number(d), start: h.start, end: h.end })),
          fee: { consult: Number(f.consult || 0), followUp: Number(f.followUp || 0), modes: [f.clinicPay ? 'pay_at_clinic' : null, f.upi ? 'upi' : null].filter(Boolean) },
        }),
      }),
    onSuccess: (d) => (save(d), setSavedAt(Date.now())),
  });
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF({ ...f, [k]: e.target.value });
  return (
    <Section title={t('clinicTitle')} done={data.steps.clinic}>
      <form
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          submit.mutate();
        }}
        className="flex flex-col gap-4"
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t('clinicName')} htmlFor="c-name">
            <Input id="c-name" required value={f.name} onChange={set('name')} />
          </Field>
          <Field label={t('area')} htmlFor="c-area">
            <Input id="c-area" value={f.area} onChange={set('area')} />
          </Field>
          <Field label={t('address')} htmlFor="c-addr">
            <Input id="c-addr" required value={f.address} onChange={set('address')} />
          </Field>
          <Field label={t('city')} htmlFor="c-city">
            <Input id="c-city" required value={f.city} onChange={set('city')} />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">{t('open')}</legend>
          <div className="mt-2 flex flex-col gap-2">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <div key={d} className="flex flex-wrap items-center gap-3">
                <label className="flex min-h-11 w-24 items-center gap-2 font-medium">
                  <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={hours[d]!.open} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d]!, open: e.target.checked } })} />
                  {days[d]}
                </label>
                <Input aria-label={`${days[d]} ${t('from')}`} type="time" className="w-32" disabled={!hours[d]!.open} value={hours[d]!.start} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d]!, start: e.target.value } })} />
                <span className="text-muted">–</span>
                <Input aria-label={`${days[d]} ${t('to')}`} type="time" className="w-32" disabled={!hours[d]!.open} value={hours[d]!.end} onChange={(e) => setHours({ ...hours, [d]: { ...hours[d]!, end: e.target.value } })} />
              </div>
            ))}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t('slot')} htmlFor="c-slot">
            <Select id="c-slot" value={f.slotMinutes} onChange={set('slotMinutes')}>
              {[10, 15, 20, 30].map((n) => (
                <option key={n} value={n}>
                  {t('minutes', { n })}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('consult')} htmlFor="c-fee">
            <Input id="c-fee" type="number" min={0} inputMode="numeric" required value={f.consult} onChange={set('consult')} />
          </Field>
          <Field label={t('followUp')} htmlFor="c-fu">
            <Input id="c-fu" type="number" min={0} inputMode="numeric" required value={f.followUp} onChange={set('followUp')} />
          </Field>
        </div>
        <fieldset>
          <legend className="text-sm font-semibold">{t('modes')}</legend>
          <div className="mt-2 flex gap-4">
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={f.clinicPay} onChange={(e) => setF({ ...f, clinicPay: e.target.checked })} />
              {t('payAtClinic')}
            </label>
            <label className="flex min-h-11 items-center gap-2">
              <input type="checkbox" className="size-5 accent-[var(--brand)]" checked={f.upi} onChange={(e) => setF({ ...f, upi: e.target.checked })} />
              {t('upi')}
            </label>
          </div>
          <p className="mt-1 text-sm text-muted">{t('feeNote')}</p>
        </fieldset>
        {submit.error ? <p role="alert" className="font-medium text-danger">{submit.error.message}</p> : null}
        <div className="flex items-center gap-3">
          <Button type="submit" loading={submit.isPending}>
            {t('save')}
          </Button>
          {savedAt ? <span role="status" className="text-sm font-medium text-brand">{t('saved')}</span> : null}
        </div>
      </form>
    </Section>
  );
}

function About({ data }: { data: OnboardingView }) {
  const t = useTranslations('onboarding');
  const save = useSave();
  const [about, setAbout] = useState(data.about ?? '');
  const submit = useMutation({ mutationFn: () => api<OnboardingView>('/doctor/onboarding/profile', { method: 'PUT', body: JSON.stringify({ about }) }), onSuccess: save });
  return (
    <Section title={t('aboutTitle')} done={data.steps.profile}>
      <Field label={t('aboutLabel')} htmlFor="about" hint={t('aboutHint')}>
        <Textarea id="about" rows={4} maxLength={800} value={about} onChange={(e) => setAbout(e.target.value)} />
      </Field>
      <Button className="mt-3" loading={submit.isPending} onClick={() => submit.mutate()}>
        {t('save')}
      </Button>
    </Section>
  );
}
