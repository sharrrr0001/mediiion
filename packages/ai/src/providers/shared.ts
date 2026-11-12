import { z } from 'zod';
import { LlmOutputError, type Usage } from '../types';

/**
 * JSON Schema for providers' structured-output modes. Providers accept a subset of JSON Schema, so we
 * keep only structural keywords; length/pattern limits are enforced by our own zod validation.
 */
const KEEP = new Set(['type', 'properties', 'required', 'items', 'enum', 'const', 'anyOf', 'description', 'additionalProperties']);

export function providerSchema(schema: z.ZodType): Record<string, unknown> {
  const strip = (node: unknown): unknown => {
    if (Array.isArray(node)) return node.map(strip);
    if (!node || typeof node !== 'object') return node;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
      if (!KEEP.has(k)) continue;
      out[k] = k === 'properties' ? Object.fromEntries(Object.entries(v as object).map(([pk, pv]) => [pk, strip(pv)])) : strip(v);
    }
    if (out.type === 'object') out.additionalProperties = false;
    return out;
  };
  return strip(z.toJSONSchema(schema, { io: 'output', unrepresentable: 'any' })) as Record<string, unknown>;
}

/** Parse model text as JSON and validate it. Tolerates ```json fences some open models add. */
export function parseJson<T>(text: string, schema: z.ZodType<T>, usage: Usage): T {
  const cleaned = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  let value: unknown;
  try {
    value = JSON.parse(cleaned);
  } catch {
    throw new LlmOutputError('Model output was not valid JSON', usage);
  }
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new LlmOutputError('Model output did not match the schema', usage);
  return parsed.data;
}

export function emptyUsage(provider: string, model: string, latencyMs = 0): Usage {
  return { provider, model, inputTokens: 0, outputTokens: 0, cachedInputTokens: 0, latencyMs };
}
