'use client';
import { Copy, Printer, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Logo, QrCode, Skeleton } from '@medicos/ui';
import { PatientTopBar } from '@/components/patient-top-bar';
import { usePatientGate } from '@/lib/use-me';

/** The physical-card moment: the one bold element of the patient app. */
export default function MedicosIdPage() {
  const t = useTranslations('medicosId');
  const { me } = usePatientGate();
  const [copied, setCopied] = useState(false);

  if (!me) {
    return (
      <main className="px-5 pt-20" aria-busy>
        <Skeleton className="aspect-[3/4] w-full rounded-[24px]" />
      </main>
    );
  }
  const profile = me.profiles[0]!;
  const [left, right] = profile.medicosId.replace('MED-', '').split('-');

  return (
    <>
      <PatientTopBar back="/p/home" />
      <main className="flex flex-col px-5 pb-10">
        <h1 className="font-display text-[1.75rem] font-bold tracking-tight">{t('title')}</h1>

        <section
          aria-label={t('title')}
          className="mt-5 overflow-hidden rounded-[24px] border border-line bg-surface shadow-[0_1px_0_var(--line),0_12px_32px_-16px_rgb(6_64_47/0.35)] print:shadow-none"
        >
          <div className="flex items-center justify-between bg-brand-deep px-5 py-4 text-white">
            <Logo className="text-white [&_svg_path:last-child]:fill-[var(--brand-deep)]" />
            <span className="text-sm opacity-80">{t('show')}</span>
          </div>

          <div className="px-6 pb-6 pt-5">
            <p className="text-lg font-semibold">{profile.name}</p>
            <p
              className="mt-1 font-mono text-[2rem] font-bold leading-none tracking-[0.06em] text-brand-deep dark:text-brand"
              aria-label={profile.medicosId.split('').join(' ')}
            >
              <span className="text-muted">MED-</span>
              {left}
              <span className="text-muted">-</span>
              {right}
            </p>
            <QrCode value={profile.medicosId} label={t('qrLabel', { id: profile.medicosId })} className="mx-auto mt-6 max-w-[300px] border border-line" />
          </div>
        </section>

        <p className="mt-6 text-ink/85">{t('explain')}</p>
        <p className="mt-3 flex gap-2 text-sm text-muted">
          <Sun aria-hidden className="mt-0.5 size-4 shrink-0" />
          {t('brightness')}
        </p>

        <div className="no-print mt-6 grid grid-cols-2 gap-3">
          <Button
            variant="secondary"
            onClick={async () => {
              await navigator.clipboard?.writeText(profile.medicosId).catch(() => undefined);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            }}
          >
            <Copy aria-hidden className="size-5" />
            <span aria-live="polite">{copied ? t('copied') : t('copy')}</span>
          </Button>
          <Button variant="secondary" onClick={() => window.print()}>
            <Printer aria-hidden className="size-5" />
            {t('download')}
          </Button>
        </div>
      </main>
    </>
  );
}
