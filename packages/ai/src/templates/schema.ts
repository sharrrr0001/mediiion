import { z } from 'zod';

/**
 * Specialty templates are DATA (spec §6.2): versioned JSON in the `Template` table, edited in the
 * Admin Template Studio (Phase 5). This schema validates them. Every question text must pass the
 * output filter, because it is also the safe fallback when a model reply is blocked.
 */
const Localised = z.object({ en: z.string().min(1), hi: z.string().min(1), 'hi-Latn': z.string().min(1) }).strict();
const LocalisedList = z.object({ en: z.array(z.string()), hi: z.array(z.string()), 'hi-Latn': z.array(z.string()) }).strict();

export const STEPS = [1, 2, 3] as const; // 1 Symptoms & history → 2 Medicines → 3 Reports

export const TemplateQuestion = z
  .object({
    id: z.string().regex(/^[a-z0-9_]+$/),
    section: z.enum([
      'chief_complaint',
      'hpi',
      'negatives',
      'specialty',
      'medications',
      'allergies',
      'past_history',
      'family_social',
      'home_readings',
      'uploads',
      'concern',
      'questions',
    ]),
    step: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    mustAsk: z.boolean(),
    text: Localised,
    quickReplies: LocalisedList.optional(),
    /** Only ask when the profile matches (e.g. pregnancy questions). */
    askIf: z
      .object({
        gender: z.array(z.enum(['female', 'male', 'other', 'prefer_not_to_say'])).optional(),
        minAge: z.number().int().optional(),
        maxAge: z.number().int().optional(),
      })
      .strict()
      .optional(),
    /** Invites a photo upload of this kind. */
    upload: z.enum(['report', 'prescription', 'medicine_strip', 'photo_of_problem', 'other']).optional(),
    /** Guidance for the model on what a complete answer contains (follow-up only if missing). */
    lookFor: z.string().max(200).optional(),
  })
  .strict();
export type TemplateQuestion = z.infer<typeof TemplateQuestion>;

export const IntakeTemplate = z
  .object({
    key: z.string().regex(/^[a-z-]+$/),
    specialty: z.string(),
    version: z.number().int().positive(),
    title: z.string(),
    maxQuestions: z.number().int().max(25).default(20),
    questions: z.array(TemplateQuestion).min(5),
    /** Specialty-specific extra safety patterns (regex source strings, matched on normalised text). */
    extraSafetyPatterns: z.array(z.string()).default([]),
  })
  .strict();
export type IntakeTemplate = z.infer<typeof IntakeTemplate>;
