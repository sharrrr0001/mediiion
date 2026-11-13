/**
 * Browser-safe subset of @medicos/shared with NO zod import, so client bundles stay small
 * (spec §8 budget: < 150 KB JS on the patient chat route). Types are erased at build time.
 * RULE: only `export type` from modules that import zod (intake, patient, doctor, auth).
 */
export * from './constants';
export * from './safety-config';
export * from './medicos-id';
export type { VoiceDraft } from './intake';
export type { IntakeAwaiting, IntakeAttachmentView, IntakeMessageView, IntakeReview, IntakeView, ReviewItem } from './intake';
export type { MeResponse, ProfileSummary } from './patient';
export type { DoctorListItem, DoctorMe, DoctorQueueRow, DoctorSummaryView, FinalisedNoteView, QueueStatus, RecordDetailView, RecordEntryView } from './doctor';
export type { PreVisitSummary, SummaryLine } from './pre-visit-summary';
export type { TwoFactorChallengeResponse } from './auth';
export type { AppointmentStatusView, AppointmentView, ClinicView, DoctorCard, DoctorProfileView, SlotsView } from './booking';
export type { AccessGrantView, AccessRequestStatus, DoctorAccessRequestView, DoctorPatientView, PatientAccessRequestView, ShareLinkView, SharedSummaryView } from './access';
export type { DocKind, OnboardingView, VerificationQueueItem } from './onboarding';
export { DOC_KINDS, SPECIALTIES } from './onboarding-consts';
export type { ClinicContext, ClinicQueueRow, StaffMemberView } from './staff';
