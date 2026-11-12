import type { JsonRequest, JsonResponse, LlmProvider, Usage } from '../types';
import { LlmOutputError } from '../types';
import { emptyUsage, parseJson, providerSchema } from './shared';

async function postJson(url: string, headers: Record<string, string>, body: unknown, timeoutMs = 30_000): Promise<unknown> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    // Status only — provider error bodies can echo our prompt.
    throw new Error(`LLM provider HTTP ${res.status}`);
  }
  return res.json();
}

const schemaHint = (req: JsonRequest<unknown>) =>
  `\n\nOutput must be a single JSON object matching this JSON Schema:\n${JSON.stringify(providerSchema(req.schema))}`;

/**
 * Demo only (free tier, TEST DATA ONLY): Google Gemini Flash via the AI Studio REST API.
 * Free tiers may use inputs for training — env validation blocks this provider in production.
 */
export class GeminiLlmProvider implements LlmProvider {
  readonly name = 'gemini';
  constructor(
    readonly model: string,
    private readonly apiKey: string,
  ) {}

  async json<T>(req: JsonRequest<T>): Promise<JsonResponse<T>> {
    const started = Date.now();
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const body = {
      systemInstruction: { parts: [{ text: req.system + schemaHint(req as JsonRequest<unknown>) }] },
      contents: req.messages.map((m) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] })),
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: req.maxTokens },
    };
    const json = (await postJson(url, { 'x-goog-api-key': this.apiKey }, body)) as {
      candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number; cachedContentTokenCount?: number };
    };
    const usage: Usage = {
      ...emptyUsage(this.name, this.model, Date.now() - started),
      inputTokens: json.usageMetadata?.promptTokenCount ?? 0,
      outputTokens: json.usageMetadata?.candidatesTokenCount ?? 0,
      cachedInputTokens: json.usageMetadata?.cachedContentTokenCount ?? 0,
    };
    const text = json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (!text) throw new LlmOutputError('Empty model output', usage);
    return { data: parseJson(text, req.schema, usage), usage };
  }
}

/**
 * Any OpenAI-compatible chat endpoint: Llama on Groq (demo, test data only) or a self-hosted vLLM
 * serving Qwen/Gemma in India (production option). One adapter, configured by base URL.
 */
export class OpenAiCompatibleLlmProvider implements LlmProvider {
  readonly name = 'openai-compatible';
  constructor(
    readonly model: string,
    private readonly baseUrl: string,
    private readonly apiKey?: string,
  ) {}

  async json<T>(req: JsonRequest<T>): Promise<JsonResponse<T>> {
    const started = Date.now();
    const body = {
      model: this.model,
      max_tokens: req.maxTokens,
      response_format: { type: 'json_object' },
      messages: [{ role: 'system', content: req.system + schemaHint(req as JsonRequest<unknown>) }, ...req.messages],
    };
    const headers: Record<string, string> = this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {};
    const json = (await postJson(`${this.baseUrl.replace(/\/$/, '')}/chat/completions`, headers, body)) as {
      choices?: Array<{ message?: { content?: string } }>;
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const usage: Usage = {
      ...emptyUsage(this.name, this.model, Date.now() - started),
      inputTokens: json.usage?.prompt_tokens ?? 0,
      outputTokens: json.usage?.completion_tokens ?? 0,
    };
    const text = json.choices?.[0]?.message?.content ?? '';
    if (!text) throw new LlmOutputError('Empty model output', usage);
    return { data: parseJson(text, req.schema, usage), usage };
  }
}
