'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { MapPin, ShieldCheck, Sparkles, Stethoscope } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import Link from 'next/link';
import type { AppointmentView } from '@medicos/shared/client';
import { Badge, Button, Card, EmptyState, Skeleton } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { post } from '@/lib/api';
import { APPOINTMENTS_KEY, fmtDateTime, useAppointments } from '@/lib/use-booking';
import { usePatientGate } from '@/lib/use-me';

/** My visits: upcoming and past appointments, cancel while still booked. */
export default function VisitsPage() {
  const t = useTranslations('visits');
  const tb = useTranslations('booking');
  usePatientGate();
  const { data, isLoading } = useAppointments();
  const now = Date.now();
  const upcoming = (data ?? []).filter((a) => new Date(a.startsAt).getTime() >= now - 3600_000 && a.status !== 'cancelled' && a.status !== 'completed').reverse();
  const past = (data ?? []).filter((a) => !upcoming.includes(a));

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-muted">{t('subtitle')}</p>
        </div>
        <Button asChild variant="secondary">
          <Link href="/p/doctors">
            <Stethoscope aria-hidden />
            {tb('title')}
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <Skeleton className="mt-6 h-32" />
      ) : !data?.length ? (
        <Card className="mt-6 md:mt-8">
          <EmptyState
            art="calendar"
            title={t('emptyTitle')}
            body={t('emptyBody')}
            action={
              <Button asChild size="lg">
                <Link href="/p/intake/new">
                  <Sparkles aria-hidden />
                  {t('cta')}
                </Link>
              </Button>
            }
          />
        </Card>
      ) : (
        <>
          {upcoming.length ? <VisitList title={tb('upcoming')} items={upcoming} cancellable /> : null}
          {past.length ? <VisitList title={tb('past')} items={past} /> : null}
        </>
      )}
    </div>
  );
}

function VisitList({ title, items, cancellable }: { title: string; items: AppointmentView[]; cancellable?: boolean }) {
  const t = useTranslations('booking');
  const locale = useLocale();
  const qc = useQueryClient();
  const cancel = useMutation({
    mutationFn: (id: string) => post<AppointmentView>(`/appointments/${id}/cancel`),
    onSuccess: () => void qc.invalidateQueries({ queryKey: APPOINTMENTS_KEY }),
  });
  return (
    <section className="mt-8">
      <h2 className="font-display text-xl font-semibold">{title}</h2>
      <ul className="mt-3 flex flex-col gap-3">
        {items.map((a) => (
          <li key={a.id}>
            <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{fmtDateTime(a.startsAt, locale)}</p>
                  <Badge tone={a.status === 'cancelled' ? 'danger' : a.status === 'completed' ? 'neutral' : 'brand'}>{t(`status.${a.status}`)}</Badge>
                </div>
                <p className="mt-1">
                  {a.doctor.name} · <span className="text-muted">{t(`specialties.${a.doctor.specialty as 'general_medicine'}`)}</span>
                </p>
                <p className="flex items-center gap-1 text-sm text-muted">
                  <MapPin aria-hidden className="size-4" />
                  {a.clinic.name}, {a.clinic.city} · {t('forProfile')}: {a.profile.name}
                </p>
                {a.summaryAttached ? (
                  <p className="mt-1 flex items-center gap-1 text-sm font-medium text-brand-deep">
                    <ShieldCheck aria-hidden className="size-4" />
                    {t('summaryAttached')}
                  </p>
                ) : null}
              </div>
              {cancellable && (a.status === 'booked' || a.status === 'confirmed') ? (
                <Button
                  variant="ghost"
                  loading={cancel.isPending && cancel.variables === a.id}
                  onClick={() => {
                    if (window.confirm(t('cancelConfirm'))) cancel.mutate(a.id);
                  }}
                >
                  {t('cancel')}
                </Button>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </section>
  );
}
