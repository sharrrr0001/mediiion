'use client';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Mic, Shirt, Stethoscope } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import type { IntakeView } from '@medicos/shared/client';
import { Button, Skeleton, cn } from '@medicos/ui';
import { PatientTopBar } from '@/components/patient-top-bar';
import { api, ApiError, post } from '@/lib/api';
import { usePatientGate } from '@/lib/use-me';

type Kind = 'general-medicine' | 'dermatology';

export default function NewIntakePage() {
  const t = useTranslations('intake');
  const tc = useTranslations('common');
  const router = useRouter();
  const { me } = usePatientGate();
  const [kind, setKind] = useState<Kind>('general-medicine');
  const open = useQuery({
    queryKey: ['intake-open'],
    queryFn: () => api<Array<{ id: string; status: string }>>('/intake/sessions'),
    enabled: !!me,
  });
  const start = useMutation({
    mutationFn: () => post<IntakeView>('/intake/sessions', { profileId: me!.profiles[0]!.id, templateKey: kind }),
    onSuccess: (v) => router.push(`/p/intake/${v.id}`),
  });

  if (!me) {
    return (
      <main className="flex flex-col gap-4 px-5 pt-20" aria-busy>
        <Skeleton className="h-9 w-3/4" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </main>
    );
  }

  const resume = open.data?.[0];
  return (
    <>
      <PatientTopBar back="/p/home" />
      <main className="flex flex-col px-5 pb-10">
        <h1 className="font-display text-[1.9rem] font-bold leading-tight tracking-tight">{t('chooseTitle')}</h1>
        <p className="mt-2 text-muted">{t('chooseSubtitle')}</p>

        {resume ? (
          <Button asChild variant="secondary" size="lg" block className="mt-6">
            <Link href={`/p/intake/${resume.id}`}>{t('resume')}</Link>
          </Button>
        ) : null}

        <fieldset className="mt-8 flex flex-col gap-3">
          <legend className="sr-only">{t('chooseTitle')}</legend>
          <Choice
            checked={kind === 'general-medicine'}
            onSelect={() => setKind('general-medicine')}
            icon={<Stethoscope aria-hidden />}
            title={t('kindGeneral')}
            hint={t('kindGeneralHint')}
          />
          <Choice
            checked={kind === 'dermatology'}
            onSelect={() => setKind('dermatology')}
            icon={<Shirt aria-hidden />}
            title={t('kindSkin')}
            hint={t('kindSkinHint')}
          />
        </fieldset>

        <p className="mt-6 flex items-center gap-2 text-sm text-muted">
          <Mic aria-hidden className="size-4" />
          {t('voiceSoon')}
        </p>

        {start.isError ? (
          <p role="alert" className="mt-4 font-medium text-danger">
            {start.error instanceof ApiError ? start.error.message : tc('errorGeneric')}
          </p>
        ) : null}
        <Button size="lg" block className="mt-6" loading={start.isPending} onClick={() => start.mutate()}>
          {t('start')}
        </Button>
      </main>
    </>
  );
}

function Choice(props: { checked: boolean; onSelect: () => void; icon: ReactNode; title: string; hint: string }) {
  return (
    <label
      className={cn(
        'flex min-h-[76px] cursor-pointer items-center gap-4 rounded-2xl border-2 border-line bg-surface p-4',
        props.checked && 'border-brand bg-brand-soft',
      )}
    >
      <input type="radio" name="kind" checked={props.checked} onChange={props.onSelect} className="sr-only" />
      <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-surface text-brand [&_svg]:size-6">{props.icon}</span>
      <span className="flex flex-col">
        <span className="font-semibold">{props.title}</span>
        <span className="text-[0.9375rem] text-muted">{props.hint}</span>
      </span>
    </label>
  );
}
