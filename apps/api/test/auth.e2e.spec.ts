import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createFieldCrypto, BIDX } from '@medicos/db';
import { PrismaService } from '../src/config/core.module';
import { createTestApp, loginWithPhone, uniqueIp, uniquePhone, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

const http = () => request(t.app.getHttpServer());

describe('OTP auth', () => {
  it('signs up a new patient with phone OTP and sets httpOnly, SameSite=Strict cookies', async () => {
    const { verify, agent } = await loginWithPhone(t);
    expect(verify.status).toBe(200);
    const cookies = ([] as string[]).concat(verify.headers['set-cookie'] ?? []);
    const access = cookies.find((c) => c.startsWith('mc_at='));
    expect(access).toMatch(/HttpOnly/i);
    expect(access).toMatch(/SameSite=Strict/i);
    const me = await agent.get('/me');
    expect(me.status).toBe(200);
    expect(me.body.user.role).toBe('patient');
    expect(me.body.needsConsent).toBe(true);
    expect(me.body.needsProfile).toBe(true);
    expect(me.body.user.contactHint).toMatch(/^\+91 ••••• •\d{4}$/);
  });

  it('validates input and returns the standard error shape', async () => {
    const res = await http().post('/auth/otp/request').set('X-Forwarded-For', uniqueIp()).send({ channel: 'sms', phone: '123' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(JSON.stringify(res.body)).not.toMatch(/stack|at Object\./);
  });

  it('rejects a wrong code, then locks after 5 attempts', async () => {
    const phone = uniquePhone();
    const ip = uniqueIp();
    const r = await http().post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
    const real = t.outbox.latest(phone)!;
    const wrong = real === '000000' ? '111111' : '000000';
    for (let i = 0; i < 5; i++) {
      const v = await http().post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: wrong });
      expect(v.status).toBe(400);
      expect(v.body.error.attemptsLeft).toBe(4 - i);
    }
    const locked = await http().post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: real });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('OTP_LOCKED');
  });

  it('rejects an expired code and a reused code', async () => {
    const phone = uniquePhone();
    const ip = uniqueIp();
    const r = await http().post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
    const code = t.outbox.latest(phone)!;
    await prisma.otpChallenge.update({ where: { id: r.body.challengeId }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await http().post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code });
    expect(expired.status).toBe(400);

    const ok = await loginWithPhone(t);
    const again = await http().post('/auth/otp/verify').send({ challengeId: ok.challengeId, code: t.outbox.latest(ok.phone) });
    expect(again.status).toBe(400);
  });

  it('enforces the 30s resend wait', async () => {
    const phone = uniquePhone();
    const ip = uniqueIp();
    await http().post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
    const second = await http().post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
    expect(second.status).toBe(429);
    expect(second.body.error.code).toBe('OTP_RESEND_WAIT');
  });

  it('stores only hashes/ciphertext for phone and OTP', async () => {
    const { phone } = await loginWithPhone(t);
    const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);
    const user = await prisma.user.findUnique({ where: { phoneHash: crypto.blindIndex(phone, BIDX.phone) } });
    expect(user).not.toBeNull();
    expect(user!.phoneEnc).not.toContain(phone.slice(3));
    expect(crypto.decrypt(user!.phoneEnc!, 'user.phone')).toBe(phone);
    const rows = await prisma.otpChallenge.findMany({ where: { identifierHash: user!.phoneHash! } });
    for (const row of rows) expect(JSON.stringify(row)).not.toContain(phone.slice(3));
  });

  it('blocks doctor/staff/admin sign-in until TOTP 2FA exists', async () => {
    const phone = uniquePhone();
    const crypto = createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);
    await prisma.user.create({ data: { phoneHash: crypto.blindIndex(phone, BIDX.phone), role: 'doctor' } });
    const { verify } = await loginWithPhone(t, phone);
    expect(verify.status).toBe(403);
    expect(verify.body.error.code).toBe('TWO_FACTOR_REQUIRED');
    expect(verify.headers['set-cookie'] ?? []).not.toEqual(expect.arrayContaining([expect.stringMatching(/^mc_at=/)]));
  });
});

describe('sessions', () => {
  it('denies protected routes without a session', async () => {
    const res = await http().get('/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it('rotates the refresh token and revokes the family when an old token is reused', async () => {
    const { agent, verify } = await loginWithPhone(t);
    const cookies = ([] as string[]).concat(verify.headers['set-cookie'] ?? []);
    const oldRefresh = cookies.find((c) => c.startsWith('mc_rt='))!.split(';')[0]!;
    const device = cookies.find((c) => c.startsWith('mc_did='))!.split(';')[0]!;

    const first = await agent.post('/auth/refresh');
    expect(first.status).toBe(200);
    expect((await agent.get('/me')).status).toBe(200);

    // Attacker replays the old refresh token from the same device.
    const replay = await http().post('/auth/refresh').set('Cookie', `${oldRefresh}; ${device}`);
    expect(replay.status).toBe(401);

    // Whole family is now revoked: the legitimate agent is logged out too.
    expect((await agent.get('/me')).status).toBe(401);
    expect((await agent.post('/auth/refresh')).status).toBe(401);
  });

  it('rejects a refresh token presented from another device', async () => {
    const { verify } = await loginWithPhone(t);
    const cookies = ([] as string[]).concat(verify.headers['set-cookie'] ?? []);
    const refresh = cookies.find((c) => c.startsWith('mc_rt='))!.split(';')[0]!;
    const res = await http().post('/auth/refresh').set('Cookie', `${refresh}; mc_did=00000000-0000-4000-8000-000000000000`);
    expect(res.status).toBe(401);
  });

  it('logout invalidates the access token immediately', async () => {
    const { agent } = await loginWithPhone(t);
    expect((await agent.post('/auth/logout')).status).toBe(200);
    expect((await agent.get('/me')).status).toBe(401);
  });

  it('rejects state-changing requests from a foreign Origin (CSRF)', async () => {
    const { agent } = await loginWithPhone(t);
    const res = await agent.post('/auth/logout').set('Origin', 'https://evil.example');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('BAD_ORIGIN');
    const ok = await agent.post('/auth/logout').set('Origin', 'http://localhost:3001');
    expect(ok.status).toBe(200);
  });
});
