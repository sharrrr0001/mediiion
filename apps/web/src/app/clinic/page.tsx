'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { CheckCircle2, Loader2, LogOut, Printer, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useEffect, useState, type FormEvent } from 'react';
import type { ClinicContext, ClinicQueueRow } from '@medicos/shared/client';
import { Badge, Button, Card, Field, Input, Logo, Select, Skeleton } from '@medicos/ui';
import { Standee } from '@/components/clinic/standee';
import { api, ApiError, post } from '@/lib/api';
import { fmtTime } from '@/lib/use-booking';

/** Receptionist desk: today's visits (metadata only), walk-in check-in, waiting-room QR (spec §7.4). */
export default function ClinicDeskPage() {
  const t = useTranslations('clinicDesk');
  const tc = useTranslations('common');
  const router = useRouter();
  const ctx = useQuery({ queryKey: ['clinic-context'], queryFn: () => api<ClinicContext>('/clinic/context'), retry: false });
  const queue = useQuery({ queryKey: ['clinic-queue'], queryFn: () => api<ClinicQueueRow[]>('/clinic/queue'), enabled: !!ctx.data, refetchInterval: 15_000 });
  const [doctorId, setDoctorId] = useState('');
  const [medicosId, setMedicosId] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [showStandee, setShowStandee] = useState(false);

  const unauth = ctx.error instanceof ApiError && (ctx.error.status === 401 || ctx.error.status === 403);
  useEffect(() => {
    if (unauth) router.replace('/d/login?next=/clinic');
  }, [unauth, router]);
  useEffect(() => {
    if (!doctorId && ctx.data?.doctors[0]) setDoctorId(ctx.data.doctors[0].id);
  }, [ctx.data, doctorId]);

  const send = useMutation({ mutationFn: () => post<{ requestId: string }>('/clinic/walk-ins', { medicosId, doctorId }), onSuccess: (r) => setRequestId(r.requestId) });
  const status = useQuery({
    queryKey: ['walk-in', requestId],
    queryFn: () => api<{ status: string }>(`/clinic/walk-ins/${requestId}`),
    enabled: !!requestId,
    refetchInterval: (q) => (!q.state.data || q.state.data.status === 'pending' ? 2000 : false),
  });
  useEffect(() => {
    if (status.data?.status === 'allowed') void queue.refetch();
  }, [status.data?.status, queue]);

  if (!ctx.data) return <Skeleton className="h-96" />;
  const doctor = ctx.data.doctors.find((d) => d.id === doctorId);
  const st = status.data?.status;

  return (
    <div className="animate-in flex flex-col gap-6">
      <div className="no-print flex flex-wrap items-center gap-3">
        <Logo />
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {t('title')} · {ctx.data.clinic.name}
          </h1>
          <p className="text-sm text-muted">{t('subtitle')}</p>
        </div>
        <Button
          variant="ghost"
          onClick={async () => {
            await post('/auth/logout').catch(() => undefined);
            router.replace('/d/login');
          }}
        >
          <LogOut aria-hidden />
          {tc('logout')}
        </Button>
      </div>

      <div className="no-print grid gap-6 lg:grid-cols-[1fr_380px]">
        <Card className="p-5">
          <h2 className="font-display text-xl font-semibold">{t('queue')}</h2>
          {queue.isLoading ? (
            <Skeleton className="mt-3 h-32" />
          ) : !queue.data?.length ? (
            <p className="mt-3 text-muted">{t('empty')}</p>
          ) : (
            <ul className="mt-3 divide-y divide-line rounded-card border border-line">
              {queue.data.map((r) => (
                <li key={r.appointmentId} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <time className="w-20 font-semibold" dateTime={r.time}>
                    {fmtTime(r.time, 'en')}
                  </time>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium">{r.label}</span> <span className="font-mono text-sm text-muted">{r.medicosId}</span>
                    <span className="block text-sm text-muted">{r.doctor}</span>
                  </span>
                  <Badge tone={r.type === 'walk_in' ? 'walkin' : 'neutral'}>{t(`types.${r.type}`)}</Badge>
                  <Badge tone={r.summaryReady ? 'brand' : 'idle'} dot>
                    {r.summaryReady ? t('summaryReady') : t('noSummary')}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card className="h-fit p-5">
          <h2 className="font-display text-xl font-semibold">{t('walkIn')}</h2>
          {!requestId ? (
            <form
              className="mt-3 flex flex-col gap-3"
              onSubmit={(e: FormEvent) => {
                e.preventDefault();
                send.mutate();
              }}
            >
              <p className="text-sm text-muted">{t('walkInBody')}</p>
              <Field label={t('doctor')} htmlFor="w-doc">
                <Select id="w-doc" value={doctorId} onChange={(e) => setDoctorId(e.target.value)}>
                  {ctx.data.doctors.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('id')} htmlFor="w-id" error={send.error instanceof ApiError ? send.error.message : undefined}>
                <Input id="w-id" required className="font-mono uppercase" placeholder="MED-XXXX-XXXX" value={medicosId} onChange={(e) => setMedicosId(e.target.value)} />
              </Field>
              <Button type="submit" loading={send.isPending} disabled={!doctorId}>
                {t('send')}
              </Button>
            </form>
          ) : (
            <div role="status" aria-live="polite" className="mt-4 flex flex-col items-center gap-3 text-center">
              {!st || st === 'pending' ? (
                <>
                  <Loader2 aria-hidden className="size-8 animate-spin text-brand" />
                  <p className="font-medium">{t('waiting')}</p>
                </>
              ) : st === 'allowed' ? (
                <>
                  <CheckCircle2 aria-hidden className="size-8 text-brand" />
                  <p className="font-medium">{t('allowed')}</p>
                </>
              ) : (
                <>
                  <XCircle aria-hidden className="size-8 text-danger" />
                  <p className="font-medium">{st === 'denied' ? t('denied') : t('expired')}</p>
                </>
              )}
              {st && st !== 'pending' ? (
                <Button variant="secondary" onClick={() => (setRequestId(null), setMedicosId(''), send.reset())}>
                  {t('again')}
                </Button>
              ) : null}
            </div>
          )}
          <Button variant="subtle" className="mt-6 w-full" onClick={() => setShowStandee((v) => !v)}>
            <Printer aria-hidden />
            {t('standee')}
          </Button>
        </Card>
      </div>

      {showStandee && doctor ? (
        <div className="flex flex-col items-center gap-3">
          <Button className="no-print" variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden />
            {t('print')}
          </Button>
          <Standee doctorId={doctor.id} doctorName={doctor.name} clinicName={ctx.data.clinic.name} />
        </div>
      ) : null}
    </div>
  );
}
