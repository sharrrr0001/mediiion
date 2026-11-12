import { describe, expect, it } from 'vitest';
import { matchSafety } from './match';

/** Golden rule 4 — safety keyword rule. These tests must never be skipped. */
const SHOULD_TRIGGER: Array<[string, string]> = [
  ['chest_pain', 'I get chest pain when I walk fast'],
  ['chest_pain', 'chalne par seene mein dard hota hai'],
  ['chest_pain', 'सीने में दर्द हो रहा है'],
  ['chest_pain', 'Chhati me dard hai kal se'],
  ['breathing', 'saans nahi aa rahi'],
  ['breathing', "I can't breathe properly"],
  ['breathing', 'साँस लेने में तकलीफ है'],
  ['breathing', 'Saans lene mein dikkat ho rahi hai'],
  ['stroke_signs', 'papa ka muh tedha ho gaya aur bolne mein dikkat'],
  ['stroke_signs', 'sudden weakness in left arm'],
  ['stroke_signs', 'लकवा जैसा लग रहा है'],
  ['heavy_bleeding', 'bahut khoon aa raha hai'],
  ['heavy_bleeding', 'he is vomiting blood'],
  ['heavy_bleeding', 'खून की उल्टी हुई'],
  ['fainting', 'I fainted in the bathroom'],
  ['fainting', 'mummy behosh ho gayi thi'],
  ['fainting', 'बेहोश हो गए थे'],
  ['suicidal_thoughts', 'I want to die'],
  ['suicidal_thoughts', 'kabhi kabhi khudkushi ka khayal aata hai'],
  ['suicidal_thoughts', 'आत्महत्या के विचार आते हैं'],
  ['suicidal_thoughts', 'mann karta hai mar jaana chahta hoon'],
  ['severe_allergic_reaction', 'my lips are swollen and throat is swelling'],
  ['severe_allergic_reaction', 'gala sooj gaya hai'],
  ['pregnancy_bleeding', 'I am pregnant and there is bleeding'],
  ['pregnancy_bleeding', 'pregnancy mein khoon aa raha hai'],
  ['child_not_responding', 'baby is not responding'],
  ['child_not_responding', 'baccha jawab nahi de raha'],
  ['child_not_responding', 'bachche ko daura pad gaya'],
];

const SHOULD_NOT_TRIGGER = [
  'bukhar hai 2 din se, 101 tak gaya',
  'gale mein kharash hai, khansi nahi',
  'burning in chest after meals for 2 weeks', // seed case: heartburn wording, not "chest pain"
  'knee pain for 3 months',
  'itchy red rash on both forearms',
  'सिर में दर्द है',
  'mujhe sugar ki dawa chal rahi hai',
  'pet mein dard hai khane ke baad',
  'Thoda chakkar aata hai subah',
];

describe('matchSafety (rule 4)', () => {
  it.each(SHOULD_TRIGGER)('triggers %s for: %s', (rule, text) => {
    const m = matchSafety(text);
    expect(m.matched).toBe(true);
    expect(m.ruleIds).toContain(rule);
  });

  it.each(SHOULD_NOT_TRIGGER)('does not trigger for: %s', (text) => {
    expect(matchSafety(text)).toEqual({ matched: false, ruleIds: [] });
  });

  it('is case- and punctuation-insensitive', () => {
    expect(matchSafety('CHEST PAIN!!!').matched).toBe(true);
    expect(matchSafety('chest   pain…').matched).toBe(true);
  });

  it('shows the line even for negated mentions (safety-first bias)', () => {
    expect(matchSafety('no chest pain').matched).toBe(true);
  });

  it('supports template-specific extra patterns', () => {
    expect(matchSafety('very high fever in newborn', [/newborn/]).ruleIds).toContain('template_specific');
  });
});
