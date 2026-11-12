'use client';
import { TriangleAlert } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { usePublicConfig } from '@/lib/use-config';

/** Shown on every app page when the server runs a free-tier or scripted AI (docs/deploy.md). */
export function DemoBanner() {
  const t = useTranslations('common');
  const cfg = usePublicConfig();
  if (!cfg.demo) return null;
  return (
    <div role="note" className="flex items-center justify-center gap-2 bg-accent-soft px-4 py-2 text-center text-sm font-medium text-ink">
      <TriangleAlert aria-hidden className="size-4 shrink-0" />
      {t('demoBanner')}
    </div>
  );
}
