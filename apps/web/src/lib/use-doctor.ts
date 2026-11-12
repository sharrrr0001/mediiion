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
  useEffect(() => {
    if (unauth) router.replace(`/d/login?next=${encodeURIComponent(pathname)}`);
  }, [unauth, router, pathname]);
  return q;
}
