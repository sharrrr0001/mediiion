'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { BellRing, CheckCircle2, Clock, DoorOpen, Hourglass, MessageSquareText } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { PatientWaitingView, WaitingReplyView } from '@medicos/shared/client';
import { Button, Card, cn } from '@medicos/ui';
import { api, ApiError, post } from '@/lib/api';
import { fmtTime } from '@/lib/use-booking';

const KEY = ['waiting-today'] as const;

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [active]);
  return now;
}

/**
 * Waiting room (patient side): "I have arrived" → "May I come in?". The server allows one signal per
 * visit every 150 s; the button shows the countdown. Replies from the doctor/reception appear here.
 * Renders nothing when the patient has no visit today.
 */
export function WaitingRoomCard() {
  const t = useTranslations('waiting');
  const locale = useLocale();
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => api<PatientWaitingView[]>('/waiting/today'),
    // Poll faster while waiting for an answer.
    refetchInterval: (q) => ((q.state.data ?? []).some((v) => v.lastPing && !v.reply) ? 5000 : 20000),
  });
  const ping = useMutation({
    mutationFn: (v: { id: string; kind: 'arrived' | 'may_i_come_in' }) => post<PatientWaitingView>(`/waiting/${v.id}/ping`, { kind: v.kind }),
    onSettled: () => void qc.invalidateQueries({ queryKey: KEY }),
  });
  const counting = (data ?? []).some((v) => v.nextAllowedAt);
  const now = useNow(counting);

  // A gentle buzz when the doctor says "come in".
  const comeIn = (data ?? []).find((v) => v.reply?.response === 'come_in')?.reply?.at;
  useEffect(() => {
    if (comeIn && 'vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
  }, [comeIn]);

  if (!data?.length) return null;
  return (
    <section aria-labelledby="waiting-title" className="mt-6 flex flex-col gap-3">
      <h2 id="waiting-title" className="flex items-center gap-2 font-display text-xl font-semibold">
        <DoorOpen aria-hidden className="size-5 text-brand" />
        {t('title')}
      </h2>
      {data.map((v) => {
        const left = v.nextAllowedAt ? Math.max(0, Math.ceil((new Date(v.nextAllowedAt).getTime() - now) / 1000)) : 0;
        const kind = v.arrived ? 'may_i_come_in' : 'arrived';
        const err = ping.error instanceof ApiError && ping.variables?.id === v.appointmentId ? ping.error : null;
        return (
          <Card key={v.appointmentId} className="flex flex-col gap-3 border-brand/30 p-5">
            <div>
              <p className="font-semibold">{t('visit', { time: fmtTime(v.startsAt, locale), doctor: v.doctor, clinic: v.clinic })}</p>
              <p className="text-sm text-muted">{t('forWhom', { name: v.profileName })}</p>
            </div>
            {v.reply ? <ReplyBanner reply={v.reply} /> : v.arrived ? (
              <p className="flex items-center gap-2 text-sm font-medium text-brand-deep">
                <CheckCircle2 aria-hidden className="size-4" />
                {v.lastPing?.kind === 'may_i_come_in' ? t('sent') : t('arrivedDone')}
              </p>
            ) : null}
            <Button
              size="lg"
              block="phone"
              disabled={left > 0}
              loading={ping.isPending && ping.variables?.id === v.appointmentId}
              onClick={() => ping.mutate({ id: v.appointmentId, kind })}
            >
              {kind === 'arrived' ? <BellRing aria-hidden /> : <DoorOpen aria-hidden />}
              {kind === 'arrived' ? t('arrived') : t('mayI')}
            </Button>
            {left > 0 ? (
              <p className="flex items-center gap-1 text-sm text-muted" aria-live="off">
                <Clock aria-hidden className="size-4" />
                {t('again', { time: `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}` })}
              </p>
            ) : null}
            {err && err.code !== 'WAITING_TOO_SOON' ? <p role="alert" className="text-sm font-medium text-danger">{err.message}</p> : null}
          </Card>
        );
      })}
    </section>
  );
}

function ReplyBanner({ reply }: { reply: WaitingReplyView }) {
  const t = useTranslations('waiting');
  const text =
    reply.response === 'wait' ? t('reply.wait', { n: reply.waitMinutes ?? 0 }) : reply.response === 'custom' ? t('reply.custom', { text: reply.text ?? '' }) : t(`reply.${reply.response}`);
  const Icon = reply.response === 'come_in' ? DoorOpen : reply.response === 'custom' ? MessageSquareText : Hourglass;
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'flex items-start gap-3 rounded-card px-4 py-3',
        reply.response === 'come_in' ? 'bg-brand text-brand-ink' : 'border border-accent/40 bg-accent-soft text-ink',
      )}
    >
      <Icon aria-hidden className="mt-0.5 size-6 shrink-0" />
      <div>
        <p className={cn('font-semibold', reply.response === 'come_in' && 'text-lg')}>{text}</p>
        <p className={cn('text-sm', reply.response === 'come_in' ? 'opacity-90' : 'text-muted')}>{t(`from.${reply.by}`)}</p>
      </div>
    </div>
  );
}
