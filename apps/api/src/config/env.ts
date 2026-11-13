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
    /** 'console' = no real SMS: phone login is switched off in production until an SMS provider exists. */
    SMS_PROVIDER: z.enum(['console']).default('console'),
    EMAIL_PROVIDER: z.enum(['smtp', 'console']).default('smtp'),
    SMTP_HOST: z.string().default('localhost'),
    SMTP_PORT: z.coerce.number().int().default(1025),
    /** TLS from the first byte (port 465, e.g. Gmail). */
    SMTP_SECURE: z.enum(['true', 'false']).default('false').transform((v) => v === 'true'),
    SMTP_USER: z.string().optional(),
    SMTP_PASS: z.string().optional(),
    EMAIL_FROM: z.string().default('no-reply@medicos.local'),
    DEV_OUTBOX: z
      .enum(['true', 'false'])
      .default('false')
      .transform((v) => v === 'true'),
    /** OTP requests allowed per IP per 10 minutes (many patients can share a clinic's IP). */
    OTP_MAX_PER_IP: z.coerce.number().int().positive().default(10),
    /** Proxies in front of the API (1 = Next dev rewrite; 2 = Vercel + Cloudflare tunnel). */
    TRUST_PROXY_HOPS: z.coerce.number().int().min(0).max(5).default(1),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
    // AI (docs/ai-models.md)
    /** auto = pick by which key is set: ANTHROPIC_API_KEY → Claude, GEMINI_API_KEY → Gemini (demo), none → mock. */
    LLM_PROVIDER: z.enum(['auto', 'mock', 'gemini', 'openai-compatible', 'anthropic']).default('auto'),
    LLM_MODEL: z.string().default(''),
    LLM_BASE_URL: z.string().optional(),
    LLM_API_KEY: z.string().optional(),
    GEMINI_API_KEY: z.string().optional(),
    ANTHROPIC_API_KEY: z.string().optional(),
    /** Must be set to "no-training" to send real patient data to a provider in production. */
    LLM_DATA_TERMS: z.enum(['no-training', 'unknown']).default('unknown'),
    USD_INR: z.coerce.number().positive().default(88),
    /** auto = SARVAM_API_KEY → Sarvam, GROQ_API_KEY → Groq (demo), none → mock (dev) / voice off (production). */
    STT_PROVIDER: z.enum(['auto', 'mock', 'groq', 'sarvam']).default('auto'),
    SARVAM_API_KEY: z.string().optional(),
    GROQ_API_KEY: z.string().optional(),
    STT_MODEL: z.string().default(''),
    STT_API_KEY: z.string().optional(),
    // WhatsApp Cloud API (sandbox/live). Without these, notifications go by email (or SMS once available).
    WHATSAPP_TOKEN: z.string().optional(),
    WHATSAPP_PHONE_ID: z.string().optional(),
    /** Approved template with one body parameter ({{1}} = the message text). */
    WHATSAPP_TEMPLATE: z.string().default('medicos_update'),
    /** Public web address used in notification links (defaults to the first WEB_ORIGINS entry). */
    PUBLIC_WEB_URL: z.string().optional(),
    /** Background jobs (reminders) run in this process every minute; off in tests. */
    JOBS_ENABLED: z.enum(['true', 'false']).default('true').transform((v) => v === 'true'),
    // Billing (Razorpay test/live keys; without them online payment is switched off)
    RAZORPAY_KEY_ID: z.string().optional(),
    RAZORPAY_KEY_SECRET: z.string().optional(),
    RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
    /** JSON map, e.g. {"pro:monthly":"plan_ABC","pro:yearly":"plan_DEF"} (plans created in the Razorpay dashboard). */
    RAZORPAY_PLAN_IDS: z.string().default('{}'),
    SELLER_NAME: z.string().default('Medicos'),
    SELLER_GSTIN: z.string().optional(),
    SELLER_ADDRESS: z.string().default('India'),
    // Object storage
    S3_ENDPOINT: z.string().optional(),
    S3_REGION: z.string().default('ap-south-1'),
    S3_BUCKET: z.string().default('medicos-dev'),
    S3_ACCESS_KEY: z.string().optional(),
    S3_SECRET_KEY: z.string().optional(),
  })
  .transform((env) => {
    const prod = env.NODE_ENV === 'production';
    // Pick the AI provider from whichever key is present (docs/deploy.md).
    const llm =
      env.LLM_PROVIDER !== 'auto'
        ? env.LLM_PROVIDER
        : env.ANTHROPIC_API_KEY
          ? 'anthropic'
          : env.GEMINI_API_KEY
            ? 'gemini'
            : 'mock';
    const llmModel = env.LLM_MODEL || (llm === 'anthropic' ? 'claude-haiku-5-5' : llm === 'gemini' ? 'gemini-2.5-flash' : '');
    // Anthropic's API terms exclude training on inputs; other providers must be declared explicitly.
    const noTraining = llm === 'anthropic' || (llm === 'openai-compatible' && env.LLM_DATA_TERMS === 'no-training');
    const stt =
      env.STT_PROVIDER !== 'auto' ? env.STT_PROVIDER : env.SARVAM_API_KEY ? 'sarvam' : env.GROQ_API_KEY ? 'groq' : 'mock';
    const sttKey = env.STT_API_KEY || (stt === 'sarvam' ? env.SARVAM_API_KEY : stt === 'groq' ? env.GROQ_API_KEY : undefined);
    return {
      ...env,
      LLM_PROVIDER: llm,
      LLM_MODEL: llmModel,
      LLM_DATA_TERMS: noTraining ? ('no-training' as const) : ('unknown' as const),
      STT_PROVIDER: stt,
      STT_API_KEY: sttKey,
      /** Phone OTP needs a real SMS provider in production. */
      PHONE_LOGIN: !prod || env.SMS_PROVIDER !== 'console',
      /** Mock speech-to-text would invent answers: voice is off in production without a real STT key. */
      VOICE_ENABLED: !prod || stt !== 'mock',
      /**
       * Demo mode (production only; dev data is always fictional): a free-tier / mock AI or non-India speech-to-text is in use. The web app shows a
       * "fictional data only" banner. Pilot mode needs a no-training LLM and Sarvam (golden rules 11, 12).
       */
      DEMO_MODE: prod && (!noTraining || stt === 'groq'),
    };
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Fail closed: dev-only conveniences must never run in production.
    if (env.DEV_OUTBOX) ctx.addIssue({ code: 'custom', path: ['DEV_OUTBOX'], message: 'must be false in production' });
    if (env.EMAIL_PROVIDER === 'console')
      ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'console email is not allowed in production' });
    if (!env.PHONE_LOGIN && env.EMAIL_PROVIDER !== 'smtp')
      ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'production needs at least one real OTP channel' });
    if (env.LLM_PROVIDER === 'gemini' && !env.GEMINI_API_KEY)
      ctx.addIssue({ code: 'custom', path: ['GEMINI_API_KEY'], message: 'required for gemini' });
    if (env.LLM_PROVIDER === 'anthropic' && !env.ANTHROPIC_API_KEY)
      ctx.addIssue({ code: 'custom', path: ['ANTHROPIC_API_KEY'], message: 'required for anthropic' });
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
