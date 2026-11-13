import { useTranslations } from 'next-intl';
import { container } from '@/components/shell/layout';

/** Plain-language legal page (privacy / terms). Text lives in messages `legal.*`; marked as a draft for review. */
export function LegalPage({ kind }: { kind: 'privacy' | 'terms' }) {
  const t = useTranslations('legal');
  const sections = t.raw(`${kind}.sections`) as Array<[string, string]>;
  return (
    <div className={`${container} max-w-3xl py-10 md:py-14`}>
      <h1 className="font-display text-4xl font-bold tracking-tight">{t(`${kind}.title`)}</h1>
      <p className="mt-2 text-sm text-muted">{t('updated')}</p>
      <p className="mt-4 rounded-card border border-[#f3dfb3] bg-accent-soft px-4 py-3 text-sm font-medium text-accent-ink">{t('draft')}</p>
      <div className="mt-8 flex flex-col gap-6">
        {sections.map(([heading, body]) => (
          <section key={heading}>
            <h2 className="font-display text-xl font-semibold">{heading}</h2>
            <p className="mt-2 leading-relaxed text-ink">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
