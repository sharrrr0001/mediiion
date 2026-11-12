'use client';
import { useTranslations } from 'next-intl';
import { Card, EmptyState } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { usePatientGate } from '@/lib/use-me';

/** Medical Record Book fills after doctors finalise visits (Phase 2). */
export default function RecordsPage() {
  const t = useTranslations('records');
  usePatientGate();
  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <Card className="mt-6 md:mt-8">
        <EmptyState art="folder" title={t('emptyTitle')} body={t('emptyBody')} />
      </Card>
    </div>
  );
}
