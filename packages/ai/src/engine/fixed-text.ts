import { CONDITION_NAMES } from '../filter/lists';
import type { Language } from '@medicos/shared';

/**
 * Fixed, code-written messages (no model). Identity and consent steps, the medical-question redirect
 * (spec §2 / §6.3), and the closing line. All pass the output filter (tested).
 */
type L = Record<Language, string>;

export const FIXED = {
  identity: (name: string, age: number | null): L => ({
    en: `Namaste! Before your visit, I'll ask a few short questions for your doctor. Am I speaking with ${name}${age !== null ? ` (age ${age})` : ''}?`,
    hi: `नमस्ते! मुलाक़ात से पहले मैं आपके डॉक्टर के लिए कुछ छोटे सवाल पूछूँगा। क्या मैं ${name} जी से बात कर रहा हूँ${age !== null ? ` (उम्र ${age})` : ''}?`,
    'hi-Latn': `Namaste! Visit se pehle main aapke doctor ke liye kuch chhote sawaal poochunga. Kya main ${name} ji se baat kar raha hoon${age !== null ? ` (umar ${age})` : ''}?`,
  }),
  identityReplies: {
    en: ['Yes, it’s me', 'I’m answering for them'],
    hi: ['हाँ, मैं ही हूँ', 'मैं उनकी ओर से बता रहा/रही हूँ'],
    'hi-Latn': ['Haan, main hi hoon', 'Main unki taraf se bata raha/rahi hoon'],
  },
  consent: {
    en: 'Your answers will be shared only with the doctor you choose. This does not replace the doctor’s check-up. Shall we start?',
    hi: 'आपके जवाब सिर्फ़ आपके चुने हुए डॉक्टर को दिखेंगे। यह डॉक्टर की जाँच की जगह नहीं है। शुरू करें?',
    'hi-Latn': 'Aapke jawaab sirf aapke chune hue doctor ko dikhenge. Yeh doctor ki jaanch ki jagah nahi hai. Shuru karein?',
  } satisfies L,
  consentReplies: { en: ['Yes, start'], hi: ['हाँ, शुरू करें'], 'hi-Latn': ['Haan, shuru karein'] },
  redirect: {
    en: 'That’s a good question for the doctor. I’m noting it down for them.',
    hi: 'यह सवाल मैं डॉक्टर साहब के लिए नोट कर रहा हूँ, वे आपको सही जवाब देंगे।',
    'hi-Latn': 'Yeh sawaal main doctor sahab ke liye note kar raha hoon, woh aapko sahi jawaab denge.',
  } satisfies L,
  closing: {
    en: 'Thank you! That’s everything. Next, please check “What you told us” and confirm it.',
    hi: 'धन्यवाद! बस इतना ही। अब “आपने हमें क्या बताया” एक बार देखकर पक्का करें।',
    'hi-Latn': 'Shukriya! Bas itna hi. Ab “What you told us” ek baar dekh kar confirm karein.',
  } satisfies L,
} as const;

/** Patient asks what they have / what to do. Matched in code so every provider behaves the same. */
const MEDICAL_QUESTION = [
  /what (do|did) i have|what is (wrong|this)|is (it|this) serious|which (medicine|tablet)|what should i (take|do|apply)|can i (take|eat|apply)/i,
  /(mujhe|muje) (kya|kia) (hua|hai)|kya (bimari|problem) hai|kaun ?si (dawa|dawai|tablet|goli)|kya (lu|loon|lun|khau|khaun|lagau|lagaun)|serious (toh|to)? ?nahi|theek ho jaunga|kitne din mein theek/i,
  /(मुझे क्या हुआ|कौन सी दवा|क्या लूँ|क्या खाऊँ|गंभीर तो नहीं|ठीक हो जाऊँगा)/u,
];

const WHICH_X_SHOULD_I = /\b(kaun ?si|kaun ?sa|konsi|konsa) \S+ (lu|loon|lun|lagau|lagaun|khau|khaun|piyu|use karu)\b/i;
const CONDITION_WORDS = CONDITION_NAMES.map((c) => c.trim().toLowerCase()).filter((c) => c.length >= 3);

export function isMedicalQuestion(text: string): boolean {
  if (MEDICAL_QUESTION.some((re) => re.test(text)) || WHICH_X_SHOULD_I.test(text)) return true;
  // "Is this ringworm?" / "kya yeh daad hai?" — a question naming a condition.
  const lower = text.toLowerCase();
  return lower.includes('?') && CONDITION_WORDS.some((c) => lower.includes(c));
}

/** Detect language from the first free-text reply (spec §6.1). */
export function detectLanguage(text: string, fallback: Language): Language {
  if (/[ऀ-ॿ]/.test(text)) return 'hi';
  const hinglish = /\b(hai|hain|nahi|nahin|mujhe|mera|meri|haan|ji|se|ka|ki|ko|bahut|dard|bukhar|kal|aaj|din|raha|rahi)\b/i;
  if (hinglish.test(text)) return 'hi-Latn';
  if (/^[ -~\s]+$/.test(text) && text.trim().split(/\s+/).length >= 2) return 'en';
  return fallback;
}
