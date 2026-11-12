import type { IntakeTemplate, TemplateQuestion } from '../templates/schema';

export interface PlannerProfile {
  gender: string;
  age: number | null;
}

/** Template questions that apply to this patient, in template order. */
export function applicableQuestions(template: IntakeTemplate, profile: PlannerProfile): TemplateQuestion[] {
  return template.questions.filter((q) => {
    const c = q.askIf;
    if (!c) return true;
    if (c.gender && !c.gender.includes(profile.gender as never)) return false;
    if (profile.age === null) return !(c.minAge !== undefined || c.maxAge !== undefined) || c.gender === undefined;
    if (c.minAge !== undefined && profile.age < c.minAge) return false;
    if (c.maxAge !== undefined && profile.age > c.maxAge) return false;
    return true;
  });
}

/**
 * Deterministic plan: the next unasked applicable question. Code — not the model — decides coverage,
 * so must-ask questions are always asked and the interview stays within `maxQuestions`.
 * When the budget is tight, optional questions are skipped so every must-ask still fits.
 */
export function nextQuestion(
  template: IntakeTemplate,
  profile: PlannerProfile,
  askedIds: ReadonlySet<string>,
  aiQuestionsSoFar: number,
): TemplateQuestion | null {
  if (aiQuestionsSoFar >= template.maxQuestions) return null;
  const remaining = applicableQuestions(template, profile).filter((q) => !askedIds.has(q.id));
  const mustLeft = remaining.filter((q) => q.mustAsk).length;
  const budget = template.maxQuestions - aiQuestionsSoFar;
  for (const q of remaining) {
    if (q.mustAsk || budget > mustLeft) return q;
  }
  return null;
}

export function mustAskIds(template: IntakeTemplate, profile: PlannerProfile): string[] {
  return applicableQuestions(template, profile)
    .filter((q) => q.mustAsk)
    .map((q) => q.id);
}
