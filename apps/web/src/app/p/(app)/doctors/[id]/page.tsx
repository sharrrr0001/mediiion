'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, BadgeCheck, CheckCircle2, MapPin, ShieldCheck, Sparkles } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useState } from 'react';
import type { AppointmentView } from '@medicos/shared/client';
import { Badge, Button, Card, Chip, Select, Skeleton, cn } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { ApiError, post } from '@/lib/api';
import { APPOINTMENTS_KEY, addDays, fmtDateTime, fmtTime, istToday, useDoctorProfile, useSlots } from '@/lib/use-booking';
import { useActiveProfile } from '@/lib/use-active-profile';
import { usePatientGate } from '@/lib/use-me';

/** Doctor profile + slot picker + booking confirmation (spec §7.1 #8–9). */
export default function DoctorProfilePage() {
  const t = useTranslations('booking');
  const tc = useTranslations('common');
  const locale = useLocale();
  const { me } = usePatientGate();
  const qc = useQueryClient();
  const { id } = useParams<{ id: string }>();
  const session = useSearchParams().get('session') ?? undefined;
  const { data: d, isLoading } = useDoctorProfile(id);

  const [clinicId, setClinicId] = useState<string>();
  const clinic = d?.clinics.find((c) => c.id === clinicId) ?? d?.clinics[0];
  const today = istToday();
  const [date, setDate] = useState(today);
  const [slot, setSlot] = useState<string | null>(null);
  const [profileId, setProfileId] = useState<string>();
  const { profile: active } = useActiveProfile();
  const forProfile = profileId ?? active?.id ?? me?.profiles[0]?.id;
  const slots = useSlots(id, clinic?.id, date);

  const book = useMutation({
    mutationFn: () => post<AppointmentView>('/appointments', { profileId: forProfile, doctorId: id, clinicId: clinic!.id, startsAt: slot, ...(session ? { sessionId: session } : {}) }),
    onSuccess: () => void qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }),
    onError: () => {
      setSlot(null);
      void slots.refetch();
    },
  });

  if (isLoading || !d || !me) {
    return (
      <div className={`${container} py-6`}>
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (book.data) return <Confirmed a={book.data} />;

  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i));
  const dayNames = t.raw('days') as string[];
  const free = slots.data?.slots.filter((s) => s.free) ?? [];

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <Link href={`/p/doctors${session ? `?session=${session}` : ''}`} className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:text-brand-hover">
        <ArrowLeft aria-hidden className="size-4" />
        {tc('back')}
      </Link>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="min-w-0 p-5 md:p-6">
          <div className="flex items-start gap-4">
            <span aria-hidden className="grid size-16 shrink-0 place-items-center rounded-full bg-brand-soft font-display text-2xl font-semibold text-brand-deep">
              {d.name.replace(/^Dr\.?\s*/, '').slice(0, 1)}
            </span>
            <div>
              <h1 className="font-display text-2xl font-bold tracking-tight">{d.name}</h1>
              <p className="text-muted">
                {t(`specialties.${d.specialty as 'general_medicine'}`)} · {d.degrees.join(', ')}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Badge tone="brand">
                  <BadgeCheck aria-hidden className="size-4" />
                  {t('verified')}
                </Badge>
                {d.yearsExperience ? <Badge>{t('years', { n: d.yearsExperience })}</Badge> : null}
              </div>
            </div>
          </div>
          {d.about ? (
            <section className="mt-6">
              <h2 className="font-semibold">{t('about')}</h2>
              <p className="mt-1 text-muted">{d.about}</p>
            </section>
          ) : null}
          <dl className="mt-6 grid gap-4 sm:grid-cols-2">
            {d.registrationNo ? (
              <div>
                <dt className="flex items-center gap-1 text-sm text-muted">
                  <ShieldCheck aria-hidden className="size-4" />
                  {t('registration')}
                </dt>
                <dd className="font-medium">
                  {d.registrationNo}
                  {d.council ? ` · ${d.council}` : ''}
                </dd>
              </div>
            ) : null}
            {d.languages.length ? (
              <div>
                <dt className="text-sm text-muted">{t('languages')}</dt>
                <dd className="font-medium">{d.languages.map((l) => (l === 'hi' ? 'हिंदी' : l === 'en' ? 'English' : l)).join(', ')}</dd>
              </div>
            ) : null}
          </dl>
          {clinic ? (
            <section className="mt-6 rounded-card border border-line p-4">
              <h2 className="font-semibold">{t('clinic')}</h2>
              {d.clinics.length > 1 ? (
                <Select aria-label={t('clinic')} className="mt-2" value={clinic.id} onChange={(e) => (setClinicId(e.target.value), setSlot(null))}>
                  {d.clinics.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </Select>
              ) : (
                <p className="mt-1 font-medium">{clinic.name}</p>
              )}
              <p className="mt-1 flex items-start gap-1 text-sm text-muted">
                <MapPin aria-hidden className="mt-0.5 size-4 shrink-0" />
                {clinic.address}, {clinic.area ? `${clinic.area}, ` : ''}
                {clinic.city}
              </p>
              {clinic.fee ? (
                <p className="mt-2 text-sm">
                  <span className="font-semibold">{t('fee', { fee: clinic.fee.consult })}</span> · {t('followUp', { fee: clinic.fee.followUp })}
                </p>
              ) : null}
              <h3 className="mt-3 text-sm font-semibold">{t('timings')}</h3>
              <ul className="mt-1 grid grid-cols-2 gap-x-4 text-sm text-muted sm:grid-cols-3">
                {clinic.hours
                  .slice()
                  .sort((a, b) => a.weekday - b.weekday)
                  .map((h) => (
                    <li key={`${h.weekday}-${h.start}`}>
                      {dayNames[h.weekday]} {h.start}–{h.end}
                    </li>
                  ))}
              </ul>
            </section>
          ) : null}
        </Card>

        <Card className="h-fit min-w-0 p-5 lg:sticky lg:top-24">
          <h2 className="font-semibold">{t('pickDate')}</h2>
          <div role="radiogroup" aria-label={t('pickDate')} className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {days.map((day) => {
              const wd = new Date(`${day}T00:00:00Z`).getUTCDay();
              const active = day === date;
              return (
                <button
                  key={day}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => (setDate(day), setSlot(null))}
                  className={cn(
                    'flex min-h-14 min-w-14 flex-col items-center justify-center rounded-[var(--radius-control)] border px-2 text-sm transition-colors',
                    active ? 'border-brand bg-brand text-brand-ink' : 'border-line bg-surface hover:border-brand',
                  )}
                >
                  <span className="font-medium">{dayNames[wd]}</span>
                  <span className="font-display text-lg font-semibold">{Number(day.slice(8))}</span>
                </button>
              );
            })}
          </div>

          <h2 className="mt-5 font-semibold">{t('pickTime')}</h2>
          {slots.isLoading ? (
            <Skeleton className="mt-3 h-24" />
          ) : free.length ? (
            <div role="radiogroup" aria-label={t('pickTime')} className="mt-3 flex flex-wrap gap-2">
              {free.map((s) => (
                <Chip key={s.startsAt} role="radio" aria-checked={slot === s.startsAt} selected={slot === s.startsAt} onClick={() => setSlot(s.startsAt)}>
                  {fmtTime(s.startsAt, locale)}
                </Chip>
              ))}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted">{t('noTimes')}</p>
          )}

          {me.profiles.length > 1 ? (
            <label className="mt-5 block text-sm font-semibold">
              {t('forProfile')}
              <Select className="mt-1" value={forProfile} onChange={(e) => setProfileId(e.target.value)}>
                {me.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </label>
          ) : null}

          {book.error ? (
            <p role="alert" className="mt-4 font-medium text-danger">
              {book.error instanceof ApiError && book.error.code === 'SLOT_TAKEN' ? t('slotTaken') : book.error instanceof ApiError ? book.error.message : tc('errorGeneric')}
            </p>
          ) : null}
          <Button size="lg" block className="mt-5" disabled={!slot} loading={book.isPending} onClick={() => book.mutate()}>
            {book.isPending ? t('booking') : t('book')}
          </Button>
          {slot ? <p className="mt-2 text-center text-sm text-muted">{fmtDateTime(slot, locale)}</p> : null}
        </Card>
      </div>
    </div>
  );
}

