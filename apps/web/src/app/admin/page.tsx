import { Activity, AlertTriangle, BadgeCheck, CheckCircle2, Info } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { Badge, Card, SectionHeader, StatCard } from '@medicos/ui';

/** FICTIONAL sample rows (spec §15 seed doctors) until the admin tools arrive in Phase 5. */
const QUEUE = [
  { name: 'Dr. R. Verma', council: 'Madhya Pradesh Medical Council', submitted: '12 Nov 2026', verified: false },
  { name: 'Dr. A. Sharma', council: 'Madhya Pradesh Medical Council', submitted: '9 Nov 2026', verified: true },
  { name: 'Dr. A. Mehta', council: 'Madhya Pradesh Medical Council', submitted: '2 Nov 2026', verified: true },
];

export default function AdminPage() {
  const t = useTranslations('admin');
  return (
    <div className="flex flex-col gap-5 p-4 md:p-6">
      <p className="flex items-start gap-2 rounded-card border border-[#f3dfb3] bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink">
        <Info aria-hidden className="mt-0.5 size-4 shrink-0" />
        {t('preview')}
      </p>
      <h1 className="sr-only">{t('title')}</h1>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t('stats.interviews')} value="128" trend="+12% vs last week" icon={<Activity aria-hidden />} />
        <StatCard label={t('stats.completion')} value="78%" trend="Target 75%" icon={<CheckCircle2 aria-hidden />} />
        <StatCard label={t('stats.safety')} value="6" trend="100% seen by clinic" icon={<AlertTriangle aria-hidden />} />
        <StatCard label={t('stats.doctors')} value="24" trend="+4 this month" icon={<BadgeCheck aria-hidden />} />
      </div>
      <Card className="p-0 md:p-0">
        <SectionHeader className="p-5" title={t('queueTitle')} description={t('queueBody')} />
        <div tabIndex={0} role="region" aria-label={t('queueTitle')} className="max-h-[420px] overflow-auto border-t border-line focus-visible:outline-offset-[-3px]">
          <table className="w-full min-w-[640px] text-left text-[15px]">
            <thead className="sticky top-0 bg-surface-2 text-sm text-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">{t('cols.doctor')}</th>
                <th scope="col" className="px-5 py-3 font-semibold">{t('cols.council')}</th>
                <th scope="col" className="px-5 py-3 font-semibold">{t('cols.submitted')}</th>
                <th scope="col" className="px-5 py-3 font-semibold">{t('cols.status')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {QUEUE.map((r) => (
                <tr key={r.name} className="hover:bg-surface-2/60">
                  <td className="px-5 py-3.5 font-semibold">{r.name}</td>
                  <td className="px-5 py-3.5 text-muted">{r.council}</td>
                  <td className="tabular px-5 py-3.5 text-muted">{r.submitted}</td>
                  <td className="px-5 py-3.5">
                    <Badge tone={r.verified ? 'brand' : 'accent'} dot>
                      {r.verified ? t('verified') : t('pending')}
                    </Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
