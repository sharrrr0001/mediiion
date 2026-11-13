'use client';
import { useQuery } from '@tanstack/react-query';
import type { AppointmentView, DoctorCard, DoctorProfileView, SlotsView } from '@medicos/shared/client';
import { api } from './api';

export interface DoctorFilters {
  specialty?: string;
  area?: string;
  maxFee?: string;
}

const qs = (o: Record<string, string | undefined>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) p.set(k, v);
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const useDoctors = (f: DoctorFilters) =>
  useQuery({ queryKey: ['doctors', f], queryFn: () => api<DoctorCard[]>(`/doctors${qs({ ...f })}`) });

export const useDoctorProfile = (id: string) => useQuery({ queryKey: ['doctor', id], queryFn: () => api<DoctorProfileView>(`/doctors/${id}`) });

export const useSlots = (doctorId: string, clinicId: string | undefined, date: string) =>
  useQuery({
    queryKey: ['slots', doctorId, clinicId, date],
    queryFn: () => api<SlotsView>(`/doctors/${doctorId}/slots${qs({ clinicId, date })}`),
    enabled: !!clinicId,
    staleTime: 10_000,
  });

export const APPOINTMENTS_KEY = ['appointments'] as const;
export const useAppointments = () => useQuery({ queryKey: APPOINTMENTS_KEY, queryFn: () => api<AppointmentView[]>('/appointments') });

/** Times are always shown in India Standard Time, whatever the device's time zone. */
export const IST = 'Asia/Kolkata';
export function istToday(): string {
  return new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10);
}
export function addDays(date: string, n: number): string {
  return new Date(new Date(`${date}T00:00:00Z`).getTime() + n * 86_400_000).toISOString().slice(0, 10);
}
export function fmtTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: IST, hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
export function fmtDateTime(iso: string, locale: string) {
  return new Intl.DateTimeFormat(locale === 'hi' ? 'hi-IN' : 'en-IN', { timeZone: IST, weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' }).format(new Date(iso));
}
