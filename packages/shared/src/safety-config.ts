/**
 * Rule 4 — fixed safety line. Shown by a keyword rule, NEVER written by the AI.
 * Wording to be confirmed by a lawyer. This is the single source of truth.
 */
export const SAFETY_LINE = {
  en: 'If you feel severely unwell, contact emergency services (112) or seek immediate in-person care.',
  hi: 'Agar aap bahut bimaar mehsoos kar rahe hain, turant 112 par call karein ya nazdeeki hospital jaayein.',
  combined:
    'If you feel severely unwell, contact emergency services (112) or seek immediate in-person care. / Agar aap bahut bimaar mehsoos kar rahe hain, turant 112 par call karein ya nazdeeki hospital jaayein.',
  emergencyNumber: '112',
} as const;

/** Neutral marker in the doctor's queue (not a score, no colour). */
export const SAFETY_QUEUE_MARKER = 'Safety message shown to patient';
