import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { PreVisitSummary, type Language } from '@medicos/shared';
import type { FilterRule } from '../filter/output-filter';
import type { IntakeTemplate } from '../templates/schema';
import { LlmOutputError, type LlmProvider, type Usage } from '../types';
import { cleanSummary } from './validate';

export const SUMMARY_PROMPT_VERSION = 'summary-v1';
export const MAX_SUMMARY_REGENERATIONS = 2;

/** One answered interview question (de-identified). The writer may only cite these message ids. */
export interface SummaryItem {
  messageId: string;
  questionId: string;
  section: string;
  question: string;
  answer: string;
}

export interface WriteSummaryInput {
  provider: LlmProvider;
  template: IntakeTemplate;
  language: Language;
  items: SummaryItem[];
  attachments: PreVisitSummary['objectivePatientReported']['attachments'];
  safety: PreVisitSummary['safety'];
  interviewMinutes: number;
  answeredBy: 'self' | 'family';
}

export interface WriteSummaryOutput {
  summary: PreVisitSummary;
  usage: Usage[];
  regenerations: number;
  droppedUnsourced: number;
  /** Filter rules per blocked line across all attempts (FilterBlockEvent rows — ids only). */
  blocks: FilterRule[][];
}

let cached: string | null = null;
function prompt(specialty: string) {
  cached ??= readFileSync(join(__dirname, '..', '..', 'prompts', 'summary.md'), 'utf8').replace(/<!--[\s\S]*?-->\s*/, '');
  return cached.replace('{{specialty}}', specialty);
}

/**
 * Spec §6.4: one structured call on the de-identified transcript → PreVisitSummary. Then rule 7 (drop
 * unsourced lines), rule 6 + Option A (filter every line), regenerate ≤ 2, finally drop offending lines.
 * Attachments, safety and meta are set by code — the model cannot change them. Names are re-inserted
 * only at render time.
 */
export async function writeSummary(input: WriteSummaryInput): Promise<WriteSummaryOutput> {
  if (!input.items.length) throw new Error('Cannot summarise an empty interview');
  const fixed = {
    objectivePatientReported: { homeReadings: [], attachments: input.attachments, examination: 'To be done by doctor' as const },
    safety: input.safety,
    meta: {
      language: input.language,
      interviewMinutes: input.interviewMinutes,
      answeredBy: input.answeredBy,
      templateId: input.template.key,
      templateVersion: input.template.version,
      model: input.provider.model,
    },
  };
  const patientMessages = input.items.map((i) => ({ id: i.messageId, text: i.answer }));
  const chiefItem = input.items.find((i) => i.section === 'chief_complaint') ?? input.items[0]!;
  const fallbackChief = { text: chiefItem.answer.slice(0, 400), sources: [{ messageId: chiefItem.messageId, quote: chiefItem.answer.slice(0, 300) }] };
  const transcript = JSON.stringify(input.items.map((i) => ({ message_id: i.messageId, question: i.question, answer: i.answer })));

  const usage: Usage[] = [];
  const blocks: FilterRule[][] = [];
  let feedback = '';
  let last: PreVisitSummary | null = null;
  let droppedUnsourced = 0;

  for (let attempt = 0; attempt <= MAX_SUMMARY_REGENERATIONS; attempt++) {
    try {
      const res = await input.provider.json({
        system: prompt(input.template.title),
        messages: [{ role: 'user', content: `Interview items:\n${transcript}${feedback}\n\nReturn the Pre-Visit Summary JSON.` }],
        schema: PreVisitSummary,
        schemaName: 'pre_visit_summary',
        maxTokens: 3000,
        mockData: { items: input.items, base: fixed },
      });
      usage.push(res.usage);
      // Code-owned fields always win over the model's.
      const draft: PreVisitSummary = {
        ...res.data,
        objectivePatientReported: { ...fixed.objectivePatientReported, homeReadings: res.data.objectivePatientReported.homeReadings },
        safety: fixed.safety,
        meta: fixed.meta,
      };
      const clean = cleanSummary(draft, patientMessages, false, fallbackChief);
      droppedUnsourced = clean.droppedUnsourced;
      last = draft;
      if (!clean.violations.length && !clean.chiefMissing) {
        return { summary: PreVisitSummary.parse(clean.summary), usage, regenerations: attempt, droppedUnsourced, blocks };
      }
      blocks.push(...clean.violations);
      feedback = `\n\nYour previous summary broke the rules (${[...new Set(clean.violations.flat())].join(', ')}). No condition names, no advice, medicine names only in medications/allergies and only inside the patient's quote.`;
    } catch (e) {
      if (!(e instanceof LlmOutputError)) throw e;
      if (e.usage) usage.push(e.usage);
      feedback = '\n\nYour previous output was not valid JSON for the schema. Return only the JSON object.';
    }
  }

  // Safe fallback: drop every offending or unsourced line; if nothing usable came back, a minimal
  // summary built only from the patient's chief complaint.
  const base: PreVisitSummary = last ?? {
    schemaVersion: 1,
    thirtySecondSummary: [],
    subjective: { chiefComplaint: fallbackChief, historyOfPresentIllness: [], pertinentNegatives: [], pastHistory: [], medications: [], allergies: [], familySocial: [], specialtyExtras: [], patientQuestions: [] },
    historyGapsForDoctor: ['AI summary unavailable — please read the interview answers'],
    ...fixed,
  };
  const final = cleanSummary(base, patientMessages, true, fallbackChief);
  return { summary: PreVisitSummary.parse(final.summary), usage, regenerations: MAX_SUMMARY_REGENERATIONS, droppedUnsourced: final.droppedUnsourced, blocks };
}
