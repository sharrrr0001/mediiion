import { Inject, Injectable, Logger } from '@nestjs/common';
import { costInr, createLlmProvider, type LlmProvider, type Usage } from '@medicos/ai';
import { PrismaService } from '../config/core.module';
import { ENV, type Env } from '../config/env';

/** Holds the configured LLM provider and records token/cost usage (spec §5 `ai_usage`). */
@Injectable()
export class AiService {
  private readonly logger = new Logger('AI');
  readonly provider: LlmProvider;

  constructor(
    @Inject(ENV) private readonly env: Env,
    private readonly prisma: PrismaService,
  ) {
    const apiKey =
      env.LLM_PROVIDER === 'gemini' ? env.GEMINI_API_KEY : env.LLM_PROVIDER === 'anthropic' ? env.ANTHROPIC_API_KEY : env.LLM_API_KEY;
    this.provider = createLlmProvider({ provider: env.LLM_PROVIDER, model: env.LLM_MODEL, baseUrl: env.LLM_BASE_URL, apiKey });
    this.logger.log(`LLM provider: ${this.provider.name} / ${this.provider.model}`);
  }

  /** Token counts and ids only — never prompt text (spec §5 privacy). */
  async recordUsage(sessionId: string, step: 'chat' | 'summary' | 'stt', usages: Usage[]) {
    if (!usages.length) return;
    await this.prisma.aiUsage.createMany({
      data: usages.map((u) => ({
        sessionId,
        step,
        provider: u.provider,
        model: u.model,
        inputTokens: u.inputTokens,
        outputTokens: u.outputTokens,
        costInr: costInr(u, this.env.USD_INR).inr,
        latencyMs: u.latencyMs,
      })),
    });
  }
}
