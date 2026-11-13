'use client';
import { BadgeCheck, MapPin, Search } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useState, type FormEvent } from 'react';
import type { DoctorCard } from '@medicos/shared/client';
import { Badge, Button, Card, EmptyState, Field, Input, Select, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { fmtDateTime, useDoctors, type DoctorFilters } from '@/lib/use-booking';
import { usePatientGate } from '@/lib/use-me';

const SPECIALTIES = ['general_medicine', 'dermatology', 'paediatrics', 'gynaecology'] as const;
const FEES = ['300', '500', '800', '1500'];

/** Choose your doctor (spec §7.1 #7): verified doctors, normal filters — no AI matching (rule 3). */
export default function DoctorsPage() {
  const t = useTranslations('booking');
  usePatientGate();
  const session = useSearchParams().get('session');
  const [draft, setDraft] = useState<DoctorFilters>({});
  const [filters, setFilters] = useState<DoctorFilters>({});
  const { data, isLoading, isError, refetch } = useDoctors(filters);

  const apply = (e: FormEvent) => {
    e.preventDefault();
    setFilters({ ...draft, area: draft.area?.trim() || undefined });
  };

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{session ? t('afterInterview') : t('subtitle')}</p>

      <form onSubmit={apply} className="mt-6 grid gap-3 rounded-card border border-line bg-surface p-4 shadow-sm md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
        <Field label={t('specialty')} htmlFor="f-spec">
          <Select id="f-spec" value={draft.specialty ?? ''} onChange={(e) => setDraft({ ...draft, specialty: e.target.value || undefined })}>
            <option value="">{t('anySpecialty')}</option>
            {SPECIALTIES.map((s) => (
              <option key={s} value={s}>
                {t(`specialties.${s}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('area')} htmlFor="f-area">
          <Input id="f-area" value={draft.area ?? ''} placeholder={t('areaPlaceholder')} onChange={(e) => setDraft({ ...draft, area: e.target.value })} />
        </Field>
        <Field label={t('maxFee')} htmlFor="f-fee">
          <Select id="f-fee" value={draft.maxFee ?? ''} onChange={(e) => setDraft({ ...draft, maxFee: e.target.value || undefined })}>
            <option value="">{t('anyFee')}</option>
            {FEES.map((f) => (
              <option key={f} value={f}>
                ≤ ₹{f}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" size="lg">
          <Search aria-hidden />
          {t('search')}
        </Button>
      </form>

      <section aria-live="polite" className="mt-6 flex flex-col gap-3">
        {isLoading ? (
          [0, 1, 2].map((i) => <Skeleton key={i} className="h-28" />)
        ) : isError ? (
          <Card>
            <EmptyState title={t('noneTitle')} action={<Button onClick={() => void refetch()}>{t('search')}</Button>} />
          </Card>
        ) : !data?.length ? (
          <Card>
            <EmptyState art="people" title={t('noneTitle')} body={t('noneBody')} />
          </Card>
        ) : (
          <>
            <p className="text-sm text-muted">{t('results', { count: data.length })}</p>
            {data.map((d) => (
              <DoctorRow key={d.id} d={d} session={session} />
            ))}
          </>
        )}
      </section>
    </div>
  );
}

function DoctorRow({ d, session }: { d: DoctorCard; session: string | null }) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const href = `/p/doctors/${d.id}${session ? `?session=${session}` : ''}`;
  return (
    <Card className="flex flex-col gap-4 sm:flex-row sm:items-center">
      <span aria-hidden className="grid size-14 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-lg font-semibold text-brand-deep">
        {d.name.replace(/^Dr\.?\s*/, '').slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">{d.name}</h2>
          <Badge tone="brand">
            <BadgeCheck aria-hidden className="size-4" />
            {t('verified')}
          </Badge>
        </div>
        <p className="text-sm text-muted">
          {t(`specialties.${d.specialty as 'general_medicine'}`)} · {d.degrees.join(', ')}
          {d.yearsExperience ? ` · ${t('years', { n: d.yearsExperience })}` : ''}
        </p>
        {d.clinic ? (
          <p className="mt-1 flex items-center gap-1 text-sm text-muted">
            <MapPin aria-hidden className="size-4" />
            {d.clinic.name}, {d.clinic.area ? `${d.clinic.area}, ` : ''}
            {d.clinic.city}
          </p>
        ) : null}
        <p className="mt-1 text-sm">
          <span className="font-semibold">{d.fee ? t('fee', { fee: d.fee }) : t('noFee')}</span>
          <span className="text-muted"> · {d.nextSlot ? t('nextSlot', { time: fmtDateTime(d.nextSlot, locale) }) : t('noSlot')}</span>
        </p>
      </div>
      <Button asChild size="lg" block="phone">
        <Link href={href}>{t('select', { name: d.name })}</Link>
      </Button>
    </Card>
  );
}
