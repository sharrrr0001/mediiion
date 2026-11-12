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
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  })
  .superRefine((env, ctx) => {
    if (env.NODE_ENV !== 'production') return;
    // Fail closed: dev-only conveniences must never run in production.
    if (env.DEV_OUTBOX) ctx.addIssue({ code: 'custom', path: ['DEV_OUTBOX'], message: 'must be false in production' });
    if (env.SMS_PROVIDER === 'console')
      ctx.addIssue({ code: 'custom', path: ['SMS_PROVIDER'], message: 'console SMS is not allowed in production' });
    if (env.EMAIL_PROVIDER === 'console')
      ctx.addIssue({ code: 'custom', path: ['EMAIL_PROVIDER'], message: 'console email is not allowed in production' });
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
