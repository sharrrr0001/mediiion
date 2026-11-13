'use client';
import { Building2, IndianRupee, Users, Wallet } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatCard } from '@medicos/ui';
import { DataTable, PanelFrame, usePanel } from '@/components/admin/panel';

interface Founder {
  mrrInr: number;
  payingClinics: number;
  freeOrTrialClinics: number;
  activeClinics30d: number;
  weeks: Array<{ weeksAgo: number; summaries: number; aiCostPerSummaryInr: number | null }>;
}

/** Founder panel (spec §7.5): business health at a glance. */
export default function FounderPage() {
  const t = useTranslations('panels.founder');
  const tp = useTranslations('panels');
  const q = usePanel<Founder>('founder', '/founder/metrics');
  const f = q.data;
  return (
    <PanelFrame title={t('title')} q={q}>
      {f ? (
        <>
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatCard label={t('mrr')} value={`₹${f.mrrInr.toLocaleString('en-IN')}`} icon={<IndianRupee aria-hidden />} />
            <StatCard label={t('paying')} value={String(f.payingClinics)} icon={<Wallet aria-hidden />} />
            <StatCard label={t('free')} value={String(f.freeOrTrialClinics)} icon={<Users aria-hidden />} />
            <StatCard label={t('active')} value={String(f.activeClinics30d)} icon={<Building2 aria-hidden />} />
          </div>
          <h2 className="font-display text-xl font-semibold">{t('weeks')}</h2>
          <DataTable
            label={t('weeks')}
            rows={f.weeks}
            empty={tp('empty')}
            columns={[
              { head: t('week'), cell: (r) => r.weeksAgo },
              { head: t('summaries'), cell: (r) => r.summaries },
              { head: t('cost'), cell: (r) => (r.aiCostPerSummaryInr === null ? '—' : `₹${r.aiCostPerSummaryInr}`) },
            ]}
          />
        </>
      ) : null}
    </PanelFrame>
  );
}
