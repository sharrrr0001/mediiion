import { z } from 'zod';

const base64Key = z
  .string()
  .refine((v) => Buffer.from(v, 'base64').length === 32, 'must be 32 bytes, base64-encoded');

const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    APP_NAME: z.string().default('Medicos'),
    API_PORT: z.coerce.number().int().default(4000),
    DATABASE_URL: z.string().min(1),
    FIELD_ENCRYPTION_KEY: base64Key,
    BLIND_INDEX_KEY: base64Key,
    JWT_SECRET: z.string().min(32),
    WEB_ORIGINS: z
      .string()
      .default('http://localhost:3001')
      .transform((v) => v.split(',').map((s) => s.trim()).filter(Boolean)),
    REFRESH_COOKIE_PATH: z.string().default('/api/auth'),
    SMS_PROVIDER: z.enum(['console']).default('console'),
    EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('smtp'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().default(1025),
    EMAIL_FROM: z.string().default('no-reply@medicos.local'),
    DEV_OUTBOX: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /** OTP requests allowed per IP per 10 minutes (many patients can share a clinic's IP). */
    OTP_MAX_PER_IP: z.coerce.number().int().positive().default(10),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // AI (docs/ai-models.md)
    LLM_PROVIDER: z.enum(['mock', 'gemini', 'openai-compatible', 'anthropic']).default('mock'),
    LLM_MODEL: z.string().default(''),
    LLM_BASE_URL: z.string().optional(),
    LLM_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    /** Must be set to "no-training" to send real patient data to a provider in production. */
    LLM_DATA_TERMS: z.enum(['no-training', 'unknown']).default('unknown'),
    USD_INR: z.coerce.number().positive().default(88),
    STT_PROVIDER: z.enum(['mock', 'groq', 'sarvam']).default('mock'),
    STT_MODEL: z.string().default(''),
    STT_API_KEY: z.string().optional(),
    // Object storage
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('ap-south-1'),
    S3_BUCKET: z.string().default('medicos-dev'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Fail closed: dev-only conveniences must never run in production.
    if (env.DEV_OUTBOX) ctx.addIssue({ code: 'custom', path: ['DEV_OUTBOX'], message: 'must be false in production' });
    if (env.SMS_PROVIDER === 'console')
      ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'console SMS is not allowed in production' });
    if (env.EMAIL_PROVIDER === 'console')
      ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'console email is not allowed in production' });
    // Golden rule 11: real patients only with providers whose terms forbid training on inputs.
    if (env.LLM_PROVIDER === 'mock' || env.LLM_PROVIDER === 'gemini')
      ctx.addIssue({ code: 'custom', path: ['LLM_PROVIDER'], message: 'mock/free-tier providers are not allowed in production' });
    // Voice cannot be de-identified: production STT must be the India-hosted, no-training provider.
    if (env.STT_PROVIDER !== 'sarvam')
      ctx.addIssue({ code: 'custom', path: ['STT_PROVIDER'], message: 'production speech-to-text must be sarvam' });
    if (env.LLM_DATA_TERMS !== 'no-training')
      ctx.addIssue({ code: 'custom', path: ['LLM_DATA_TERMS'], message: 'must be "no-training" in production' });
  });

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const parsed = EnvSchema.safeParse(source);
  if (!parsed.success) {
    // Only variable names and reasons — never values.
    const problems = parsed.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`).join('\n');
    throw new Error(`Invalid environment configuration:\n${problems}`);
  }
  return parsed.data;
}

export const ENV = Symbol('ENV');
