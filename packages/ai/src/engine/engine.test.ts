import { describe, expect, it } from 'vitest';
import { MockLlmProvider } from '../providers/mock';
import { builtinTemplate } from '../templates';
import { detectLanguage, isMedicalQuestion } from './fixed-text';
import { mustAskIds, nextQuestion } from './planner';
import { buildMessages } from './prompt';
import { runTurn, MAX_REGENERATIONS } from './turn';

const gm = builtinTemplate('general-medicine')!;
const adultMale = { gender: 'male', age: 28 };
const turnJson = (message: string, id = 'chief_complaint') =>
  JSON.stringify({ message, section: 'chief_complaint', done: false, quick_replies: [], question_id: id });

const baseInput = (provider: MockLlmProvider) => ({
  provider,
  template: gm,
  language: 'hi-Latn' as const,
  question: gm.questions[0]!,
  previous: null,
  transcript: [],
  medicalQuestion: false,
  prompt: { specialty: 'General Medicine' },
});

describe('planner', () => {
  it('asks every must-ask question within maxQuestions', () => {
    const asked = new Set<string>();
    let n = 0;
    for (let q = nextQuestion(gm, adultMale, asked, n); q; q = nextQuestion(gm, adultMale, asked, n)) {
      asked.add(q.id);
      n += 1;
    }
    expect(n).toBeLessThanOrEqual(gm.maxQuestions);
    for (const id of mustAskIds(gm, adultMale)) expect(asked.has(id)).toBe(true);
  });

  it('asks pregnancy questions only for women of child-bearing age', () => {
    const ids = (p: { gender: string; age: number | null }) => {
      const asked = new Set<string>();
      let n = 0;
      for (let q = nextQuestion(gm, p, asked, n); q; q = nextQuestion(gm, p, asked, n)) {
        asked.add(q.id);
        n += 1;
      }
      return asked;
    };
    expect(ids({ gender: 'female', age: 30 }).has('pregnancy_status')).toBe(true);
    expect(ids({ gender: 'female', age: 62 }).has('pregnancy_status')).toBe(false);
    expect(ids(adultMale).has('pregnancy_status')).toBe(false);
  });

  it('skips optional questions when the budget is tight but keeps must-asks', () => {
    const tight = { ...gm, maxQuestions: mustAskIds(gm, adultMale).length };
    const asked = new Set<string>();
    let n = 0;
    for (let q = nextQuestion(tight, adultMale, asked, n); q; q = nextQuestion(tight, adultMale, asked, n)) {
      expect(q.mustAsk).toBe(true);
      asked.add(q.id);
      n += 1;
    }
    expect(asked.size).toBe(tight.maxQuestions);
  });
});

describe('runTurn with output filter (rule 6)', () => {
  it('passes a clean model reply through', async () => {
    const out = await runTurn(baseInput(new MockLlmProvider()));
    expect(out.usedFallback).toBe(false);
    expect(out.message).toBe(gm.questions[0]!.text['hi-Latn']);
  });

  it('regenerates after a blocked reply', async () => {
    const provider = new MockLlmProvider([turnJson('Aapko typhoid hai. Dolo lijiye.')]);
    const out = await runTurn(baseInput(provider));
    expect(out.blocks).toHaveLength(1);
    expect(out.blocks[0]).toEqual(expect.arrayContaining(['aapko_hai', 'drug_name', 'treatment_verb']));
    expect(out.usedFallback).toBe(false);
    // The retry told the model why, without echoing the blocked text.
    const retryMsg = JSON.stringify(provider.calls[1]!.messages);
    expect(retryMsg).toContain('rejected by the safety filter');
    expect(retryMsg).not.toContain('typhoid');
  });

  it(`falls back to the template question after ${MAX_REGENERATIONS} failed regenerations`, async () => {
    const bad = turnJson('You have an infection, take rest.');
    const provider = new MockLlmProvider([bad, bad, bad]);
    const out = await runTurn(baseInput(provider));
    expect(provider.calls).toHaveLength(MAX_REGENERATIONS + 1);
    expect(out.usedFallback).toBe(true);
    expect(out.message).toBe(gm.questions[0]!.text['hi-Latn']);
  });

  it('treats invalid JSON like a failed attempt', async () => {
    const out = await runTurn(baseInput(new MockLlmProvider(['not json', '{"message": 1}'])));
    expect(out.invalidOutputs).toBe(2);
    expect(out.usedFallback).toBe(false);
  });

  it('does not let the model pick an unplanned question', async () => {
    const out = await runTurn(baseInput(new MockLlmProvider([turnJson('Kab se hai?', 'allergies')])));
    expect(out.questionId).toBe('chief_complaint');
  });
});

describe('prompt building', () => {
  it('starts with a user turn and ends with the [ENGINE] plan', () => {
    const msgs = buildMessages([{ role: 'ai', text: 'Namaste' }, { role: 'system', text: 'SAFETY' }], {
      question: gm.questions[0]!,
      previous: null,
      language: 'en',
      medicalQuestion: true,
    });
    expect(msgs[0]!.role).toBe('user');
    expect(msgs.at(-1)!.content).toContain('[ENGINE]');
    expect(msgs.at(-1)!.content).toContain('medical question');
    expect(JSON.stringify(msgs)).not.toContain('SAFETY');
  });
});

describe('language + medical-question detection', () => {
  it.each([
    ['मुझे बुखार है', 'hi'],
    ['mujhe bukhar hai 2 din se', 'hi-Latn'],
    ['I have had a fever for two days', 'en'],
  ] as const)('%s → %s', (text, lang) => {
    expect(detectLanguage(text, 'en')).toBe(lang);
  });

  it.each(['mujhe kya hua hai?', 'Which medicine should I take?', 'kaunsi dawa lu', 'मुझे क्या हुआ है'])('detects: %s', (t) => {
    expect(isMedicalQuestion(t)).toBe(true);
  });

  it('does not flag ordinary answers', () => {
    expect(isMedicalQuestion('2 din se bukhar hai')).toBe(false);
  });
});
