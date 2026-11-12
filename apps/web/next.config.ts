import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');
const API_URL = process.env.API_URL ?? 'http://localhost:4000';

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'X-Frame-Options', value: 'DENY' },
  // Camera is needed later for QR scanning (doctor app) and photos; mic for voice intake.
  { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },

];

const config: NextConfig = {
  reactStrictMode: true,
  // Lets a production build run next to `next dev` without clobbering .next/.
  distDir: process.env.NEXT_DIST_DIR ?? '.next',
  poweredByHeader: false,
  devIndicators: false,
  // Inline the (small) Tailwind CSS into the HTML: removes a render-blocking request on slow mobile networks.
  experimental: { inlineCss: true },
  transpilePackages: ['@medicos/ui'],
  // Same-origin API: httpOnly cookies work without CORS (docs/decisions.md).
  // On Vercel the /api rewrite lives in vercel.json (points at the API tunnel; scripts/start-tunnel.ps1).
  async rewrites() {
    return process.env.VERCEL ? [] : [{ source: '/api/:path*', destination: `${API_URL}/:path*` }];
  },
  async headers() {
    return [
      { source: '/:path*', headers: securityHeaders },
      { source: '/sw.js', headers: [{ key: 'Service-Worker-Allowed', value: '/p/' }, { key: 'Cache-Control', value: 'no-cache' }] },
    ];
  },
};

export default withNextIntl(config);
