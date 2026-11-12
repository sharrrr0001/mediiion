import type en from './messages/en.json';
import type { Language } from '@medicos/shared';

declare module 'next-intl' {
  interface AppConfig {
    Locale: Language;
    Messages: typeof en;
  }
}
