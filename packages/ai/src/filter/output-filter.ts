import { normaliseForMatch } from '../safety/match';
import { CONDITION_NAMES, DRUG_NAMES } from './lists';

/**
 * Golden rule 6 — output filter on every AI message (and, in Phase 2, every summary line).
 * Returns rule ids only; callers log the id (FilterBlockEvent), never the text.
 */
export type FilterRule =
  | 'drug_name'
  | 'dosage'
  | 'diagnosis_word'
  | 'you_have'
  | 'aapko_hai'
  | 'lagta_hai'
  | 'condition_name'
  | 'treatment_verb'
  | 'reassurance_or_urgency';

export interface FilterResult {
  ok: boolean;
  rules: FilterRule[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const isDevanagari = (s: string) => /[ऀ-ॿ]/.test(s);
/** Whole-word for Roman script; plain substring for Devanagari (no \b support). */
const wordList = (words: string[]) =>
  words.map((w) => (isDevanagari(w) ? new RegExp(escape(w.trim()), 'u') : new RegExp(`(^|[^a-z])${escape(w.trim())}($|[^a-z])`)));

const DRUGS = wordList(DRUG_NAMES);
const CONDITIONS = wordList(CONDITION_NAMES);

const DOSAGE = /\d+(\.\d+)?\s?(mg|ml|mcg|µg|gm|iu|units?)\b/i;
const DIAGNOSIS = /(diagnos|निदान|bimari hai|बीमारी है)/;
const YOU_HAVE = /\byou (have|may have|might have|probably have|could have|are suffering)\b|\b(it|this) (is|could be|might be|may be|sounds like|looks like) (a |an )?[a-z]+ (infection|disease|problem|condition)/;
// Hindi statement "aapko X hai" — but NOT history questions ("aapko kab se bukhar hai?").
const AAPKO_HAI = /\b(aapko|apko|tumhe|tumko) ((?!kab|kitn|kya|kaise|kahan|kaun|koi|kis)\S+ ){1,4}(hai|ho gaya|ho gayi|hua hai)\b/;
const AAPKO_HAI_DEVA = /(आपको|तुम्हें) (?!.*(कब|कितन|क्या|कैसे|कहाँ|कौन|कोई)).{1,30} (है|हो गया|हुआ है)/u;
const LAGTA_HAI = /\b(lagta hai|lag raha hai|ho sakta hai|shayad aapko)\b|(लगता है|लग रहा है|हो सकता है)/u;
const TREATMENT =
  /\b(take|taking|apply|applying|drink|consume|rub|massage|avoid|use this|start taking|stop taking|keep taking)\b|\b(lijiye|lijie|lein|le lijiye|lagaiye|lagayein|lagao|khaiye|khayein|khao|pijiye|piyein|piyo|band kar dijiye|chalu kijiye)\b|(लीजिए|लें|लगाइए|लगाएं|खाइए|पीजिए|पिएं)/u;
const REASSURANCE =
  /\b(don'?t worry|nothing serious|not serious|it'?s normal|that'?s normal|serious|urgent|emergency|dangerous|you will be fine|ghabraiye mat|chinta mat|kuch nahi hai|normal hai|serious hai|khatarnak)\b|(घबराइए मत|चिंता मत|कुछ नहीं है|गंभीर)/u;

/** Questions that ask about the patient's own history/habits, e.g. "Do you…", "Are you…", "Kya aap…". */
const HISTORY_QUESTION_START =
  /^(do|does|did|have|has|had|are|is|was|were|how|when|since|what|which|where|along with this|kya|kab|kitn|kaise|kahan|kis)\b|^(क्या|कब|कितन|कैसे|कहाँ|किस)/u;

export function checkOutput(text: string): FilterResult {
  const raw = text.normalize('NFC');
  const t = normaliseForMatch(raw);
  const rules = new Set<FilterRule>();
  if (DRUGS.some((p) => p.test(t))) rules.add('drug_name');
  if (DOSAGE.test(raw)) rules.add('dosage');
  if (DIAGNOSIS.test(t)) rules.add('diagnosis_word');
  // Sentence-level rules: a history question about the patient ("Do you have fever?", "Do you drink
  // alcohol?", "Aapko kab se bukhar hai?") is allowed; statements and advice are not.
  for (const sentence of raw.split(/(?<=[.!?।])\s+/)) {
    const s = normaliseForMatch(sentence);
    const historyQuestion = sentence.trim().endsWith('?') && HISTORY_QUESTION_START.test(s);
    if (!sentence.trim().endsWith('?') && (AAPKO_HAI.test(s) || AAPKO_HAI_DEVA.test(s))) rules.add('aapko_hai');
    if (!historyQuestion && YOU_HAVE.test(s)) rules.add('you_have');
    if (!historyQuestion && TREATMENT.test(s)) rules.add('treatment_verb');
  }
  if (LAGTA_HAI.test(t)) rules.add('lagta_hai');
  if (CONDITIONS.some((p) => p.test(t))) rules.add('condition_name');
  if (REASSURANCE.test(t)) rules.add('reassurance_or_urgency');
  return { ok: rules.size === 0, rules: [...rules] };
}

/** Medicine names (from the list) present in `text` — used by the summary's Option A check. */
export function findDrugNames(text: string): string[] {
  const t = normaliseForMatch(text);
  return DRUG_NAMES.filter((_, i) => DRUGS[i]!.test(t)).map((d) => d.trim().toLowerCase());
}

/** Dose expressions ("650 mg", "5ml") present in `text`, normalised without spaces. */
export function findDosages(text: string): string[] {
  return [...text.matchAll(new RegExp(DOSAGE.source, 'gi'))].map((m) => m[0].replace(/\s+/g, '').toLowerCase());
}

/** Check a whole intake turn: the message and every quick reply. */
export function checkTurn(message: string, quickReplies: string[]): FilterResult {
  const results = [message, ...quickReplies].map(checkOutput);
  const rules = [...new Set(results.flatMap((r) => r.rules))];
  return { ok: rules.length === 0, rules };
}
