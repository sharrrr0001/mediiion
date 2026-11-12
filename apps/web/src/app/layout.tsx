import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter, JetBrains_Mono, Noto_Sans_Devanagari } from 'next/font/google';
import { getLocale } from 'next-intl/server';
import type { ReactNode } from 'react';
import { APP_NAME } from '@medicos/shared/client';
import { Providers } from '@/components/providers';
import './globals.css';

// display: 'optional' — no late font swap repaint (better LCP on slow mobile networks); fallbacks are size-matched.
const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'optional' });
const devanagari = Noto_Sans_Devanagari({
  subsets: ['devanagari'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-devanagari',
  display: 'swap',
  // Only needed for Hindi text; don't compete with the LCP on English pages.
  preload: false,
});
const bricolage = Bricolage_Grotesque({ subsets: ['latin'], variable: '--font-bricolage', display: 'optional' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-jetbrains', display: 'swap', preload: false });

export const metadata: Metadata = {
  title: { default: `${APP_NAME} — Pre-visit intake for Indian clinics`, template: `%s · ${APP_NAME}` },
  description: 'Doctor ka time bachao. Patient ki baat poori suno.',
  applicationName: APP_NAME,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#FFFFFF',
  colorScheme: 'light',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = await getLocale();
  return (
    <html lang={locale} className={`${inter.variable} ${devanagari.variable} ${bricolage.variable} ${mono.variable}`}>
      <body className="min-h-dvh bg-bg font-sans text-ink antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
