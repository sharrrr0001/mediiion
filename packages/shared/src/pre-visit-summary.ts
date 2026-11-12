import { z } from 'zod';

/**
 * Spec §6.4 — single source of truth for the Pre-Visit Summary.
 * Rule 5: there is intentionally NO assessment, diagnosis, plan, differential or advice field.
 * Every object is `.strict()` so unknown keys (e.g. "assessment") are rejected, not silently stripped.
 */
export const SourceRef = z
  .object({ messageId: z.string().min(1), quote: z.string().min(1).max(300) })
  .strict();
export const Line = z.object({ text: z.string().min(1).max(400), sources: z.array(SourceRef).min(1) }).strict();

export const AttachmentKind = z.enum(['report', 'prescription', 'medicine_strip', 'photo_of_problem', 'other']);

export const PreVisitSummary = z
  .object({
    schemaVersion: z.literal(1),
    thirtySecondSummary: z.array(Line).max(5),
    subjective: z
      .object({
        chiefComplaint: Line,
        historyOfPresentIllness: z.array(Line),
        pertinentNegatives: z.array(Line),
        pastHistory: z.array(Line),
        medications: z.array(Line),
        allergies: z.array(Line),
        familySocial: z.array(Line),
        specialtyExtras: z.array(Line),
        patientConcern: Line.optional(),
        patientQuestions: z.array(Line),
      })
      .strict(),
    objectivePatientReported: z
      .object({
        homeReadings: z.array(Line),
        attachments: z.array(
          z
            .object({
              fileId: z.string(),
              kind: AttachmentKind,
              date: z.string().optional(),
              label: z.string(),
            })
            .strict(),
        ),
        examination: z.literal('To be done by doctor'),
      })
      .strict(),
    historyGapsForDoctor: z.array(z.string().max(200)),
    safety: z.object({ safetyLineShown: z.boolean(), shownAt: z.string().optional() }).strict(),
    meta: z
      .object({
        language: z.string(),
        interviewMinutes: z.number(),
        answeredBy: z.enum(['self', 'family']),
        templateId: z.string(),
        templateVersion: z.number(),
        model: z.string(),
      })
      .strict(),
  })
  .strict();

export type PreVisitSummary = z.infer<typeof PreVisitSummary>;
export type SummaryLine = z.infer<typeof Line>;
export type SummarySourceRef = z.infer<typeof SourceRef>;
