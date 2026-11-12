import Anthropic from '@anthropic-ai/sdk';
import type { JsonRequest, JsonResponse, LlmProvider, Usage } from '../types';
import { LlmOutputError } from '../types';
import { parseJson, providerSchema } from './shared';

/**
 * Claude (pilot & production): Claude Haiku 5.5 by default (docs/ai-models.md).
 * - Structured output via `output_config.format` (JSON schema); we still validate with zod.
 * - The system prompt is stable per clinic/doctor and marked for prompt caching.
 * - Zero data retention is an organisation-level agreement with Anthropic, not a request flag;
 *   it must be in place before real patient data is sent (release checklist).
 */
export class AnthropicLlmProvider implements LlmProvider {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(
    readonly model: string = 'claude-haiku-5-5',
    apiKey?: string,
  ) {
    // Without an explicit key the SDK resolves credentials from the environment.
    this.client = new Anthropic(apiKey ? { apiKey, maxRetries: 2, timeout: 30_000 } : { maxRetries: 2, timeout: 30_000 });
  }

  async json<T>(req: JsonRequest<T>): Promise<JsonResponse<T>> {
    const started = Date.now();
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: req.maxTokens,
      system: [{ type: 'text', text: req.system, cache_control: { type: 'ephemeral' } }],
      messages: req.messages,
      // Narrow task: low effort keeps latency and cost down.
      output_config: { effort: 'low', format: { type: 'json_schema', schema: providerSchema(req.schema) } },
    });
    const usage: Usage = {
      provider: this.name,
      model: this.model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cachedInputTokens: response.usage.cache_read_input_tokens ?? 0,
      latencyMs: Date.now() - started,
    };
    if (response.stop_reason === 'refusal') throw new LlmOutputError('Model declined', usage);
    if (response.stop_reason === 'max_tokens') throw new LlmOutputError('Model output was cut off', usage);
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');
    return { data: parseJson(text, req.schema, usage), usage };
  }
}
