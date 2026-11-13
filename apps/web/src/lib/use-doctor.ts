'use client';
import { useQuery } from '@tanstack/react-query';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect } from 'react';
import type { DoctorMe } from '@medicos/shared/client';
import { api, ApiError } from './api';

/** Signed-in doctor; unauthenticated visitors go to /d/login. */
export function useDoctor() {
  const router = useRouter();
  const pathname = usePathname();
  const q = useQuery({ queryKey: ['doctor-me'], queryFn: () => api<DoctorMe>('/doctor/me') });
  const unauth = q.error instanceof ApiError && (q.error.status === 401 || q.error.status === 403);
  // Until Medicos staff verify the doctor, only the onboarding page is useful (no patients: rule 10).
  const unverified = !!q.data && q.data.verificationStatus !== 'verified' && pathname !== '/d/onboarding';
  useEffect(() => {
    if (unauth) router.replace(`/d/login?next=${encodeURIComponent(pathname)}`);
    else if (unverified) router.replace('/d/onboarding');
  }, [unauth, unverified, router, pathname]);
  return q;
}
