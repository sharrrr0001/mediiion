'use client';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { Logo, QrCode } from '@medicos/ui';

/** Waiting-room QR standee (spec §7.4): opens the AI pre-visit with this doctor pre-selected. Prints on A4/A5. */
export function Standee({ doctorId, doctorName, clinicName }: { doctorId: string; doctorName: string; clinicName: string }) {
  const t = useTranslations('clinicDesk');
  const [url, setUrl] = useState('');
  useEffect(() => setUrl(`${window.location.origin}/p/intake/new?doctor=${doctorId}`), [doctorId]);
  return (
    <div className="print-page mx-auto flex max-w-md flex-col items-center gap-4 rounded-card border-2 border-brand bg-surface p-8 text-center">
      <Logo />
      <p className="font-display text-2xl font-bold leading-tight text-brand-deep">{t('standeeTitle')}</p>
      {url ? <QrCode value={url} label={t('standeeTitle')} className="w-64 max-w-full" /> : null}
      <p className="text-ink">{t('standeeBody')}</p>
      <p className="font-semibold">
        {doctorName} · {clinicName}
      </p>
    </div>
  );
}
