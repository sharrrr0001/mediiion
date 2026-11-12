import { z } from 'zod';
import type { PreVisitSummary } from './pre-visit-summary';

export interface DoctorListItem {
  id: string;
  name: string;
  specialty: string;
  degrees: string[];
  yearsExperience: number | null;
  clinic: { name: string; city: string; area: string | null } | null;
  fee: number | null;
}

export type QueueStatus = 'ready' | 'progress' | 'walkin' | 'idle' | 'done';

export interface DoctorQueueRow {
  appointmentId: string;
  time: string; // ISO
  medicosId: string;
  /** Initials + age/sex when the doctor has access, otherwise null (show Medicos ID). */
  label: string | null;
  complaint: string | null;
  status: QueueStatus;
  safety: boolean;
  type: 'new' | 'follow_up' | 'walk_in';
}

export interface DoctorMe {
  id: string;
  name: string;
  specialty: string;
  verificationStatus: string;
  clinic: { id: string; name: string } | null;
}

export interface DoctorSummaryView {
  appointmentId: string;
  patient: { medicosId: string; name: string; age: number | null; gender: string };
  visitType: 'new' | 'follow_up' | 'walk_in';
  startsAt: string;
  summaryId: string | null;
  summaryStatus: 'draft' | 'delivered' | 'reviewed' | null;
  summary: PreVisitSummary | null;
  attachments: Array<{ id: string; kind: string; mime: string; label: string | null; url: string }>;
  safetyShown: boolean;
  note: FinalisedNoteView | null;
}

export interface FinalisedNoteView {
  id: string;
  assessment: string;
  plan: string;
  examination: string | null;
  testsAdvised: string | null;
  followUpDate: string | null;
  finalisedAt: string;
  doctorName: string;
  prescription: Array<{ drug: string; dose: string; frequency: string; duration: string; instructions: string | null }>;
}

const text = (max: number) => z.string().trim().max(max);
export const PrescriptionItemInput = z
  .object({
    drug: text(120).min(1),
    dose: text(60).min(1),
    frequency: text(60).min(1),
    duration: text(60).min(1),
    instructions: text(200).optional(),
  })
  .strict();

/** Written by the treating doctor only (rule 9). */
export const FinaliseNote = z
  .object({
    assessment: text(5000).min(1, 'Assessment is required'),
    plan: text(5000).min(1, 'Plan is required'),
    examination: text(3000).optional(),
    testsAdvised: text(1000).optional(),
    followUpDate: z.iso.date().optional(),
    prescription: z.array(PrescriptionItemInput).max(20).default([]),
  })
  .strict();
export type FinaliseNote = z.infer<typeof FinaliseNote>;

export const SummaryFeedbackInput = z
  .object({
    useful: z.boolean(),
    issues: z.array(z.enum(['missing_info', 'wrong_info', 'too_long', 'unclear', 'unsafe_wording', 'other'])).max(6).default([]),
    comment: text(500).optional(),
  })
  .strict();
export type SummaryFeedbackInput = z.infer<typeof SummaryFeedbackInput>;

export interface RecordEntryView {
  id: string;
  kind: 'doctor_note' | 'prescription' | 'pre_visit_summary' | 'uploaded_report';
  date: string;
  title: string;
  patientName: string;
}

export interface RecordDetailView extends RecordEntryView {
  note: FinalisedNoteView | null;
  summary: PreVisitSummary | null;
}
