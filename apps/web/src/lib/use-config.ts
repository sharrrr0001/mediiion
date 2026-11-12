'use client';
import { useQuery } from '@tanstack/react-query';
import { api } from './api';

export interface PublicConfig {
  /** Free-tier / scripted AI: fictional data only. */
  demo: boolean;
  ai: string;
  channels: Array<'sms' | 'email'>;
  voice: boolean;
}

/** Until the server answers, assume the most permissive dev defaults (local dev has every channel). */
const FALLBACK: PublicConfig = { demo: false, ai: 'scripted', channels: ['sms', 'email'], voice: true };

export function usePublicConfig(): PublicConfig & { loaded: boolean } {
  const q = useQuery({ queryKey: ['config'], queryFn: () => api<PublicConfig>('/config'), staleTime: Infinity });
  return { ...(q.data ?? FALLBACK), loaded: !!q.data };
}
