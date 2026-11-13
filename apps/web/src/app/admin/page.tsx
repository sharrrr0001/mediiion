'use client';
import { Activity, AlertTriangle, BadgeCheck, CheckCircle2, Eye, IndianRupee, LifeBuoy, UserCheck } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { StatCard } from '@medicos/ui';
import { PanelFrame, usePanel } from '@/components/admin/panel';

interface Overview {
  interviewsToday: number;
  completionRate7d: number | null;
  summariesOpenedBeforeVisit7d: number | null;
  safetyMessagesToday: number;
  activeDoctors: number;
  pendingDoctors: number;
  mrrInr: number;
  openTickets: number;
}
const pct = (n: number | null) => (n === null ? '—' : `${n}%`);

/** Admin dashboard (spec §7.5): live aggregates only, no patient data. */
export default function AdminPage() {
  const t = useTranslations('panels.overview');
  const q = usePanel<Overview>('overview', '/admin/overview');
  const o = q.data;
  return (
    <PanelFrame title={t('title')} q={q}>
      {o ? (
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatCard label={t('interviews')} value={String(o.interviewsToday)} icon={<Activity aria-hidden />} />
          <StatCard label={t('completion')} value={pct(o.completionRate7d)} icon={<CheckCircle2 aria-hidden />} />
          <StatCard label={t('opened')} value={pct(o.summariesOpenedBeforeVisit7d)} icon={<Eye aria-hidden />} />
          <StatCard label={t('safety')} value={String(o.safetyMessagesToday)} icon={<AlertTriangle aria-hidden />} />
          <StatCard label={t('doctors')} value={String(o.activeDoctors)} icon={<BadgeCheck aria-hidden />} />
          <StatCard label={t('pending')} value={String(o.pendingDoctors)} icon={<UserCheck aria-hidden />} />
          <StatCard label={t('mrr')} value={`₹${o.mrrInr.toLocaleString('en-IN')}`} icon={<IndianRupee aria-hidden />} />
          <StatCard label={t('tickets')} value={String(o.openTickets)} icon={<LifeBuoy aria-hidden />} />
        </div>
      ) : null}
    </PanelFrame>
  );
}
