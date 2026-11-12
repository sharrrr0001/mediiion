import { describe, expect, it } from 'vitest';
import { deidentify } from './deidentify';
import { MockLlmProvider } from './providers/mock';
import { runTurn } from './engine/turn';
import { builtinTemplate } from './templates';

/** Golden rule 11 — no identifiers reach a model. These tests must never be skipped. */
const ctx = { names: ['Rahul Mehta', 'Aarav Joshi'], extra: ['MED-7K4P-29XQ'] };

describe('deidentify (rule 11)', () => {
  it('removes patient and family names, full and partial', () => {
    const out = deidentify('Main Rahul Mehta hoon, aur Rahul ka beta Aarav bhi beemar hai. mehta ji', ctx);
    expect(out).not.toMatch(/rahul|mehta|aarav/i);
    expect(out).toContain('[PATIENT]');
  });

  it('removes phone numbers in common Indian formats', () => {
    for (const p of ['9876543210', '+91 98765 43210', '+91-9876543210', '98765-43210']) {
      expect(deidentify(`call me on ${p}`, ctx)).toBe('call me on [PHONE]');
    }
  });

  it('removes emails, Medicos IDs and PIN codes', () => {
    expect(deidentify('mail rahul.m@example.com', ctx)).toBe('mail [EMAIL]');
    expect(deidentify('my id MED-7K4P-29XQ and med 9n2b 4fqh', ctx)).not.toMatch(/7K4P|9n2b/i);
    expect(deidentify('Indore 452001', ctx)).toBe('Indore [PINCODE]');
  });

  it('removes house-number addresses but keeps clinical words', () => {
    expect(deidentify('I live at flat 302, Shanti Apartments', ctx)).toContain('[ADDRESS]');
    expect(deidentify('road accident ke baad se dard', ctx)).toBe('road accident ke baad se dard');
  });

  it('keeps clinical numbers intact', () => {
    const text = 'Temperature 101 102 tha, BP 138/88, sugar 140, 2 din se';
    expect(deidentify(text, ctx)).toBe(text);
  });

  it('handles Devanagari names', () => {
    expect(deidentify('मेरा नाम राहुल है', { names: ['राहुल मेहता'] })).toBe('मेरा नाम [PATIENT] है');
  });
});

describe('engine never sends identifiers to the provider', () => {
  it('only de-identified text reaches provider.json()', async () => {
    const provider = new MockLlmProvider();
    const template = builtinTemplate('general-medicine')!;
    const transcript = [
      { role: 'ai' as const, text: deidentify('Kya main Rahul Mehta ji se baat kar raha hoon?', ctx) },
      { role: 'patient' as const, text: deidentify('haan main Rahul, mera number 9876543210 hai', ctx) },
    ];
    await runTurn({
      provider,
      template,
      language: 'hi-Latn',
      question: template.questions[0]!,
      previous: null,
      transcript,
      medicalQuestion: false,
      prompt: { specialty: 'General Medicine', doctorName: 'A. Sharma' },
    });
    const sent = JSON.stringify(provider.calls);
    expect(sent).not.toMatch(/rahul|mehta|9876543210|MED-/i);
  });
});
