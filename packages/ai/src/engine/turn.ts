import type { Language } from '@medicos/shared';
import { checkTurn, type FilterRule } from '../filter/output-filter';
import type { IntakeTemplate, TemplateQuestion } from '../templates/schema';
import { IntakeTurn, LlmOutputError, type LlmProvider, type Usage } from '../types';
import { buildMessages, buildSystemPrompt, type PromptContext, type TranscriptItem } from './prompt';

export const MAX_REGENERATIONS = 2;

export interface TurnInput {
  provider: LlmProvider;
  template: IntakeTemplate;
  language: Language;
  question: TemplateQuestion;
  previous: TemplateQuestion | null;
  /** De-identified transcript. */
  transcript: TranscriptItem[];
  medicalQuestion: boolean;
  prompt: PromptContext;
}

export interface TurnOutput {
  message: string;
  quickReplies: string[];
  questionId: string;
  section: string;
  step: 1 | 2 | 3;
  /** Rules that blocked each rejected attempt (for FilterBlockEvent rows — ids only). */
  blocks: FilterRule[][];
  /** Attempts whose output was not valid JSON for the schema. */
  invalidOutputs: number;
  usage: Usage[];
  usedFallback: boolean;
}

/**
 * One AI question: call the model, run the output filter (rule 6), regenerate at most twice, then fall
 * back to the template's own reviewed question text. The model never decides coverage; it may only ask
 * the planned question or one follow-up on the previous question.
 */
export async function runTurn(input: TurnInput): Promise<TurnOutput> {
  const { provider, question, previous, language } = input;
  const system = buildSystemPrompt(input.prompt);
  const blocks: FilterRule[][] = [];
  const usage: Usage[] = [];
  let invalidOutputs = 0;
  let rejection: string[] | undefined;

  for (let attempt = 0; attempt <= MAX_REGENERATIONS; attempt++) {
    try {
      const res = await provider.json({
        system,
        messages: buildMessages(input.transcript, { question, previous, language, medicalQuestion: input.medicalQuestion }, rejection),
        schema: IntakeTurn,
        schemaName: 'intake_turn',
        maxTokens: 400,
        mockHint: {
          plannedQuestionId: question.id,
          plannedText: question.text[language],
          plannedQuickReplies: question.quickReplies?.[language] ?? [],
          section: question.section,
          done: false,
          language,
        },
      });
      usage.push(res.usage);
      const turn = res.data;
      const verdict = checkTurn(turn.message, turn.quick_replies);
      if (!verdict.ok) {
        blocks.push(verdict.rules);
        rejection = verdict.rules;
        continue;
      }
      // Only the planned question or a follow-up on the previous one is allowed.
      const askedId = previous && turn.question_id === previous.id ? previous.id : question.id;
      const asked = askedId === question.id ? question : previous!;
      return {
        message: turn.message.trim(),
        quickReplies: turn.quick_replies.slice(0, 4),
        questionId: askedId,
        section: asked.section,
        step: asked.step,
        blocks,
        invalidOutputs,
        usage,
        usedFallback: false,
      };
    } catch (e) {
      if (!(e instanceof LlmOutputError)) throw e;
      if (e.usage) usage.push(e.usage);
      invalidOutputs += 1;
      rejection = ['invalid_json'];
    }
  }

  // Safe canned question: the template text (reviewed, and tested to pass the filter).
  return {
    message: question.text[language],
    quickReplies: question.quickReplies?.[language] ?? [],
    questionId: question.id,
    section: question.section,
    step: question.step,
    blocks,
    invalidOutputs,
    usage,
    usedFallback: true,
  };
}
