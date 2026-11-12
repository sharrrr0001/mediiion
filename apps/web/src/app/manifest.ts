import type { MetadataRoute } from 'next';
import { APP_NAME } from '@medicos/shared';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: APP_NAME,
    short_name: APP_NAME,
    description: 'Doctor ka time bachao. Patient ki baat poori suno.',
    start_url: '/p/home',
    scope: '/p/',
    display: 'standalone',
    background_color: '#F6F8F6',
    theme_color: '#0B6B50',
    icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
  };
}
