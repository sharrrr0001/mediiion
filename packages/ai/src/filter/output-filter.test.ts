import { describe, expect, it } from 'vitest';
import { BUILTIN_TEMPLATES } from '../templates';
import { FIXED } from '../engine/fixed-text';
import { LANGUAGES } from '@medicos/shared';
import { checkOutput, checkTurn } from './output-filter';

/** Golden rule 6 — output filter. These tests must never be skipped. */
const BLOCKED: Array<[string, string]> = [
  ['drug_name', 'Aap Dolo kitni baar le rahe hain?'],
  ['drug_name', 'Have you used Crocin?'],
  ['drug_name', 'क्या आपने पैरासिटामोल ली?'],
  ['dosage', 'Did you have the 650 mg one?'],
  ['dosage', '5ml subah shaam'],
  ['diagnosis_word', 'The diagnosis will be done by the doctor.'],
  ['you_have', 'You have a viral infection.'],
  ['you_have', 'It sounds like a skin infection problem.'],
  ['aapko_hai', 'Aapko typhoid hai.'],
  ['aapko_hai', 'Aapko infection ho gaya.'],
  ['lagta_hai', 'Lagta hai yeh allergy hai.'],
  ['lagta_hai', 'Yeh garmi se ho sakta hai.'],
  ['lagta_hai', 'लगता है यह एलर्जी है।'],
  ['condition_name', 'Is it dengue season there?'],
  ['condition_name', 'Kya yeh daad jaisa dikhta hai?'],
  ['treatment_verb', 'Take rest and drink water.'],
  ['treatment_verb', 'Garam paani pijiye.'],
  ['treatment_verb', 'Yeh cream lagaiye.'],
  ['treatment_verb', 'Please apply ice.'],
  ['reassurance_or_urgency', "Don't worry, it is nothing serious."],
  ['reassurance_or_urgency', 'Ghabraiye mat.'],
  ['reassurance_or_urgency', 'This is urgent.'],
  ['treatment_verb', 'Could you take some rest today?'],
  ['you_have', 'I think you have an allergy.'],
  ['drug_name', 'Do you take Crocin?'],
];

const ALLOWED = [
  'Aapko kab se bukhar hai?',
  'Aapko kitne din se khansi hai?',
  'Since when have you had this?',
  'When did it start?',
  'Kya aapko kisi dawa ya khaane se allergy hai?',
  'Are you on any medicines right now?',
  'Does anything make it better or worse?',
  'Yeh sawaal main doctor sahab ke liye note kar raha hoon, woh aapko sahi jawaab denge.',
  'Temperature kitna tha, aur kab naapa?',
  'BP ya sugar ghar par naapa hai?',
  'Do you have fever or cough?',
  'Do you smoke or drink alcohol?',
  'क्या आप कोई दवा ले रहे हैं?',
];

describe('checkOutput (rule 6)', () => {
  it.each(BLOCKED)('blocks %s: %s', (rule, text) => {
    const r = checkOutput(text);
    expect(r.ok).toBe(false);
    expect(r.rules).toContain(rule);
  });

  it.each(ALLOWED)('allows neutral history question: %s', (text) => {
    expect(checkOutput(text)).toEqual({ ok: true, rules: [] });
  });

  it('checks quick replies too', () => {
    expect(checkTurn('Kab se hai?', ['1 din', 'Crocin li']).ok).toBe(false);
  });
});

describe('fallback texts are filter-clean (they are shown when the model is blocked)', () => {
  for (const t of BUILTIN_TEMPLATES) {
    for (const q of t.questions) {
      for (const lang of LANGUAGES) {
        it(`${t.key}/${q.id}/${lang}`, () => {
          expect(checkTurn(q.text[lang], q.quickReplies?.[lang] ?? [])).toEqual({ ok: true, rules: [] });
        });
      }
    }
  }

  it.each(LANGUAGES)('fixed engine texts in %s', (lang) => {
    for (const text of [FIXED.consent[lang], FIXED.redirect[lang], FIXED.closing[lang], FIXED.identity('[PATIENT]', 28)[lang]]) {
      expect(checkOutput(text), text).toEqual({ ok: true, rules: [] });
    }
  });
});