function Confirmed({ a }: { a: AppointmentView }) {
  const t = useTranslations('booking');
  const locale = useLocale();
  return (
    <div className={`${container} animate-in flex flex-col items-center py-10 text-center`}>
      <CheckCircle2 aria-hidden className="size-16 text-brand" />
      <h1 className="mt-4 font-display text-3xl font-bold tracking-tight">{t('confirmedTitle')}</h1>
      <Card className="mt-6 w-full max-w-md text-left">
        <p className="font-semibold">{a.doctor.name}</p>
        <p className="text-sm text-muted">{fmtDateTime(a.startsAt, locale)}</p>
        <p className="text-sm text-muted">
          {a.clinic.name}, {a.clinic.address}
        </p>
      </Card>
      {a.summaryAttached ? (
        <p className="mt-4 flex max-w-md items-start gap-2 rounded-card border border-brand/30 bg-brand-tint p-4 text-left font-medium text-brand-deep">
          <ShieldCheck aria-hidden className="mt-0.5 size-5 shrink-0" />
          {t('summaryAttached')}
        </p>
      ) : (
        <div className="mt-4 max-w-md rounded-card border border-line bg-surface p-4 text-left">
          <p className="text-muted">{t('noSummary')}</p>
          <Button asChild className="mt-3">
            <Link href={`/p/intake/new?doctor=${a.doctor.id}`}>
              <Sparkles aria-hidden />
              {t('startAi')}
            </Link>
          </Button>
        </div>
      )}
      <div className="mt-6 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg">
          <Link href="/p/visits">{t('viewVisits')}</Link>
        </Button>
        <Button asChild size="lg" variant="secondary">
          <Link href="/p/home">{t('backHome')}</Link>
        </Button>
      </div>
    </div>
  );
}
