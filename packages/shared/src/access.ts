import { z } from 'zod';

/** Doctor scans or types the patient's Medicos ID; the patient then sees Allow / Deny (rule 10). */
export const RequestAccess = z
  .object({ medicosId: z.string().trim().toUpperCase().max(20) })
  .strict();
export type RequestAccess = z.infer<typeof RequestAccess>;

export const DecideAccess = z.object({ decision: z.enum(['allow', 'deny']) }).strict();
export type DecideAccess = z.infer<typeof DecideAccess>;

export type AccessRequestStatus = 'pending' | 'allowed' | 'denied' | 'expired';

/** What the doctor sees while waiting: no patient data until allowed. */
export interface DoctorAccessRequestView {
  id: string;
  status: AccessRequestStatus;
  medicosId: string;
  expiresAt: string;
  /** Present only once allowed. */
  grantExpiresAt: string | null;
  patient: { profileId: string; label: string } | null;
}

/** What the patient sees in the Allow / Deny prompt. */
export interface PatientAccessRequestView {
  id: string;
  doctor: { name: string; specialty: string; clinic: string | null };
  profileName: string;
  createdAt: string;
  expiresAt: string;
  grantHours: number;
}

export interface AccessGrantView {
  id: string;
  doctor: { name: string; specialty: string };
  profileName: string;
  via: 'share' | 'qr_prompt' | 'otp';
  grantedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  active: boolean;
}

/** A doctor's view of a patient they have access to: record book entries (finalised notes + summaries). */
export interface DoctorPatientView {
  profileId: string;
  medicosId: string;
  label: string;
  grantExpiresAt: string;
  entries: Array<{ id: string; kind: string; title: string; date: string }>;
}
