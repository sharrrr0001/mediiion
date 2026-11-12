/**
 * Browser-safe subset of @medicos/shared with NO zod import, so client bundles stay small
 * (spec §8 budget: < 150 KB JS on the patient chat route). Types are erased at build time.
 */
export * from './constants';
export * from './safety-config';
export * from './medicos-id';
export { MAX_VOICE_BYTES, MAX_VOICE_MS } from './intake';
export type { VoiceDraft } from './intake';
export type { IntakeAwaiting, IntakeAttachmentView, IntakeMessageView, IntakeReview, IntakeView, ReviewItem } from './intake';
export type { MeResponse, ProfileSummary } from './patient';
export type { DoctorListItem, DoctorMe, DoctorQueueRow, DoctorSummaryView, FinalisedNoteView, QueueStatus, RecordDetailView, RecordEntryView } from './doctor';
export type { PreVisitSummary, SummaryLine } from './pre-visit-summary';
export type { TwoFactorChallengeResponse } from './auth';
