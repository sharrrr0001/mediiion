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

/** Share one pre-visit summary with a doctor not on Medicos (spec §7.1 #9): secret link, 72 h, revocable. */
export const CreateShareLink = z.object({ recordId: z.uuid() }).strict();
export type CreateShareLink = z.infer<typeof CreateShareLink>;

export interface ShareLinkView {
  id: string;
  /** Only returned once, when the link is created (the token is never stored). */
  path: string | null;
  expiresAt: string;
  revokedAt: string | null;
  openCount: number;
}

export interface SharedSummaryView {
  patient: { firstName: string; age: number | null; sex: string };
  sharedAt: string;
  expiresAt: string;
  aiLabel: string;
  summary: import('./pre-visit-summary').PreVisitSummary;
}
