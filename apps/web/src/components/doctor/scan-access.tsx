'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, Loader2, QrCode, XCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { DoctorAccessRequestView } from '@medicos/shared/client';
import { Button, Dialog, Field, Input } from '@medicos/ui';
import { api, ApiError, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';

/** Minimal typing for the browser BarcodeDetector API (Chrome/Android); no extra library on the page. */
interface Detector {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
declare global {
  interface Window {
    BarcodeDetector?: new (opts: { formats: string[] }) => Detector;
  }
}

const ID_IN_TEXT = /MED-[0-9A-Z]{4}-[0-9A-Z]{4}/i;

/** Scan QR / type Medicos ID → patient taps Allow on their phone → records open (rule 10). */
export function ScanAccess({ className }: { className?: string }) {
  const t = useTranslations('doctorAccess');
  const [open, setOpen] = useState(false);
  const [medicosId, setMedicosId] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);

  const send = useMutation({
    mutationFn: (id: string) => post<DoctorAccessRequestView>('/doctor/access-requests', { medicosId: id }),
    onSuccess: (r) => setRequestId(r.id),
  });
  const status = useQuery({
    queryKey: ['access-request', requestId],
    queryFn: () => api<DoctorAccessRequestView>(`/doctor/access-requests/${requestId}`),
    enabled: !!requestId,
    refetchInterval: (q) => (q.state.data?.status === 'pending' || !q.state.data ? 2000 : false),
  });

  const reset = () => {
    setRequestId(null);
    setMedicosId('');
    send.reset();
  };
  const submit = (e?: FormEvent, value = medicosId) => {
    e?.preventDefault();
    if (value.trim()) send.mutate(value.trim());
  };
  const r = status.data;

  return (
    <>
      <Button variant="secondary" className={className} onClick={() => setOpen(true)}>
        <QrCode aria-hidden />
        {t('scan')}
      </Button>
      <Dialog open={open} onClose={() => (setOpen(false), reset())} title={t('title')}>
        {!requestId ? (
          <form onSubmit={submit} className="flex flex-col gap-4">
            <p className="text-sm text-muted">{t('body')}</p>
            <CameraScan
              onId={(id) => {
                setMedicosId(id);
                submit(undefined, id);
              }}
            />
            <Field label={t('idLabel')} htmlFor="scan-id" error={send.error instanceof ApiError ? send.error.message : undefined}>
              <Input id="scan-id" value={medicosId} placeholder={t('idPlaceholder')} autoComplete="off" className="font-mono uppercase" onChange={(e) => setMedicosId(e.target.value)} />
            </Field>
            <Button type="submit" size="lg" loading={send.isPending}>
              {t('send')}
            </Button>
          </form>
        ) : (
          <div role="status" aria-live="polite" className="flex flex-col items-center gap-3 py-2 text-center">
            {!r || r.status === 'pending' ? (
              <>
                <Loader2 aria-hidden className="size-8 animate-spin text-brand" />
                <p className="font-medium">{t('waiting')}</p>
                <p className="font-mono text-sm text-muted">{r?.medicosId ?? medicosId.toUpperCase()}</p>
              </>
            ) : r.status === 'allowed' && r.patient ? (
              <>
                <CheckCircle2 aria-hidden className="size-8 text-brand" />
                <p className="font-medium">{t('allowed', { time: fmtDateTime(r.grantExpiresAt!, 'en') })}</p>
                <p className="text-sm text-muted">
                  {r.patient.label} · <span className="font-mono">{r.medicosId}</span>
                </p>
                <Button asChild size="lg" onClick={() => setOpen(false)}>
                  <Link href={`/d/patients/${r.patient.profileId}`}>{t('open')}</Link>
                </Button>
              </>
            ) : (
              <>
                <XCircle aria-hidden className="size-8 text-danger" />
                <p className="font-medium">{r.status === 'denied' ? t('denied') : t('expired')}</p>
                <Button variant="secondary" onClick={reset}>
                  {t('again')}
                </Button>
              </>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}

function CameraScan({ onId }: { onId: (id: string) => void }) {
  const t = useTranslations('doctorAccess');
  const video = useRef<HTMLVideoElement>(null);
  const [on, setOn] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    if (!on) return;
    if (!window.BarcodeDetector || !navigator.mediaDevices) {
      setUnsupported(true);
      setOn(false);
      return;
    }
    const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setInterval> | undefined;
    let stopped = false;
    void navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then(async (s) => {
        if (stopped) return s.getTracks().forEach((tr) => tr.stop());
        stream = s;
        if (!video.current) return;
        video.current.srcObject = s;
        await video.current.play();
        timer = setInterval(() => {
          if (!video.current) return;
          void detector.detect(video.current).then((codes) => {
            const id = codes.map((c) => ID_IN_TEXT.exec(c.rawValue)?.[0]).find(Boolean);
            if (id) {
              setOn(false);
              onId(id.toUpperCase());
            }
          });
        }, 400);
      })
      .catch(() => (setUnsupported(true), setOn(false)));
    return () => {
      stopped = true;
      clearInterval(timer);
      stream?.getTracks().forEach((tr) => tr.stop());
    };
  }, [on, onId]);

  if (unsupported) return <p className="text-sm text-muted">{t('noCamera')}</p>;
  return on ? (
    <div className="flex flex-col gap-2">
      <video ref={video} muted playsInline className="aspect-square w-full rounded-card bg-ink object-cover" />
      <Button variant="ghost" onClick={() => setOn(false)}>
        {t('stopCamera')}
      </Button>
    </div>
  ) : (
    <Button variant="subtle" size="lg" onClick={() => setOn(true)}>
      <Camera aria-hidden />
      {t('camera')}
    </Button>
  );
}
