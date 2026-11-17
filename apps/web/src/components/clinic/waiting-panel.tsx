'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { DoorOpen, Hourglass, Send } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { WAITING_REPLY_MAX, type ClinicWaitingRow } from '@medicos/shared/client';
import { Badge, Button, Card, Input, Select, cn } from '@medicos/ui';
import { api, post } from '@/lib/api';
import { fmtTime } from '@/lib/use-booking';

const KEY = ['clinic-waiting'] as const;
type Reply = { response: 'come_in' | 'busy' | 'wait' | 'custom'; waitMinutes?: number; text?: string };

/**
 * Waiting-room board for the staff desk and the doctor's Today page. Polls every 5 s; unanswered
 * signals first; the browser tab title shows how many are waiting. Patient label + Mediaura ID only.
 */
export function WaitingPanel() {
  const t = useTranslations('clinicDesk');
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: KEY, queryFn: () => api<ClinicWaitingRow[]>('/clinic/waiting'), refetchInterval: 5000 });
  const reply = useMutation({
    mutationFn: (v: { pingId: string } & Reply) => {
      const { pingId, ...body } = v;
      return post<ClinicWaitingRow[]>(`/clinic/waiting/${pingId}/reply`, body);
    },
    onSuccess: (rows) => qc.setQueryData(KEY, rows),
  });
  const open = (data ?? []).filter((r) => !r.reply).length;

  // "(2) Waiting room" in the tab title so the desk notices even on another tab.
  useEffect(() => {
    const base = document.title.replace(/^\(\d+\)\s/, '');
    document.title = open ? `(${open}) ${base}` : base;
    return () => {
      document.title = document.title.replace(/^\(\d+\)\s/, '');
    };
  }, [open]);

  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center gap-2">
        <DoorOpen aria-hidden className="size-5 text-brand" />
        <h2 className="font-display text-xl font-semibold">{t('waitingTitle')}</h2>
        {open ? (
          <Badge tone="accent" dot>
            {open}
          </Badge>
        ) : null}
      </div>
      <p className="mt-1 text-sm text-muted">{t('waitingBody')}</p>
      {!data?.length ? (
        <p className="mt-4 text-muted">{t('waitingEmpty')}</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-3" aria-live="polite">
          {data.map((r) => (
            <Row key={r.pingId} row={r} onReply={(body) => reply.mutate({ pingId: r.pingId, ...body })} pending={reply.isPending && reply.variables?.pingId === r.pingId} />
          ))}
        </ul>
      )}
      {reply.error ? <p role="alert" className="mt-2 text-sm font-medium text-danger">{reply.error.message}</p> : null}
    </Card>
  );
}

function Row({ row, onReply, pending }: { row: ClinicWaitingRow; onReply: (r: Reply) => void; pending: boolean }) {
  const t = useTranslations('clinicDesk');
  const [minutes, setMinutes] = useState('10');
  const [text, setText] = useState('');
  const mins = Math.floor((Date.now() - new Date(row.at).getTime()) / 60000);
  const replied = row.reply
    ? row.reply.response === 'wait'
      ? t('replyKinds.wait', { n: row.reply.waitMinutes ?? 0 })
      : row.reply.response === 'custom'
        ? t('replyKinds.custom', { text: row.reply.text ?? '' })
        : t(`replyKinds.${row.reply.response}`)
    : null;
  return (
    <li className={cn('rounded-card border p-4', row.reply ? 'border-line' : 'border-accent/50 bg-accent-soft/40')}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={row.kind === 'may_i_come_in' ? 'accent' : 'brand'}>{t(`kinds.${row.kind}`)}</Badge>
        <span className="font-semibold">{row.patientLabel}</span>
        <span className="font-mono text-sm text-muted">{row.medicosId}</span>
        <span className="text-sm text-muted">
          · {row.doctor.name} · {t('slot', { time: fmtTime(row.appointmentTime, 'en') })}
        </span>
        <span className="ml-auto text-sm text-muted">
          {mins < 1 ? t('justNow') : t('since', { n: mins })}
          {row.signalsToday > 1 ? ` · ${t('signals', { n: row.signalsToday })}` : ''}
        </span>
      </div>
      {replied ? <p className="mt-2 text-sm font-medium text-brand-deep">{t('replied', { what: replied })}</p> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" loading={pending} onClick={() => onReply({ response: 'come_in' })}>
          <DoorOpen aria-hidden />
          {t('comeIn')}
        </Button>
        <Button size="sm" variant="secondary" onClick={() => onReply({ response: 'busy' })}>
          {t('busy')}
        </Button>
        <span className="inline-flex items-center gap-1">
          <Select aria-label={t('wait')} className="min-h-9 w-24 py-1 text-sm" value={minutes} onChange={(e) => setMinutes(e.target.value)}>
            {[5, 10, 15, 20, 30].map((n) => (
              <option key={n} value={n}>
                {t('minutes', { n })}
              </option>
            ))}
          </Select>
          <Button size="sm" variant="secondary" onClick={() => onReply({ response: 'wait', waitMinutes: Number(minutes) })}>
            <Hourglass aria-hidden />
            {t('wait')}
          </Button>
        </span>
        <form
          className="flex min-w-[220px] flex-1 items-center gap-1"
          onSubmit={(e) => {
            e.preventDefault();
            if (text.trim()) onReply({ response: 'custom', text: text.trim() });
            setText('');
          }}
        >
          <Input aria-label={t('custom')} placeholder={t('customPlaceholder')} maxLength={WAITING_REPLY_MAX} className="min-h-9 py-1 text-sm" value={text} onChange={(e) => setText(e.target.value)} />
          <Button type="submit" size="sm" variant="ghost" aria-label={t('send')} disabled={!text.trim()}>
            <Send aria-hidden />
          </Button>
        </form>
      </div>
    </li>
  );
}
