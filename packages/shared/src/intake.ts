import { z } from 'zod';
import { LANGUAGES } from './constants';

export const TEMPLATE_KEYS = ['general-medicine', 'dermatology', 'paediatrics', 'gynaecology'] as const;

export const StartIntake = z
  .object({
    profileId: z.uuid(),
    templateKey: z.enum(TEMPLATE_KEYS).default('general-medicine'),
    /** Chosen (or clinic-link) doctor. The summary is shared only with this doctor. */
    doctorId: z.uuid().optional(),
    language: z.enum(LANGUAGES).optional(),
  })
  .strict();
export type StartIntake = z.infer<typeof StartIntake>;

export const PostIntakeMessage = z
  .object({
    text: z.string().trim().min(1).max(2000),
    /** Set when the text is a confirmed voice transcript (links the audio clip). */
    voiceId: z.uuid().optional(),
  })
  .strict();

export const MAX_VOICE_BYTES = 2 * 1024 * 1024;
export const MAX_VOICE_MS = 60_000;

/** A transcribed voice answer awaiting the patient's confirmation (never posted automatically). */
export interface VoiceDraft {
  voiceId: string;
  transcript: string;
  confidence: number | null;
}
export type PostIntakeMessage = z.infer<typeof PostIntakeMessage>;

export const EditIntakeAnswer = z.object({ text: z.string().trim().min(1).max(2000) }).strict();
export const SetIntakeLanguage = z.object({ language: z.enum(LANGUAGES) }).strict();

export const ATTACHMENT_KINDS = ['report', 'prescription', 'medicine_strip', 'photo_of_problem', 'other'] as const;
export const MAX_UPLOAD_BYTES = 8 * 1024 * 1024;

/** What the patient's client is waiting for next. */
export type IntakeAwaiting = 'identity' | 'consent' | 'answer' | 'safety_ack' | 'ai_turn' | 'done' | 'submitted';

export interface IntakeMessageView {
  id: string;
  role: 'ai' | 'patient' | 'system';
  kind: string;
  text: string;
  quickReplies: string[];
  createdAt: string;
}

export interface IntakeAttachmentView {
  id: string;
  kind: (typeof ATTACHMENT_KINDS)[number];
  mime: string;
  label: string | null;
  url: string;
}

export interface IntakeView {
  id: string;
  profileId: string;
  templateKey: string;
  language: string;
  status: 'started' | 'paused' | 'submitted' | 'expired';
  awaiting: IntakeAwaiting;
  /** 1 Symptoms & history → 2 Medicines → 3 Reports */
  step: 1 | 2 | 3;
  /** Upload kind the current question invites, if any. */
  uploadHint: (typeof ATTACHMENT_KINDS)[number] | null;
  safetyLineShown: boolean;
  messages: IntakeMessageView[];
  attachments: IntakeAttachmentView[];
}

export interface ReviewItem {
  questionId: string;
  section: string;
  step: 1 | 2 | 3;
  question: string;
  answers: Array<{ messageId: string; text: string }>;
}

export interface IntakeReview {
  id: string;
  status: IntakeView['status'];
  items: ReviewItem[];
  attachments: IntakeAttachmentView[];
}
