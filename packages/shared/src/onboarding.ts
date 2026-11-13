import { z } from 'zod';
import { DOC_KINDS, SPECIALTIES } from './onboarding-consts';

const text = (max: number) => z.string().trim().min(1).max(max);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:MM');

export { DOC_KINDS, SPECIALTIES };
export const COUNCILS_HINT = 'National Medical Commission or a State Medical Council';

/** Spec §7.2 step 2: create the doctor account (after OTP). Verification is by Medicos staff, never automatic. */
export const DoctorSignup = z
  .object({
    name: text(80),
    specialty: z.enum(SPECIALTIES),
    city: text(60),
    registrationNo: text(40),
    council: text(80),
    degrees: z.array(text(40)).min(1).max(6),
    yearsExperience: z.coerce.number().int().min(0).max(70),
    languages: z.array(z.enum(['en', 'hi'])).min(1).max(2),
  })
  .strict();
export type DoctorSignup = z.infer<typeof DoctorSignup>;

export type DocKind = (typeof DOC_KINDS)[number];

/** Spec §7.2 steps 4–5: clinic, weekly hours, slot length, fees. */
export const ClinicSetup = z
  .object({
    name: text(80),
    address: text(200),
    city: text(60),
    area: z.string().trim().max(60).optional(),
    slotMinutes: z.coerce.number().int().refine((n) => [10, 15, 20, 30].includes(n), 'Pick 10, 15, 20 or 30 minutes'),
    hours: z
      .array(z.object({ weekday: z.number().int().min(0).max(6), start: hhmm, end: hhmm }).refine((h) => h.start < h.end, 'End must be after start'))
      .min(1)
      .max(21),
    fee: z.object({ consult: z.coerce.number().int().min(0).max(100_000), followUp: z.coerce.number().int().min(0).max(100_000), modes: z.array(z.enum(['pay_at_clinic', 'upi'])).min(1) }),
  })
  .strict();
export type ClinicSetup = z.infer<typeof ClinicSetup>;

export const DoctorProfileUpdate = z.object({ about: z.string().trim().max(800).optional(), languages: z.array(z.enum(['en', 'hi'])).min(1).max(2).optional() }).strict();
export type DoctorProfileUpdate = z.infer<typeof DoctorProfileUpdate>;

export const VerificationDecision = z
  .object({ decision: z.enum(['approve', 'reject']), note: z.string().trim().max(300).optional() })
  .strict()
  .refine((d) => d.decision === 'approve' || !!d.note, { message: 'Give a reason when rejecting', path: ['note'] });
export type VerificationDecision = z.infer<typeof VerificationDecision>;

export interface OnboardingView {
  status: 'pending' | 'verified' | 'rejected' | 'suspended';
  rejectionNote: string | null;
  steps: { account: true; documents: boolean; clinic: boolean; profile: boolean };
  documents: Array<{ id: string; kind: DocKind; status: string; createdAt: string }>;
  clinic: (Omit<ClinicSetup, 'area'> & { id: string; area: string | null }) | null;
  about: string | null;
  languages: string[];
}

export interface VerificationQueueItem {
  doctorId: string;
  name: string;
  specialty: string;
  registrationNo: string | null;
  council: string | null;
  degrees: string[];
  yearsExperience: number | null;
  city: string | null;
  submittedAt: string;
  documents: Array<{ id: string; kind: string; url: string; mime: string }>;
}
