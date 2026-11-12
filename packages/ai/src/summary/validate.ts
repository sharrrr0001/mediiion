import type { PreVisitSummary, SummaryLine } from '@medicos/shared';
import { checkOutput, findDosages, findDrugNames, type FilterRule } from '../filter/output-filter';
import { normaliseForMatch } from '../safety/match';

/** A patient message the summary may cite (already de-identified). */
export interface CitableMessage {
  id: string;
  text: string;
}

const norm = (s: string) => normaliseForMatch(s).replace(/\s+/g, ' ');

/**
 * Golden rule 7 — keep only sources whose messageId is a real PATIENT message and whose quote really
 * appears in that message. A line with no valid source is dropped.
 */
export function validSources(line: SummaryLine, messages: Map<string, string>): SummaryLine | null {
  const sources = line.sources.filter((s) => {
    const msg = messages.get(s.messageId);
    return msg !== undefined && norm(msg).includes(norm(s.quote));
  });
  return sources.length ? { ...line, sources } : null;
}

const MED_SECTIONS = new Set(['medications', 'allergies']);

/**
 * Golden rule 6 on a summary line, with Option A: in the medications/allergies sections a medicine
 * name or dose is allowed only when the same name/dose appears in the line's cited patient quotes.
 */
export function checkSummaryLine(line: SummaryLine, section: string): FilterRule[] {
  let rules = checkOutput(line.text).rules;
  if (MED_SECTIONS.has(section)) {
    const quotes = line.sources.map((s) => s.quote).join(' \n ');
    const quoteDrugs = new Set(findDrugNames(quotes));
    const quoteDoses = new Set(findDosages(quotes));
    if (findDrugNames(line.text).every((d) => quoteDrugs.has(d))) rules = rules.filter((r) => r !== 'drug_name');
    if (findDosages(line.text).every((d) => quoteDoses.has(d))) rules = rules.filter((r) => r !== 'dosage');
  }
  return rules;
}

type LineArrayKey = 'historyOfPresentIllness' | 'pertinentNegatives' | 'pastHistory' | 'medications' | 'allergies' | 'familySocial' | 'specialtyExtras' | 'patientQuestions';
const SUBJ_ARRAYS: LineArrayKey[] = ['historyOfPresentIllness', 'pertinentNegatives', 'pastHistory', 'medications', 'allergies', 'familySocial', 'specialtyExtras', 'patientQuestions'];

export interface CleanResult {
  summary: PreVisitSummary;
  /** Lines removed for having no valid source (rule 7). */
  droppedUnsourced: number;
  /** Filter rules hit, per offending line (rule 6). Empty = clean. */
  violations: FilterRule[][];
  /** The model's chief complaint had no valid source and no fallback was given. */
  chiefMissing: boolean;
}

/**
 * Applies rule 7 (drop unsourced lines) and runs rule 6 on everything that remains. Lines that fail the
 * filter are reported (so the caller can regenerate) and, with `dropViolations`, removed.
 */
export function cleanSummary(
  input: PreVisitSummary,
  patientMessages: CitableMessage[],
  dropViolations: boolean,
  fallbackChief?: SummaryLine,
): CleanResult {
  const msgs = new Map(patientMessages.map((m) => [m.id, m.text]));
  let droppedUnsourced = 0;
  const violations: FilterRule[][] = [];

  const keep = (line: SummaryLine | undefined, section: string): SummaryLine | undefined => {
    if (!line) return undefined;
    const sourced = validSources(line, msgs);
    if (!sourced) {
      droppedUnsourced += 1;
      return undefined;
    }
    const rules = checkSummaryLine(sourced, section);
    if (rules.length) {
      violations.push(rules);
      return dropViolations ? undefined : sourced;
    }
    return sourced;
  };
  const keepAll = (lines: SummaryLine[], section: string) => lines.map((l) => keep(l, section)).filter((l): l is SummaryLine => !!l);

  const s = input.subjective;
  const subjective = { ...s } as PreVisitSummary['subjective'];
  for (const k of SUBJ_ARRAYS) subjective[k] = keepAll(s[k], k);
  subjective.patientConcern = keep(s.patientConcern, 'patientConcern');
  if (subjective.patientConcern === undefined) delete subjective.patientConcern;
  const chief = keep(s.chiefComplaint, 'chiefComplaint') ?? keep(fallbackChief, 'chiefComplaint');

  const gaps = input.historyGapsForDoctor.filter((g) => {
    const rules = checkOutput(g).rules;
    if (rules.length) violations.push(rules);
    return rules.length === 0 || !dropViolations;
  });

  const summary: PreVisitSummary = {
    ...input,
    thirtySecondSummary: keepAll(input.thirtySecondSummary, 'thirtySecondSummary'),
    subjective: { ...subjective, chiefComplaint: chief ?? s.chiefComplaint },
    objectivePatientReported: { ...input.objectivePatientReported, homeReadings: keepAll(input.objectivePatientReported.homeReadings, 'homeReadings') },
    historyGapsForDoctor: gaps,
  };
  return { summary, droppedUnsourced, violations, chiefMissing: !chief };
}
