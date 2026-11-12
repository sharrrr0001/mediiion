import { z } from 'zod';
import type { Language } from '@medicos/shared';

/** One message as sent to a model (already de-identified). */
export interface LlmMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface Usage {
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
  latencyMs: number;
}

export interface JsonRequest<T> {
  /** Stable system prompt (cached where the provider supports it). */
  system: string;
  messages: LlmMessage[];
  schema: z.ZodType<T>;
  /** Short name of the output shape, e.g. "intake_turn". */
  schemaName: string;
  maxTokens: number;
  /** Hint for the mock provider and for evals; real providers ignore it. */
  mockHint?: MockHint;
  /** Structured input for the mock provider's deterministic outputs (e.g. summaries). */
  mockData?: unknown;
}

export interface JsonResponse<T> {
  data: T;
  usage: Usage;
}

/** Spec §5: every AI call goes through this interface so providers can be swapped. */
export interface LlmProvider {
  readonly name: string;
  readonly model: string;
  /** Generates JSON matching `schema`. Throws `LlmOutputError` if the model's output is not valid. */
  json<T>(req: JsonRequest<T>): Promise<JsonResponse<T>>;
}

export class LlmOutputError extends Error {
  constructor(
    message: string,
    public readonly usage?: Usage,
  ) {
    super(message);
  }
}

/** The intake agent's reply (spec §6.3) plus the template question it is asking. */
export const IntakeTurn = z.object({
  message: z.string().min(1).max(600),
  section: z.string().max(40),
  done: z.boolean(),
  quick_replies: z.array(z.string().max(40)).max(6),
  question_id: z.string().max(60),
});
export type IntakeTurn = z.infer<typeof IntakeTurn>;

/** What the engine tells the mock provider to do (deterministic tests/evals). */
export interface MockHint {
  plannedQuestionId: string;
  plannedText: string;
  plannedQuickReplies: string[];
  section: string;
  done: boolean;
  language: Language;
}
