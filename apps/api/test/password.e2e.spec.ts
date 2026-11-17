import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { BIDX } from '@medicos/db';
import { PrismaService } from '../src/config/core.module';
import { createDoctorWithClinic, doctorLogin, fc } from './fixtures';
import { createTestApp, uniqueIp, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

let n = 0;
const email = () => `pw${Date.now()}${++n}@example.test`;
const http = () => request.agent(t.app.getHttpServer());
/** Each call from its own IP, like separate users (the route also has a per-IP flood guard). */
const pwLogin = (body: object, agent = http()) => agent.post('/auth/password/login').set('X-Forwarded-For', uniqueIp()).send(body);

async function otpLogin(addr: string) {
  const agent = http();
  const ip = uniqueIp();
  const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'email', email: addr });
  await agent.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(addr) });
  return agent;
}

describe('password login (after a first OTP login)', () => {
  it('OTP first, then set a password (rules + confirm), then log in with email + password; change needs the current one', async () => {
    const addr = email();
    const a = await otpLogin(addr);
    expect((await a.get('/auth/password')).body.hasPassword).toBe(false);
    expect((await a.post('/auth/password').send({ password: 'short1', confirm: 'short1' })).status).toBe(400);
    expect((await a.post('/auth/password').send({ password: 'onlyletters', confirm: 'onlyletters' })).status).toBe(400);
    expect((await a.post('/auth/password').send({ password: 'Password123', confirm: 'Password124' })).status).toBe(400);
    expect((await a.post('/auth/password').send({ password: 'password123', confirm: 'password123' })).status).toBe(400); // too common
    expect((await a.post('/auth/password').send({ password: 'Mango2026walk', confirm: 'Mango2026walk' })).status).toBe(200);
    expect((await a.get('/auth/password')).body.hasPassword).toBe(true);
    const stored = (await prisma.user.findFirstOrThrow({ where: { emailHash: fc().blindIndex(addr, BIDX.email) } })).passwordHash!;
    expect(stored).toMatch(/^scrypt\$/);
    expect(stored).not.toContain('Mango2026walk');

    const b = http();
    expect((await pwLogin({ email: addr, password: 'wrong-pass-1' })).status).toBe(401);
    const ok = await b.post('/auth/password/login').send({ email: addr.toUpperCase(), password: 'Mango2026walk' });
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);
    expect(ok.headers['set-cookie']).toEqual(expect.arrayContaining([expect.stringMatching(/^mc_at=.*HttpOnly/i)]));
    expect((await b.get('/me')).status).toBe(200);

    expect((await b.post('/auth/password').send({ password: 'River2027song', confirm: 'River2027song' })).status).toBe(400);
    expect((await b.post('/auth/password').send({ password: 'River2027song', confirm: 'River2027song', currentPassword: 'Mango2026walk' })).status).toBe(200);
    expect((await pwLogin({ email: addr, password: 'River2027song' })).status).toBe(200);
  });

  it('5 wrong passwords lock password login for 15 minutes; unknown accounts get the same answer', async () => {
    const addr = email();
    const a = await otpLogin(addr);
    await a.post('/auth/password').send({ password: 'Lotus4455bay', confirm: 'Lotus4455bay' });
    for (let i = 0; i < 5; i++) expect((await pwLogin({ email: addr, password: `nope${i}xyz9` })).status).toBe(401);
    const locked = await pwLogin({ email: addr, password: 'Lotus4455bay' });
    expect(locked.status).toBe(429);
    expect(locked.body.error.code).toBe('PASSWORD_LOCKED');
    const unknown = await pwLogin({ email: 'nobody-here@example.test', password: 'Whatever123' });
    expect(unknown.status).toBe(401);
    expect(unknown.body.error.message).toBe((await pwLogin({ email: email(), password: 'Whatever123' })).body.error.message);
  });

  it('forgot password: a fresh OTP resets it and logs in; doctors still need their authenticator code', async () => {
    const addr = email();
    const a = await otpLogin(addr);
    await a.post('/auth/password').send({ password: 'Forgot1234me', confirm: 'Forgot1234me' });
    await prisma.otpChallenge.updateMany({ where: { identifierHash: fc().blindIndex(addr, BIDX.email) }, data: { createdAt: new Date(Date.now() - 60_000) } });
    const agent = http();
    const ip = uniqueIp();
    const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'email', email: addr });
    const reset = await agent.post('/auth/password/reset').send({ challengeId: r.body.challengeId, code: t.outbox.latest(addr), password: 'Fresh5678start', confirm: 'Fresh5678start' });
    expect(reset.status, JSON.stringify(reset.body)).toBe(200);
    expect((await agent.get('/me')).status).toBe(200);
    expect((await pwLogin({ email: addr, password: 'Forgot1234me' })).status).toBe(401);
    expect((await pwLogin({ email: addr, password: 'Fresh5678start' })).status).toBe(200);

    // Doctor: password replaces only the OTP step, never 2FA.
    const { phone } = await createDoctorWithClinic(prisma);
    const doc = await doctorLogin(t, phone);
    expect((await doc.post('/auth/password').send({ password: 'Doctor2026safe', confirm: 'Doctor2026safe' })).status).toBe(200);
    const d = await pwLogin({ phone, password: 'Doctor2026safe' });
    expect(d.status).toBe(200);
    expect(d.body.twoFactor).toBe('verify');
    expect(d.headers['set-cookie'] ?? []).not.toEqual(expect.arrayContaining([expect.stringMatching(/^mc_at=/)]));
  });
});
