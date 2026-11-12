import { cookies, headers } from 'next/headers';
import { getRequestConfig } from 'next-intl/server';
import { LANGUAGES, type Language } from '@medicos/shared/client';

export const LOCALE_COOKIE = 'NEXT_LOCALE';

function isLanguage(v: string | undefined): v is Language {
  return !!v && (LANGUAGES as readonly string[]).includes(v);
}

/** Locale comes from a cookie (no locale in URLs), falling back to the browser's language. */
export default getRequestConfig(async () => {
  const fromCookie = (await cookies()).get(LOCALE_COOKIE)?.value;
  let locale: Language = 'en';
  if (isLanguage(fromCookie)) locale = fromCookie;
  else if (/^hi\b/i.test((await headers()).get('accept-language') ?? '')) locale = 'hi';

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
