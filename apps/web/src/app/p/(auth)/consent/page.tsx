'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, Eye, FileText, ShieldCheck, Target } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { CONSENT_VERSION } from '@medicos/shared/client';
import { Button, Card, Skeleton } from '@medicos/ui';
import { post } from '@/lib/api';
import { ME_KEY, usePatientGate } from '@/lib/use-me';

const SECTIONS = [
  { key: 'collect', icon: FileText },
  { key: 'why', icon: Target },
  { key: 'who', icon: Eye },
  { key: 'keep', icon: Clock },
  { key: 'delete', icon: ShieldCheck },
] as const;

export default function ConsentPage() {
  const t = useTranslations('consent');
  const tc = useTranslations('common');
  const tx = useTranslations('extra');
  const { me } = usePatientGate();
  const qc = useQueryClient();
  const [agreed, setAgreed] = useState(false);
  const [showError, setShowError] = useState(false);

  const grant = useMutation({
    mutationFn: () => post('/consents', { type: 'data_processing', version: CONSENT_VERSION, agreed: true }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ME_KEY }),
  });

  if (!me) {
    return (
      <div className="flex flex-col gap-4" aria-busy>
        <Skeleton className="h-9 w-2/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="animate-in">
      <h1 className="font-display text-3xl font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-2 text-muted">{t('intro')}</p>

      <Card className="mt-6 p-0 md:p-0">
        <dl className="divide-y divide-line">
          {SECTIONS.map(({ key, icon: Icon }) => (
            <div key={key} className="p-5">
              <dt className="flex items-center gap-3 font-semibold text-ink">
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                  <Icon aria-hidden className="size-5 stroke-[1.75]" />
                </span>
                {t(`${key}Title`)}
              </dt>
              <dd className="mt-1 pl-[52px] text-[15px] leading-relaxed text-muted">{t(`${key}Body`)}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <div className="sticky bottom-0 -mx-4 mt-6 flex flex-col gap-4 border-t border-line bg-surface/95 px-4 pb-4 pt-4 backdrop-blur md:static md:mx-0 md:border-0 md:bg-transparent md:p-0">
        <label className="flex min-h-11 cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => {
              setAgreed(e.target.checked);
              setShowError(false);
            }}
            className="mt-0.5 size-5 shrink-0 accent-[var(--brand)]"
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
        <Button size="lg" block loading={grant.isPending} onClick={() => (agreed ? grant.mutate() : setShowError(true))}>
          {tx('agreeContinue')}
        </Button>
      </div>
    </div>
  );
}
