'use client';
import { Sparkles } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Button, Card, EmptyState } from '@medicos/ui';
import { container } from '@/components/shell/layout';
import { usePatientGate } from '@/lib/use-me';

/** Appointments arrive with doctor booking (Phase 4). Until then: a clear empty state. */
export default function VisitsPage() {
  const t = useTranslations('visits');
  usePatientGate();
  return (
    <div className={`${container} animate-in py-6 md:py-10`}>
      <h1 className="text-page-title font-display font-bold tracking-tight">{t('title')}</h1>
      <p className="mt-1 text-muted">{t('subtitle')}</p>
      <Card className="mt-6 md:mt-8">
        <EmptyState
          art="calendar"
          title={t('emptyTitle')}
          body={t('emptyBody')}
          action={
            <Button asChild size="lg">
              <Link href="/p/intake/new">
                <Sparkles aria-hidden />
                {t('cta')}
              </Link>
            </Button>
          }
        />
      </Card>
    </div>
  );
}
