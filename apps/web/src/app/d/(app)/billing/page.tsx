'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, Check } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useState, type FormEvent } from 'react';
import type { BillingOverview } from '@medicos/shared/client';
import { Badge, Button, Card, Field, Input, Skeleton, Tabs, UsageBar, cn } from '@medicos/ui';
import { api, ApiError, post } from '@/lib/api';
import { fmtDateTime } from '@/lib/use-booking';
import { useDoctor } from '@/lib/use-doctor';

const KEY = ['doctor-billing'] as const;

/** Plan & billing (spec §7.2 step 6, §9): usage bar, soft-limit warnings, plans, pilot code, invoices. */
export default function BillingPage() {
  const t = useTranslations('billing');
  useDoctor();
  const qc = useQueryClient();
  const { data: b } = useQuery({ queryKey: KEY, queryFn: () => api<BillingOverview>('/doctor/billing') });
  const [code, setCode] = useState('');
  const [cycle, setCycle] = useState<'monthly' | 'yearly'>('monthly');
  const coupon = useMutation({ mutationFn: () => post<BillingOverview>('/doctor/billing/coupon', { code }), onSuccess: (d) => (qc.setQueryData(KEY, d), setCode('')) });
  const checkout = useMutation({
    mutationFn: (planKey: string) => post<{ url: string }>('/doctor/billing/checkout', { planKey, cycle }),
    onSuccess: (r) => window.location.assign(r.url),
  });
  if (!b) return <Skeleton className="h-96" />;

  return (
    <div className="animate-in flex flex-col gap-6">
      <h1 className="font-display text-2xl font-bold tracking-tight">{t('title')}</h1>
      <Card className="p-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-muted">{t('plan')}:</p>
          <p className="font-display text-xl font-semibold">{b.plan.name}</p>
          <Badge tone={b.status === 'past_due' ? 'danger' : b.status === 'trialing' ? 'accent' : 'brand'}>{t(`status.${b.status}`)}</Badge>
          {b.periodEnd ? <span className="text-sm text-muted">{t('until', { time: fmtDateTime(b.periodEnd, 'en') })}</span> : null}
        </div>
        <p className="mt-4 text-sm font-semibold">{t('usage')}</p>
        {b.usage.included ? (
          <>
            <UsageBar used={b.usage.used} total={b.usage.included} label={t('of', { used: b.usage.used, included: b.usage.included })} />
          </>
        ) : (
          <p className="mt-1">{t('unlimited', { used: b.usage.used })}</p>
        )}
        {b.warning !== 'none' ? (
          <p role="status" className={cn('mt-3 flex items-start gap-2 rounded-card px-3 py-2 text-sm font-medium', b.warning === 'over' ? 'bg-danger-soft text-danger' : 'bg-accent-soft text-ink')}>
            <AlertTriangle aria-hidden className="mt-0.5 size-4 shrink-0" />
            {b.warning === 'over' ? t('over') : t('near')}
          </p>
        ) : null}
      </Card>

      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold">{t('plans')}</h2>
          <Tabs label={t('plans')} value={cycle} onChange={setCycle} items={[{ value: 'monthly', label: t('monthly') }, { value: 'yearly', label: t('yearly') }]} />
        </div>
        <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {b.plans.map((p) => {
            const price = cycle === 'monthly' ? p.monthlyInr : p.yearlyInr;
            const current = p.key === b.plan.key;
            return (
              <Card key={p.key} className={cn('flex flex-col gap-2 p-5', current && 'border-brand ring-2 ring-brand/20')}>
                <p className="font-display text-lg font-semibold">{p.name}</p>
                <p className="text-2xl font-bold">{price === null ? t('contact') : price === 0 ? '₹0' : t(cycle === 'monthly' ? 'perMonth' : 'perYear', { n: price.toLocaleString('en-IN') })}</p>
                <ul className="flex flex-col gap-1 text-sm text-muted">
                  {p.summariesIncluded ? <li className="flex gap-2"><Check aria-hidden className="size-4 text-brand" />{t('summaries', { n: p.summariesIncluded })}</li> : null}
                  {p.maxDoctors ? <li className="flex gap-2"><Check aria-hidden className="size-4 text-brand" />{t('doctors', { n: p.maxDoctors })}</li> : null}
                  {p.features.map((f) => <li key={f} className="flex gap-2"><Check aria-hidden className="size-4 text-brand" />{f.replace(/_/g, ' ')}</li>)}
                </ul>
                <div className="mt-auto pt-2">
                  {current ? (
                    <Badge tone="brand">{t('current')}</Badge>
                  ) : p.key === 'pro' || p.key === 'clinic' ? (
                    <Button block variant="secondary" disabled={!b.onlinePayments} loading={checkout.isPending && checkout.variables === p.key} onClick={() => checkout.mutate(p.key)}>
                      {t('choose', { name: p.name })}
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
        <p className="mt-2 text-sm text-muted">{t('gst')}</p>
        {!b.onlinePayments ? <p className="mt-1 text-sm text-muted">{t('paymentsOff')}</p> : null}
        {checkout.error ? <p role="alert" className="mt-2 font-medium text-danger">{checkout.error.message}</p> : null}
      </section>

      <Card className="p-5">
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            coupon.mutate();
          }}
        >
          <Field label={t('coupon')} htmlFor="coupon" className="flex-1" error={coupon.error instanceof ApiError ? coupon.error.message : undefined}>
            <Input id="coupon" className="uppercase" value={code} onChange={(e) => setCode(e.target.value)} />
          </Field>
          <Button type="submit" loading={coupon.isPending} disabled={!code.trim()}>
            {t('apply')}
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="font-display text-xl font-semibold">{t('invoices')}</h2>
        {b.invoices.length ? (
          <ul className="mt-3 divide-y divide-line">
            {b.invoices.map((i) => (
              <li key={i.id} className="flex flex-wrap items-center gap-3 py-3">
                <span className="font-mono">{i.number}</span>
                <span className="flex-1 text-sm text-muted">{fmtDateTime(i.issuedAt, 'en')} · {i.plan}</span>
                <span className="font-semibold">₹{i.totalInr.toLocaleString('en-IN')}</span>
                <Button asChild size="sm" variant="secondary">
                  <Link href={`/d/billing/invoices/${i.id}`}>{t('invoice')}</Link>
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-muted">{t('noInvoices')}</p>
        )}
      </Card>
    </div>
  );
}
