'use client';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { MeResponse } from '@medicos/shared/client';
import { api, ApiError } from './api';

export const ME_KEY = ['me'] as const;

export function useMe() {
  return useQuery({ queryKey: ME_KEY, queryFn: () => api<MeResponse>('/me') });
}

/** Where a signed-in patient should be, given their onboarding state. */
export function onboardingTarget(me: MeResponse): string {
  if (me.needsConsent) return '/p/consent';
  if (me.needsProfile) return '/p/profile';
  return '/p/home';
}

const ONBOARDING = new Set(['/p/consent', '/p/profile']);

/**
 * Keeps the patient on the right step: login → consent → profile → app.
 * Returns `me` only once the current page is the right place to be.
 */
export function usePatientGate() {
  const router = useRouter();
  const pathname = usePathname();
  const query = useMe();
  const me = query.data;

  let redirect: string | null = null;
  if (query.error instanceof ApiError && query.error.status === 401) redirect = '/p/login';
  else if (me) {
    const target = onboardingTarget(me);
    if (ONBOARDING.has(target) && pathname !== target) redirect = target;
    else if (!ONBOARDING.has(target) && ONBOARDING.has(pathname)) redirect = target;
  }

  useEffect(() => {
    if (redirect) router.replace(redirect);
  }, [redirect, router]);

  return { ...query, me: redirect ? undefined : me };
}
