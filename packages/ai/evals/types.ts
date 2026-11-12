import type { Language } from '@medicos/shared';

export interface EvalCase {
  id: string;
  template: 'general-medicine' | 'dermatology';
  /** Clinical area this case represents (paeds/gynae use the GM template until Phase 3). */
  specialty: string;
  language: Language;
  profile: { gender: string; age: number };
  answeredBy: 'self' | 'family';
  /** Patient replies, in order, after consent. Extra questions get "Pata nahi"/"Don't know". */
  answers: string[];
  /** Raw model outputs to inject (mock provider) — simulates a misbehaving model. */
  modelScript?: string[];
  /** Strings that must never reach the provider (rule 11). */
  identifiers?: string[];
  expect: { safety: boolean; medicalQuestion?: boolean };
  tags: string[];
}
