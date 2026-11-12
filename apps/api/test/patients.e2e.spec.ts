import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { CONSENT_VERSION, isValidMedicosId } from '@medicos/shared';
import { PrismaService } from '../src/config/core.module';
import { createTestApp, loginWithPhone, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

// Fictional test person (spec §15 style). Must never appear in logs or plaintext columns.
const PROFILE = { name: 'Rahul Testwala', age: 28, gender: 'male', city: 'Indore', language: 'hi-Latn' };
const consent = { type: 'data_processing', version: CONSENT_VERSION, agreed: true };

describe('patient onboarding: consent → profile → Medicos ID', () => {
  it('requires consent before a profile can be created', async () => {
    const { agent } = await loginWithPhone(t);
    const res = await agent.post('/patients/profiles').send(PROFILE);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('CONSENT_REQUIRED');
  });

  it('creates a consent record with version + timestamp, then a profile with a valid Medicos ID', async () => {
    const { agent } = await loginWithPhone(t);
    expect((await agent.post('/consents').send({ ...consent, agreed: false })).status).toBe(400);
    expect((await agent.post('/consents').send(consent)).status).toBe(201);

    const me1 = await agent.get('/me');
    expect(me1.body.needsConsent).toBe(false);
    const stored = await prisma.consent.findFirst({ where: { userId: me1.body.user.id } });
    expect(stored?.version).toBe(CONSENT_VERSION);
    expect(stored?.grantedAt).toBeInstanceOf(Date);

    const created = await agent.post('/patients/profiles').send(PROFILE);
    expect(created.status).toBe(201);
    expect(isValidMedicosId(created.body.medicosId)).toBe(true);
    expect(created.body.name).toBe(PROFILE.name);
    expect(created.body.isPrimary).toBe(true);

    const me2 = await agent.get('/me');
    expect(me2.body.needsProfile).toBe(false);
    expect(me2.body.profiles).toHaveLength(1);

    const fetched = await agent.get(`/patients/profiles/${created.body.id}`);
    expect(fetched.status).toBe(200);
    expect(fetched.body.medicosId).toBe(created.body.medicosId);
  });

  it('encrypts the name at rest', async () => {
    const { agent } = await loginWithPhone(t);
    await agent.post('/consents').send(consent);
    const created = await agent.post('/patients/profiles').send(PROFILE);
    const row = await prisma.patientProfile.findUniqueOrThrow({ where: { id: created.body.id } });
    expect(row.nameEnc).not.toContain('Rahul');
    expect(row.nameEnc.startsWith('v1.')).toBe(true);
  });

  it("returns 404 (not 403) for another patient's profile — rule 10", async () => {
    const a = await loginWithPhone(t);
    await a.agent.post('/consents').send(consent);
    const created = await a.agent.post('/patients/profiles').send(PROFILE);

    const b = await loginWithPhone(t);
    const res = await b.agent.get(`/patients/profiles/${created.body.id}`);
    expect(res.status).toBe(404);
  });
});

describe('audit log', () => {
  it('records reads of patient data', async () => {
    const { agent } = await loginWithPhone(t);
    await agent.post('/consents').send(consent);
    const created = await agent.post('/patients/profiles').send(PROFILE);
    await agent.get(`/patients/profiles/${created.body.id}`);
    const rows = await prisma.auditLog.findMany({ where: { patientProfileId: created.body.id } });
    expect(rows.map((r) => r.action)).toEqual(expect.arrayContaining(['patient_profile.create', 'patient_profile.read']));
    for (const r of rows) expect(r.ipHash ?? '').not.toMatch(/\d+\.\d+\.\d+\.\d+/);
  });

  it('is append-only at the database level', async () => {
    const row = await prisma.auditLog.findFirstOrThrow();
    await expect(prisma.auditLog.update({ where: { id: row.id }, data: { action: 'tampered' } })).rejects.toThrow(/append-only/);
    await expect(prisma.auditLog.delete({ where: { id: row.id } })).rejects.toThrow(/append-only/);
    await expect(prisma.$executeRawUnsafe('TRUNCATE "AuditLog"')).rejects.toThrow(/append-only/);
  });
});

describe('no PHI in logs (spec §13)', () => {
  it('never writes the patient name, phone or OTP to log output', async () => {
    const { agent, phone } = await loginWithPhone(t);
    await agent.post('/consents').send(consent);
    await agent.post('/patients/profiles').send(PROFILE);
    await agent.get('/me');
    const code = t.outbox.latest(phone)!;
    const logs = t.logs();
    expect(logs.length).toBeGreaterThan(100);
    expect(logs).not.toContain(PROFILE.name);
    expect(logs).not.toContain('Rahul');
    expect(logs).not.toContain(phone.slice(3));
    expect(logs).not.toMatch(new RegExp(`"${code}"`));
    expect(logs).not.toContain('mc_at=');
  });
});
