import type { LlmProvider, Usage } from '../types';
import { AnthropicLlmProvider } from './anthropic';
import { GeminiLlmProvider, OpenAiCompatibleLlmProvider } from './http-providers';
import { MockLlmProvider } from './mock';

export { AnthropicLlmProvider, GeminiLlmProvider, MockLlmProvider, OpenAiCompatibleLlmProvider };

export const LLM_PROVIDERS = ['mock', 'gemini', 'openai-compatible', 'anthropic'] as const;
export type LlmProviderName = (typeof LLM_PROVIDERS)[number];

export interface LlmConfig {
  provider: LlmProviderName;
  model: string;
  baseUrl?: string;
  apiKey?: string;
}

/** Selected per environment by LLM_PROVIDER / LLM_MODEL (spec §5). */
export function createLlmProvider(cfg: LlmConfig): LlmProvider {
  switch (cfg.provider) {
    case 'mock':
      return new MockLlmProvider();
    case 'anthropic':
      return new AnthropicLlmProvider(cfg.model || 'claude-haiku-5-5', cfg.apiKey);
    case 'gemini':
      if (!cfg.apiKey) throw new Error('GEMINI_API_KEY is required for LLM_PROVIDER=gemini');
      return new GeminiLlmProvider(cfg.model, cfg.apiKey);
    case 'openai-compatible':
      if (!cfg.baseUrl) throw new Error('LLM_BASE_URL is required for LLM_PROVIDER=openai-compatible');
      return new OpenAiCompatibleLlmProvider(cfg.model, cfg.baseUrl, cfg.apiKey);
  }
}

/** USD per 1M tokens (input, output). Free tiers cost 0. Unknown models are priced at 0 and flagged. */
const PRICES_USD: Record<string, [number, number]> = {
  'claude-haiku-5-5': [0.1, 0.5],
  'claude-sonnet-5-5': [2, 10],
  'mock-v1': [0, 0],
};

/** Rupee cost of one call. Cached input is billed at ~10% on Anthropic. */
export function costInr(u: Usage, usdToInr: number): { inr: number; priced: boolean } {
  const price = PRICES_USD[u.model];
  if (!price) return { inr: 0, priced: u.provider === 'mock' || u.provider === 'gemini' };
  const uncached = Math.max(0, u.inputTokens - u.cachedInputTokens);
  const usd = (uncached * price[0] + u.cachedInputTokens * price[0] * 0.1 + u.outputTokens * price[1]) / 1_000_000;
  return { inr: Math.round(usd * usdToInr * 10_000) / 10_000, priced: true };
}
