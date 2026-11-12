'use client';
import { Copy, MessageCircle, Printer, Sun } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { Button, Card, QrCode, Skeleton, Toast } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { usePatientGate } from '@/lib/use-me';

export default function MedicosIdPage() {
  const t = useTranslations('medicosId');
  const tx = useTranslations('extra');
  const { me } = usePatientGate();
  const [toast, setToast] = useState<string | null>(null);

  if (!me) {
    return (
      <div className={`${container} grid gap-8 py-10 lg:grid-cols-2`} aria-busy>
        <Skeleton className="aspect-[4/5] w-full max-w-md rounded-[20px]" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }
  const profile = me.profiles[0]!;
  const [left, right] = profile.medicosId.replace('MED-', '').split('-');
  const steps = tx.raw('howClinic') as string[];
  const shareText = encodeURIComponent(`My Medicos ID: ${profile.medicosId}`);

  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <div className="mt-6 grid items-start gap-8 lg:grid-cols-[minmax(0,440px)_1fr] lg:gap-12">
        <section aria-label={t('title')} className="mx-auto w-full max-w-md lg:mx-0">
          <Card className="overflow-hidden p-0 shadow-md md:p-0 print:shadow-none">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-brand-tint px-6 py-4">
              <p className="font-semibold text-brand-deep">{t('show')}</p>
              <span className="rounded-full bg-surface px-2.5 py-1 text-xs font-semibold text-brand-deep shadow-sm">Medicos</span>
            </div>
            <div className="flex flex-col items-center px-6 pb-6 pt-6 text-center">
              <QrCode value={profile.medicosId} label={t('qrLabel', { id: profile.medicosId })} className="max-w-[280px] rounded-card border-2 border-brand/40 p-3" />
              <p className="mt-5 text-lg font-semibold">{profile.name}</p>
              <div className="mt-2 flex items-center gap-2">
                <p className="font-mono text-2xl font-bold tracking-[0.06em] text-brand-deep md:text-[1.75rem]" aria-label={profile.medicosId.split('').join(' ')}>
                  <span className="text-muted">MED-</span>
                  {left}
                  <span className="text-muted">-</span>
                  {right}
                </p>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('copy')}
                  onClick={async () => {
                    await navigator.clipboard?.writeText(profile.medicosId).catch(() => undefined);
                    setToast(t('copied'));
                  }}
                >
                  <Copy aria-hidden />
                </Button>
              </div>
            </div>
          </Card>
          <div className="no-print mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 [&_a]:whitespace-nowrap [&_button]:whitespace-nowrap">
            <Button variant="secondary" size="lg" onClick={() => window.print()}>
              <Printer aria-hidden />
              {t('download')}
            </Button>
            <Button asChild variant="secondary" size="lg">
              <a href={`https://wa.me/?text=${shareText}`} target="_blank" rel="noreferrer">
                <MessageCircle aria-hidden />
                {tx('share')}
              </a>
            </Button>
          </div>
        </section>

        <section className="no-print">
          <h2 className="font-display text-2xl font-semibold">{tx('howClinicTitle')}</h2>
          <ol className="mt-5 flex flex-col gap-4">
            {steps.map((s, i) => (
              <li key={s} className="flex gap-4">
                <span aria-hidden className="grid size-9 shrink-0 place-items-center rounded-full bg-brand font-display font-bold text-brand-ink">
                  {i + 1}
                </span>
                <p className="pt-1.5 text-ink">{s}</p>
              </li>
            ))}
          </ol>
          <p className="mt-8 flex items-start gap-2 rounded-card bg-surface-2 p-4 text-sm text-muted">
            <Sun aria-hidden className="mt-0.5 size-4 shrink-0 text-accent-ink" />
            {t('brightness')}
          </p>
        </section>
      </div>
      <Toast message={toast} onDone={() => setToast(null)} />
    </div>
  );
}
