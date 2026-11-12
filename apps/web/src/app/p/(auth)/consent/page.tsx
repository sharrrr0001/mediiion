'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CONSENT_VERSION } from '@medicos/shared/client';
import { Button, Logo, Skeleton } from '@medicos/ui';
import { LanguagePicker } from '@/components/language-picker';
import { post } from '@/lib/api';
import { ME_KEY, usePatientGate } from '@/lib/use-me';

const SECTIONS = ['collect', 'why', 'who', 'keep', 'delete'] as const;

export default function ConsentPage() {
  const t = useTranslations('consent');
  const tc = useTranslations('common');
  const { me } = usePatientGate();
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [showError, setShowError] = useState(false);

  const grant = useMutation({
    mutationFn: () => post('/consents', { type: 'data_processing', version: CONSENT_VERSION, agreed: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  });

  if (!me) return <PageSkeleton />;

  return (
    <main className="flex min-h-dvh flex-col px-5 pb-6 pt-4">
      <div className="flex items-center justify-between">
        <Logo />
        <LanguagePicker />
      </div>

      <h1 className="mt-10 font-display text-[2rem] font-bold leading-tight tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted">{t('intro')}</p>

      <dl className="mt-6 flex flex-col divide-y divide-line border-y border-line">
        {SECTIONS.map((key) => (
          <div key={key} className="py-4">
            <dt className="font-display text-lg font-semibold">{t(`${key}Title`)}</dt>
            <dd className="mt-1 text-ink/85">{t(`${key}Body`)}</dd>
          </div>
        ))}
      </dl>

      <div className="sticky bottom-0 -mx-5 mt-6 flex flex-col gap-4 bg-bg/95 px-5 pb-2 pt-4 backdrop-blur">
        <label className="flex min-h-12 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setShowError(false);
            }}
            className="mt-0.5 size-6 shrink-0 accent-[var(--brand)]"
            aria-describedby={showError ? 'consent-error' : undefined}
          />
          <span className="font-medium">{t('agree')}</span>
        </label>
        {showError ? (
          <p id="consent-error" role="alert" className="font-medium text-danger">
            {t('mustAgree')}
          </p>
        ) : null}
        {grant.isError ? (
          <p role="alert" className="font-medium text-danger">
            {tc('errorGeneric')}
          </p>
        ) : null}
        <Button
          size="lg"
          block
          loading={grant.isPending}
          onClick={() => (agreed ? grant.mutate() : setShowError(true))}
        >
          {t('agreeButton')}
        </Button>
      </div>
    </main>
  );
}

function PageSkeleton() {
  return (
    <main className="flex flex-col gap-4 px-5 pt-20" aria-busy>
      <Skeleton className="h-9 w-2/3" />
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-40 w-full" />
    </main>
  );
}
