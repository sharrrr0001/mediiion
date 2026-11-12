import { describe, expect, it } from 'vitest';
import { loadEnv } from './env';

const key = Buffer.alloc(32, 7).toString('base64');
const base = {
  DATABASE_URL: 'postgresql://x',
  FIELD_ENCRYPTION_KEY: key,
  BLIND_INDEX_KEY: key,
  JWT_SECRET: 'x'.repeat(40),
} as NodeJS.ProcessEnv;
const prod = { ...base, NODE_ENV: 'production', EMAIL_PROVIDER: 'smtp', DEV_OUTBOX: 'false' } as NodeJS.ProcessEnv;

describe('env: provider picked from the key that is set', () => {
  it('uses Claude Haiku when an Anthropic key is present (pilot mode)', () => {
    const env = loadEnv({ ...prod, ANTHROPIC_API_KEY: 'a', GEMINI_API_KEY: 'g' });
    expect(env.LLM_PROVIDER).toBe('anthropic');
    expect(env.LLM_MODEL).toBe('claude-haiku-5-5');
    expect(env.LLM_DATA_TERMS).toBe('no-training');
    expect(env.DEMO_MODE).toBe(false);
  });

  it('uses Gemini in demo mode when only a Gemini key is present', () => {
    const env = loadEnv({ ...prod, GEMINI_API_KEY: 'g' });
    expect(env.LLM_PROVIDER).toBe('gemini');
    expect(env.LLM_MODEL).toBe('gemini-2.5-flash');
    expect(env.DEMO_MODE).toBe(true);
  });

  it('falls back to the scripted mock in demo mode with no key', () => {
    const env = loadEnv({ ...prod });
    expect(env.LLM_PROVIDER).toBe('mock');
    expect(env.DEMO_MODE).toBe(true);
  });

  it('an explicit LLM_PROVIDER wins over auto-detection', () => {
    expect(loadEnv({ ...base, LLM_PROVIDER: 'mock', ANTHROPIC_API_KEY: 'a' }).LLM_PROVIDER).toBe('mock');
  });
});

describe('env: production safety', () => {
  it('never allows the dev OTP outbox or console email', () => {
    expect(() => loadEnv({ ...prod, DEV_OUTBOX: 'true' })).toThrow(/DEV_OUTBOX/);
    expect(() => loadEnv({ ...prod, EMAIL_PROVIDER: 'console' })).toThrow(/EMAIL_PROVIDER/);
  });

  it('switches phone login off without an SMS provider and voice off without a real STT key', () => {
    const env = loadEnv({ ...prod, ANTHROPIC_API_KEY: 'a' });
    expect(env.PHONE_LOGIN).toBe(false);
    expect(env.VOICE_ENABLED).toBe(false);
    const dev = loadEnv({ ...base });
    expect(dev.PHONE_LOGIN).toBe(true);
    expect(dev.VOICE_ENABLED).toBe(true);
  });

  it('Sarvam keeps pilot mode; Groq voice makes it a demo', () => {
    expect(loadEnv({ ...prod, ANTHROPIC_API_KEY: 'a', SARVAM_API_KEY: 's' }).DEMO_MODE).toBe(false);
    const groq = loadEnv({ ...prod, ANTHROPIC_API_KEY: 'a', GROQ_API_KEY: 'q' });
    expect(groq.STT_PROVIDER).toBe('groq');
    expect(groq.STT_API_KEY).toBe('q');
    expect(groq.DEMO_MODE).toBe(true);
  });
});
