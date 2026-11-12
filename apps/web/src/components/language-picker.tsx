'use client';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LANGUAGES, type Language } from '@medicos/shared/client';
import { cn } from '@medicos/ui';

const LABELS: Record<Language, string> = { hi: 'हिंदी', en: 'English', 'hi-Latn': 'Hinglish' };

export function setLocaleCookie(lang: Language) {
  document.cookie = `NEXT_LOCALE=${lang}; path=/; max-age=31536000; samesite=lax`;
}

/** Segmented हिंदी / English / Hinglish switch. Stored in a cookie; no locale in the URL. */
export function LanguagePicker({ className }: { className?: string }) {
  const t = useTranslations('common');
  const locale = useLocale() as Language;
  const router = useRouter();
  const [pending, start] = useTransition();

  return (
    <div role="radiogroup" aria-label={t('languageLabel')} className={cn('inline-flex rounded-full bg-surface-2 p-1', className)}>
      {LANGUAGES.map((lang) => (
        <button
          key={lang}
          type="button"
          role="radio"
          aria-checked={locale === lang}
          disabled={pending}
          lang={lang}
          onClick={() => {
            setLocaleCookie(lang);
            start(() => router.refresh());
          }}
          className={cn(
            'min-h-10 rounded-full px-2.5 text-[13px] font-medium text-muted transition-colors sm:px-3.5 sm:text-sm',
            locale === lang && 'bg-surface text-brand shadow-sm',
          )}
        >
          {LABELS[lang]}
        </button>
      ))}
    </div>
  );
}
