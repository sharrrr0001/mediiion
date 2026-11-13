import { z } from 'zod';

/** Doctor search: normal filters only — no AI matching, no AI-chosen specialty (rule 3). */
export const DoctorSearch = z
  .object({
    specialty: z.string().trim().max(40).optional(),
    city: z.string().trim().max(60).optional(),
    area: z.string().trim().max(60).optional(),
    maxFee: z.coerce.number().int().min(0).max(100_000).optional(),
    language: z.enum(['en', 'hi']).optional(),
    q: z.string().trim().max(60).optional(),
  })
  .strict();
export type DoctorSearch = z.infer<typeof DoctorSearch>;

/** YYYY-MM-DD in India Standard Time. */
export const IsoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD');

export const SlotsQuery = z.object({ clinicId: z.uuid(), date: IsoDate }).strict();
export type SlotsQuery = z.infer<typeof SlotsQuery>;

export const BookAppointment = z
  .object({
    profileId: z.uuid(),
    doctorId: z.uuid(),
    clinicId: z.uuid(),
    startsAt: z.iso.datetime(),
    /** AI-first order: attach the finished interview so its summary goes to this doctor. */
    sessionId: z.uuid().optional(),
  })
  .strict();
export type BookAppointment = z.infer<typeof BookAppointment>;

export interface ClinicView {
  id: string;
  name: string;
  address: string;
  city: string;
  area: string | null;
  lat: number | null;
  lng: number | null;
  fee: { consult: number; followUp: number; modes: string[] } | null;
  /** weekday 0 = Sunday; times "HH:MM" IST. */
  hours: Array<{ weekday: number; start: string; end: string; slotMinutes: number }>;
}

export interface DoctorCard {
  id: string;
  name: string;
  specialty: string;
  degrees: string[];
  yearsExperience: number | null;
  languages: string[];
  verified: true;
  clinic: { id: string; name: string; city: string; area: string | null } | null;
  fee: number | null;
  /** ISO time of the next free slot in the next 7 days, if any. */
  nextSlot: string | null;
}

export interface DoctorProfileView extends DoctorCard {
  about: string | null;
  registrationNo: string | null;
  council: string | null;
  clinics: ClinicView[];
}

export interface SlotsView {
  date: string;
  clinicId: string;
  slots: Array<{ startsAt: string; free: boolean }>;
}

export type AppointmentStatusView = 'booked' | 'confirmed' | 'checked_in' | 'completed' | 'cancelled' | 'no_show';

export interface AppointmentView {
  id: string;
  startsAt: string;
  status: AppointmentStatusView;
  type: 'new' | 'follow_up' | 'walk_in';
  doctor: { id: string; name: string; specialty: string };
  clinic: { id: string; name: string; address: string; city: string };
  fee: number | null;
  /** True when a pre-visit summary is attached and shared with this doctor only. */
  summaryAttached: boolean;
  profile: { id: string; name: string };
}
