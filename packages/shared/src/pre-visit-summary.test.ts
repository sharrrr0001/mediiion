import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { PreVisitSummary } from './pre-visit-summary';

/**
 * Golden rule 5 — the AI writes only into a schema that has NO Assessment or Plan fields.
 * These tests must never be skipped.
 */
const line = (text: string) => ({ text, sources: [{ messageId: 'm1', quote: text }] });

const valid = (): Record<string, unknown> => ({
  schemaVersion: 1,
  thirtySecondSummary: [line('Fever for 2 days, max 101°F')],
  subjective: {
    chiefComplaint: line('bukhar hai 2 din se'),
    historyOfPresentIllness: [],
    pertinentNegatives: [line('no cough')],
    pastHistory: [],
    medications: [],
    allergies: [],
    familySocial: [],
    specialtyExtras: [],
    patientQuestions: [],
  },
  objectivePatientReported: { homeReadings: [], attachments: [], examination: 'To be done by doctor' },
  historyGapsForDoctor: [],
  safety: { safetyLineShown: false },
  meta: {
    language: 'hi-Latn',
    interviewMinutes: 6,
    answeredBy: 'self',
    templateId: 'general-medicine',
    templateVersion: 1,
    model: 'mock',
  },
});

const FORBIDDEN = /assess|diagnos|plan|differential|advice|treatment|prescri|urgency|triage|severity_score/i;

function collectKeys(schema: z.ZodType, path = ''): string[] {
  const json = z.toJSONSchema(schema) as Record<string, unknown>;
  const keys: string[] = [];
  const walk = (node: unknown, p: string) => {
    if (!node || typeof node !== 'object') return;
    const obj = node as Record<string, unknown>;
    if (obj.properties && typeof obj.properties === 'object') {
      for (const [k, v] of Object.entries(obj.properties as Record<string, unknown>)) {
        keys.push(`${p}${k}`);
        walk(v, `${p}${k}.`);
      }
    }
    for (const child of ['items', 'anyOf', 'oneOf', 'allOf']) {
      const c = obj[child];
      if (Array.isArray(c)) c.forEach((x) => walk(x, p));
      else if (c) walk(c, p);
    }
  };
  walk(json, path);
  return keys;
}

describe('PreVisitSummary schema (rule 5)', () => {
  it('accepts a valid summary', () => {
    expect(PreVisitSummary.safeParse(valid()).success).toBe(true);
  });

  it('has no assessment / diagnosis / plan / advice field anywhere', () => {
    const keys = collectKeys(PreVisitSummary);
    expect(keys.length).toBeGreaterThan(20);
    expect(keys.filter((k) => FORBIDDEN.test(k.split('.').pop() ?? ''))).toEqual([]);
  });

  it.each(['assessment', 'plan', 'diagnosis', 'differential', 'advice'])(
    'rejects an extra top-level "%s" key instead of silently stripping it',
    (key) => {
      expect(PreVisitSummary.safeParse({ ...valid(), [key]: 'anything' }).success).toBe(false);
    },
  );

  it('rejects an extra "assessment" key nested inside subjective', () => {
    const s = valid();
    s.subjective = { ...(s.subjective as object), assessment: line('x') };
    expect(PreVisitSummary.safeParse(s).success).toBe(false);
  });

  it('rejects lines without a source (rule 7)', () => {
    const s = valid();
    s.thirtySecondSummary = [{ text: 'unsourced', sources: [] }];
    expect(PreVisitSummary.safeParse(s).success).toBe(false);
  });

  it('only allows "To be done by doctor" for examination', () => {
    const s = valid();
    s.objectivePatientReported = { homeReadings: [], attachments: [], examination: 'Normal' };
    expect(PreVisitSummary.safeParse(s).success).toBe(false);
  });
});
