import {
  ArrowRight,
  Check,
  CheckCircle2,
  Lock,
  MapPin,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserRound,
} from 'lucide-react';
import type { Metadata } from 'next';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { AI_DRAFT_LABEL } from '@medicos/shared/client';
import { Badge, Button, Card, cn } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { IntlProvider } from '@/components/intl-provider';
import { PublicShell } from '@/components/shell/public-shell';

export const metadata: Metadata = { title: { absolute: 'Medicos — Pre-visit intake for Indian clinics' } };

export default function LandingPage() {
  const t = useTranslations('landing');
  const tn = useTranslations('nav');
  const how = t.raw('how') as Array<{ t: string; d: string }>;
  const trust = t.raw('trust') as string[];
  const trustIcons = [Sparkles, MapPin, Lock, CheckCircle2];

  return (
    <IntlProvider namespaces={['common', 'nav', 'footer']}>
      <PublicShell>
        {/* Hero */}
        <section className="relative overflow-hidden bg-brand-tint">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-40 -top-40 size-[640px] rounded-full bg-[radial-gradient(circle,rgba(14,122,85,0.16),transparent_62%)]"
          />
          <div
            className={`${container} relative grid items-center gap-12 py-14 md:py-20 lg:grid-cols-[1.1fr_1fr] lg:py-24`}
          >
            <div>
              <p className="inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-sm font-medium text-brand-deep shadow-sm">
                <Stethoscope aria-hidden className="size-4 stroke-[1.75]" />
                {t('eyebrow')}
              </p>
              <h1 className="text-hero mt-6 max-w-[16ch] font-display font-bold leading-[1.05] tracking-tight text-ink">
                {t('title')}
              </h1>
              <p className="mt-5 max-w-[52ch] text-lg text-muted">{t('subtitle')}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button asChild size="lg">
                  <Link href="/p/login">
                    {t('ctaPatient')}
                    <ArrowRight aria-hidden />
                  </Link>
                </Button>
                <Button asChild size="lg" variant="secondary">
                  <a href="#doctors">{t('ctaDoctor')}</a>
                </Button>
              </div>
            </div>
            <SummaryMock />
          </div>
        </section>

        {/* How it works */}
        <section id="how" className={`${container} scroll-mt-20 py-16 md:py-24`}>
          <SectionTitle title={t('howTitle')} subtitle={t('howSubtitle')} />
          <ol className="mt-10 grid gap-5 md:grid-cols-3">
            {how.map((step, i) => (
              <li key={step.t}>
                <Card className="h-full">
                  <span
                    aria-hidden
                    className="grid size-10 place-items-center rounded-full bg-brand font-display text-lg font-bold text-brand-ink"
                  >
                    {i + 1}
                  </span>
                  <h3 className="mt-5 font-display text-xl font-semibold">{step.t}</h3>
                  <p className="mt-2 text-muted">{step.d}</p>
                </Card>
              </li>
            ))}
          </ol>
        </section>

        {/* For patients / for doctors */}
        <section id="doctors" className="scroll-mt-20 bg-surface-2">
          <div className={`${container} grid gap-6 py-16 md:grid-cols-2 md:py-24`}>
            <BenefitList
              icon={<UserRound aria-hidden />}
              title={t('patientsTitle')}
              items={t.raw('patients') as string[]}
            />
            <BenefitList
              icon={<Stethoscope aria-hidden />}
              title={t('doctorsTitle')}
              items={t.raw('doctors') as string[]}
            />
          </div>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button asChild size="lg">
              <Link href="/d/signup">{tn('doctorSignup')}</Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/d/login">{tn('doctorLogin')}</Link>
            </Button>
          </div>
        </section>

        {/* Trust band */}
        <section id="trust" aria-label="Trust" className="scroll-mt-20 border-y border-line bg-surface">
          <ul className={`${container} grid grid-cols-2 gap-6 py-8 md:grid-cols-4`}>
            {trust.map((item, i) => {
              const Icon = trustIcons[i] ?? ShieldCheck;
              return (
                <li key={item} className="flex items-center gap-3 font-semibold text-ink">
                  <span className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-soft text-brand">
                    <Icon aria-hidden className="size-5 stroke-[1.75]" />
                  </span>
                  {item}
                </li>
              );
            })}
          </ul>
        </section>

        {/* Pricing teaser */}
        <section className={`${container} py-16 md:py-24`}>
          <SectionTitle title={t('pricingTitle')} subtitle={t('pricingNote')} />
          <div className="mt-10 grid gap-5 md:grid-cols-3">
            {(['free', 'pro', 'clinic'] as const).map((key) => (
              <Card
                key={key}
                className={cn('flex flex-col', key === 'pro' && 'border-brand shadow-md ring-1 ring-brand')}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-display text-xl font-semibold">{t(`plans.${key}.name`)}</h3>
                  {key === 'pro' ? <Badge tone="brand">{t('popular')}</Badge> : null}
                </div>
                <p className="mt-4">
                  <span className="tabular font-display text-4xl font-bold">{t(`plans.${key}.price`)}</span>
                  <span className="text-muted">{t('perMonth')}</span>
                </p>
                <p className="mt-3 flex items-start gap-2 text-muted">
                  <Check aria-hidden className="mt-1 size-4 shrink-0 text-brand" />
                  {t(`plans.${key}.desc`)}
                </p>
              </Card>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className={`${container} pb-16 md:pb-24`}>
          <div className="relative overflow-hidden rounded-[20px] border border-line bg-gradient-to-br from-surface to-brand-tint p-8 shadow-sm md:p-12">
            <div className="max-w-2xl">
              <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">
                {t('ctaBandTitle')}
              </h2>
              <p className="mt-3 text-lg text-muted">{t('ctaBandBody')}</p>
            </div>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button asChild size="lg">
                <Link href="/p/login">{t('ctaPatient')}</Link>
              </Button>
              <Button asChild size="lg" variant="secondary">
                <a href="#doctors">{t('ctaDoctor')}</a>
              </Button>
            </div>
          </div>
        </section>
      </PublicShell>
    </IntlProvider>
  );
}

function SectionTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="max-w-2xl">
      <h2 className="font-display text-3xl font-semibold tracking-tight md:text-4xl">{title}</h2>
      <p className="mt-3 text-lg text-muted">{subtitle}</p>
    </div>
  );
}

function BenefitList({ icon, title, items }: { icon: ReactNode; title: string; items: string[] }) {
  return (
    <Card className="p-6 md:p-8">
      <span className="grid size-12 place-items-center rounded-xl bg-brand-soft text-brand [&_svg]:size-6 [&_svg]:stroke-[1.75]">
        {icon}
      </span>
      <h2 className="mt-5 font-display text-2xl font-semibold">{title}</h2>
      <ul className="mt-5 flex flex-col gap-3">
        {items.map((it) => (
          <li key={it} className="flex items-start gap-3 text-ink">
            <CheckCircle2 aria-hidden className="mt-0.5 size-5 shrink-0 stroke-[1.75] text-brand" />
            {it}
          </li>
        ))}
      </ul>
    </Card>
  );
}

/** Illustrative card only (fictional patient). S filled, A/P left for the doctor — as in the product. */
function SummaryMock() {
  const t = useTranslations('landing');
  const lines = t.raw('mockLines') as string[];
  return (
    <div aria-hidden className="relative mx-auto w-full max-w-md lg:max-w-none">
      <Card className="relative p-6 shadow-lg md:p-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="font-display text-lg font-semibold">{t('mockTitle')}</p>
          <Badge tone="accent">{t('mockLabel')}</Badge>
        </div>
        <p className="mt-1 font-mono text-sm text-muted">{t('mockPatient')}</p>
        <ul className="mt-5 flex flex-col gap-3">
          {lines.map((l) => (
            <li key={l} className="flex items-start gap-3">
              <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-brand-soft">
                <Check className="size-3.5 text-brand" />
              </span>
              <span>{l}</span>
            </li>
          ))}
        </ul>
        <div className="mt-5 rounded-[var(--radius-control)] border border-dashed border-[#d9c79c] px-4 py-3 text-sm font-medium text-accent-ink">
          {t('mockFor')}
        </div>
        <p className="mt-4 text-xs text-muted">{AI_DRAFT_LABEL}</p>
      </Card>
    </div>
  );
}
