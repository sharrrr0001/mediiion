import type { PreVisitSummary, SummaryLine } from '@medicos/shared';
import type { SummaryItem } from './writer';

/**
 * Deterministic summary for tests, CI and offline dev: each answer becomes one sourced line in the
 * section its template question belongs to. It quotes the patient verbatim, so it is always sourced.
 */
const SKIP = /^(nahi|nahin|no|none|koi nahi|pata nahi|don'?t know|skip|skip karein|nahi naapa|not checked|koi report nahi|no reports|aur kuch nahi|nothing else|नहीं|कोई नहीं|पता नहीं)\.?$/i;

export function buildMockSummary(items: SummaryItem[], base: Pick<PreVisitSummary, 'objectivePatientReported' | 'safety' | 'meta'>): PreVisitSummary {
  const line = (it: SummaryItem): SummaryLine => ({
    text: it.answer.slice(0, 400),
    sources: [{ messageId: it.messageId, quote: it.answer.slice(0, 300) }],
  });
  const pick = (section: string) => items.filter((i) => i.section === section && !SKIP.test(i.answer.trim()));
  const negatives = items.filter((i) => (i.section === 'negatives' || i.questionId === 'allergies') && SKIP.test(i.answer.trim()));
  const chief = items.find((i) => i.section === 'chief_complaint') ?? items[0];
  if (!chief) throw new Error('mock summary needs at least one answer');

  const hpi = pick('hpi').map(line);
  return {
    schemaVersion: 1,
    thirtySecondSummary: [line(chief), ...hpi].slice(0, 4),
    subjective: {
      chiefComplaint: line(chief),
      historyOfPresentIllness: hpi,
      pertinentNegatives: [...pick('negatives'), ...negatives].map((i) => ({ text: `${i.question} — ${i.answer}`.slice(0, 400), sources: [{ messageId: i.messageId, quote: i.answer.slice(0, 300) }] })),
      pastHistory: pick('past_history').map(line),
      medications: pick('medications').map(line),
      allergies: pick('allergies').map(line),
      familySocial: pick('family_social').map(line),
      specialtyExtras: pick('specialty').map(line),
      ...(pick('concern')[0] ? { patientConcern: line(pick('concern')[0]!) } : {}),
      patientQuestions: pick('questions').map(line),
    },
    objectivePatientReported: { ...base.objectivePatientReported, homeReadings: pick('home_readings').map(line) },
    historyGapsForDoctor: [],
    safety: base.safety,
    meta: base.meta,
  };
}
