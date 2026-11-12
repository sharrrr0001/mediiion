/**
 * Golden rule 11 — strip identifiers before ANY AI call.
 * Known identifiers (patient + family names, Medicos IDs) are replaced exactly; generic patterns catch
 * phone numbers, emails, Medicos IDs, PIN codes and address-like phrases. Real names are re-inserted
 * only at render time, never sent to a provider.
 */
export interface DeidContext {
  /** Full names of the patient and family profiles on this account. */
  names: string[];
  /** Any other exact strings to remove (e.g. Medicos IDs, the account phone). */
  extra?: string[];
}

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PATTERNS: Array<[RegExp, string]> = [
  [/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL]'],
  [/\bMED[\s-]?[0-9A-Z]{4}[\s-]?[0-9A-Z]{4}\b/gi, '[MEDICOS_ID]'],
  [/(\+?91[\s-]?)?\b[6-9]\d{4}[\s-]?\d{5}\b/g, '[PHONE]'],
  [/\b[1-8]\d{5}\b/g, '[PINCODE]'],
  // Address-like only when a house/plot number follows, so "road accident" is untouched.
  [/\b(house|flat|h\.?\s?no|plot|block|sector|gali|street|lane|ward)\b\s*(no\.?|number|#)?\s*\d+[^,.\n]{0,30}/gi, '[ADDRESS]'],
];

export function deidentify(text: string, ctx: DeidContext): string {
  // Generic patterns first, so an email like "rahul.m@x.com" is removed whole before name matching.
  let out = text;
  for (const [re, token] of PATTERNS) out = out.replace(re, token);
  const exact = [...ctx.names, ...(ctx.extra ?? [])].filter((s) => s && s.trim().length >= 2);
  // Full names first, then each name part of 3+ letters ("Rahul", "Mehta").
  const parts = new Set<string>();
  for (const n of exact) {
    parts.add(n.trim());
    for (const p of n.split(/\s+/)) if (p.replace(/\./g, '').length >= 3) parts.add(p.replace(/\.$/, ''));
  }
  const ordered = [...parts].sort((a, b) => b.length - a.length);
  for (const p of ordered) {
    const isDeva = /[ऀ-ॿ]/.test(p);
    const re = isDeva ? new RegExp(escape(p), 'gu') : new RegExp(`\\b${escape(p)}\\b`, 'gi');
    out = out.replace(re, '[PATIENT]');
  }
  return out;
}
