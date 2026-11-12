import { describe, expect, it } from 'vitest';
import type { PreVisitSummary } from '@medicos/shared';
import { MockLlmProvider } from '../providers/mock';
import { builtinTemplate } from '../templates';
import { checkSummaryLine, cleanSummary } from './validate';
import { writeSummary, type SummaryItem } from './writer';

/** Rules 5, 6 (+ Option A) and 7 on the Pre-Visit Summary. These tests must never be skipped. */
const items: SummaryItem[] = [
  { messageId: 'm1', questionId: 'chief_complaint', section: 'chief_complaint', question: 'Main problem?', answer: 'bukhar hai 2 din se' },
  { messageId: 'm2', questionId: 'onset', section: 'hpi', question: 'Since when?', answer: '2 din, raat ko 101 tak' },
  { messageId: 'm3', questionId: 'current_medicines', section: 'medications', question: 'Medicines?', answer: 'Dolo 650 mg subah shaam le raha hoon' },
  { messageId: 'm4', questionId: 'allergies', section: 'allergies', question: 'Allergies?', answer: 'Nahi' },
];
const base = {
  provider: new MockLlmProvider(),
  template: builtinTemplate('general-medicine')!,
  language: 'hi-Latn' as const,
  items,
  attachments: [],
  safety: { safetyLineShown: false },
  interviewMinutes: 6,
  answeredBy: 'self' as const,
};
const line = (text: string, messageId: string, quote: string) => ({ text, sources: [{ messageId, quote }] });
const modelSummary = (over: Partial<PreVisitSummary['subjective']> = {}): string =>
  JSON.stringify({
    schemaVersion: 1,
    thirtySecondSummary: [line('Fever for 2 days', 'm1', 'bukhar hai 2 din se')],
    subjective: {
      chiefComplaint: line('Fever for 2 days', 'm1', 'bukhar hai 2 din se'),
      historyOfPresentIllness: [],
      pertinentNegatives: [],
      pastHistory: [],
      medications: [],
      allergies: [],
      familySocial: [],
      specialtyExtras: [],
      patientQuestions: [],
      ...over,
    },
    objectivePatientReported: { homeReadings: [], attachments: [], examination: 'To be done by doctor' },
    historyGapsForDoctor: [],
    safety: { safetyLineShown: false },
    meta: { language: 'x', interviewMinutes: 0, answeredBy: 'self', templateId: 'x', templateVersion: 1, model: 'x' },
  });

describe('writeSummary (mock provider)', () => {
  it('produces a valid, fully sourced summary with code-owned fields', async () => {
    const out = await writeSummary(base);
    expect(out.summary.subjective.chiefComplaint.text).toBe('bukhar hai 2 din se');
    expect(out.summary.objectivePatientReported.examination).toBe('To be done by doctor');
    expect(out.summary.meta.templateId).toBe('general-medicine');
    expect(out.blocks).toEqual([]);
    const ids = new Set(items.map((i) => i.messageId));
    const all = JSON.stringify(out.summary);
    for (const m of all.matchAll(/"messageId":"([^"]+)"/g)) expect(ids.has(m[1]!)).toBe(true);
  });
});

describe('rule 7 — every line cites the patient', () => {
  it('drops lines citing a message that does not exist or a quote the patient never said', async () => {
    const bad = modelSummary({
      historyOfPresentIllness: [line('Temperature 101 at night', 'm2', '101 tak'), line('Vomiting since yesterday', 'mX', 'ulti'), line('Has rash', 'm2', 'daane hain')],
    });
    const out = await writeSummary({ ...base, provider: new MockLlmProvider([bad]) });
    expect(out.summary.subjective.historyOfPresentIllness.map((l) => l.text)).toEqual(['Temperature 101 at night']);
    expect(out.droppedUnsourced).toBe(2);
  });

  it('falls back to the patient’s own chief complaint if the model’s is unsourced', async () => {
    const bad = modelSummary({ chiefComplaint: line('Chest pain', 'm9', 'seene mein dard') });
    const out = await writeSummary({ ...base, provider: new MockLlmProvider([bad, bad, bad]) });
    expect(out.summary.subjective.chiefComplaint.sources[0]!.messageId).toBe('m1');
  });
});

describe('rule 6 + Option A — medicine names only in medications/allergies, only if quoted', () => {
  it('allows a medicine name and dose in medications when the patient said them', () => {
    expect(checkSummaryLine(line('Dolo 650 mg twice daily — patient-reported', 'm3', 'Dolo 650 mg subah shaam'), 'medications')).toEqual([]);
  });

  it('blocks a medicine name in medications that is not in the quote', () => {
    expect(checkSummaryLine(line('Crocin 500 mg — patient-reported', 'm3', 'Dolo 650 mg subah shaam'), 'medications')).toEqual(
      expect.arrayContaining(['drug_name', 'dosage']),
    );
  });

  it('blocks medicine names in every other section even when quoted', () => {
    expect(checkSummaryLine(line('Took Dolo for fever', 'm3', 'Dolo 650 mg'), 'historyOfPresentIllness')).toContain('drug_name');
    expect(checkSummaryLine(line('Dolo 650 mg', 'm3', 'Dolo 650 mg'), 'thirtySecondSummary')).toContain('drug_name');
  });

  it('never allows diagnosis or advice, in any section', () => {
    expect(checkSummaryLine(line('Likely viral fever', 'm1', 'bukhar'), 'historyOfPresentIllness')).toContain('condition_name');
    expect(checkSummaryLine(line('Dolo 650 mg — take rest', 'm3', 'Dolo 650 mg'), 'medications')).toContain('treatment_verb');
  });

  it('regenerates on a violation, then drops the offending line', async () => {
    const bad = modelSummary({ historyOfPresentIllness: [line('Probably typhoid, 101 at night', 'm2', '101 tak')] });
    const out = await writeSummary({ ...base, provider: new MockLlmProvider([bad, bad, bad]) });
    expect(out.blocks.length).toBeGreaterThan(0);
    expect(JSON.stringify(out.summary)).not.toMatch(/typhoid/i);
  });
});

describe('rule 5 — no Assessment/Plan can enter the summary', () => {
  it('rejects model output with an assessment key (treated as invalid output)', async () => {
    const withA = JSON.stringify({ ...JSON.parse(modelSummary()), assessment: 'Viral fever' });
    const out = await writeSummary({ ...base, provider: new MockLlmProvider([withA, withA, withA]) });
    expect(JSON.stringify(out.summary)).not.toMatch(/assessment|viral/i);
  });

  it('cleanSummary keeps the fixed examination text', () => {
    const s = JSON.parse(modelSummary()) as PreVisitSummary;
    expect(cleanSummary(s, items.map((i) => ({ id: i.messageId, text: i.answer })), true).summary.objectivePatientReported.examination).toBe('To be done by doctor');
  });
});
