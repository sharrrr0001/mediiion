import { z } from 'zod';
import type { JsonRequest, JsonResponse, LlmProvider } from '../types';
import { LlmOutputError } from '../types';
import { emptyUsage, parseJson } from './shared';
import { buildMockSummary } from '../summary/mock-summary';
import type { SummaryItem } from '../summary/writer';

/**
 * Deterministic provider for tests, CI and offline dev. Behaves like an ideal model: asks the planned
 * question verbatim. `script` lets evals inject misbehaving raw outputs (e.g. a diagnosis or a
 * medicine name) to prove the output filter catches them; each entry is used once, in order.
 * Summary generation (Phase 2) is handled by `structuredHandler`.
 */
export class MockLlmProvider implements LlmProvider {
  readonly name = 'mock';
  readonly model = 'mock-v1';
  private readonly script: string[];
  calls: Array<{ system: string; messages: JsonRequest<unknown>['messages'] }> = [];

  constructor(
    script: string[] = [],
    private readonly structuredHandler?: (req: JsonRequest<unknown>) => unknown,
  ) {
    this.script = [...script];
  }

  async json<T>(req: JsonRequest<T>): Promise<JsonResponse<T>> {
    this.calls.push({ system: req.system, messages: req.messages });
    const usage = emptyUsage(this.name, this.model);
    const scripted = this.script.shift();
    if (scripted !== undefined) return { data: parseJson(scripted, req.schema, usage), usage };

    if (req.schemaName === 'intake_turn') {
      const h = req.mockHint;
      if (!h) throw new LlmOutputError('mock: intake_turn needs a mockHint', usage);
      const data = {
        message: h.plannedText,
        section: h.section,
        done: h.done,
        quick_replies: h.plannedQuickReplies,
        question_id: h.plannedQuestionId,
      };
      return { data: (req.schema as z.ZodType<T>).parse(data), usage };
    }
    if (req.schemaName === 'pre_visit_summary' && req.mockData) {
      const d = req.mockData as { items: SummaryItem[]; base: Parameters<typeof buildMockSummary>[1] };
      return { data: req.schema.parse(buildMockSummary(d.items, d.base)), usage };
    }
    if (this.structuredHandler) return { data: req.schema.parse(this.structuredHandler(req as JsonRequest<unknown>)), usage };
    throw new LlmOutputError(`mock: no handler for ${req.schemaName}`, usage);
  }
}
