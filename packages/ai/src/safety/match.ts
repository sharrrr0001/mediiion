import { SAFETY_RULES } from './keywords';

/** Lowercase, unify apostrophes, strip punctuation except Devanagari marks, collapse spaces. */
export function normaliseForMatch(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[’‘`]/g, "'")
    .replace(/[^\p{L}\p{M}\p{N}'\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SafetyMatch {
  matched: boolean;
  /** Rule ids, e.g. ["chest_pain"]. Stored in SafetyEvent.matchedTerms (no free text). */
  ruleIds: string[];
}

/**
 * Golden rule 4: runs on every patient message BEFORE the LLM. Pure code, no model.
 * Optional extra patterns come from the specialty template.
 */
export function matchSafety(text: string, extraPatterns: RegExp[] = []): SafetyMatch {
  const t = normaliseForMatch(text);
  const ruleIds = SAFETY_RULES.filter((rule) => rule.patterns.some((p) => p.test(t))).map((r) => r.id);
  if (extraPatterns.some((p) => p.test(t))) ruleIds.push('template_specific');
  return { matched: ruleIds.length > 0, ruleIds };
}
