import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { BUILTIN_TEMPLATES } from '@medicos/ai';
import { BIDX, ENC } from '@medicos/db';
import { totp } from '../src/auth/totp';
import { PrismaService } from '../src/config/core.module';
import { createDoctorWithClinic, doctorLogin, fc, finishInterview, patientWithProfile, seedTemplates } from './fixtures';
import { createTestApp, uniqueIp, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
  await seedTemplates(prisma);
});
afterAll(async () => {
  await t.app.close();
});

async function staffOfRole(role: 'admin' | 'founder' | 'developer') {
  const email = `${role}${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.test`;
  await prisma.user.create({ data: { emailHash: fc().blindIndex(email, BIDX.email), emailEnc: fc().encrypt(email, ENC.email), role } });
  const agent = request.agent(t.app.getHttpServer());
  const ip = uniqueIp();
  const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'email', email });
  const v = await agent.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(email) });
  await agent.post('/auth/2fa').send({ ticket: v.body.ticket, code: totp(v.body.secret) });
  return agent;
}

describe('internal panels (spec §7.5) and insights', () => {
  it('admin sees aggregates and logs; Template Studio rejects unsafe question text and publishes safe versions', async () => {
    const admin = await staffOfRole('admin');
    const o = (await admin.get('/admin/overview')).body;
    expect(o).toHaveProperty('interviewsToday');
    expect(o).toHaveProperty('mrrInr');
    expect(Array.isArray((await admin.get('/admin/audit')).body)).toBe(true);
    expect(Array.isArray((await admin.get('/admin/safety-log')).body)).toBe(true);

    const base = structuredClone(BUILTIN_TEMPLATES[0]!) as unknown as { questions: Array<{ text: Record<string, string> }> };
    const unsafe = structuredClone(base);
    unsafe.questions[0]!.text.en = 'You have a viral infection, take paracetamol 500 mg.';
    const bad = (await admin.post('/admin/templates/check').send({ json: unsafe })).body as { ok: boolean; problems: string[] };
    expect(bad.ok).toBe(false);
    expect((await admin.post('/admin/templates').send({ json: unsafe })).status).toBe(400);

    const draft = await admin.post('/admin/templates').send({ json: base });
    expect(draft.status, JSON.stringify(draft.body)).toBe(201);
    expect((await admin.post(`/admin/templates/${draft.body.id}/publish`)).status).toBe(200);
    const list = (await admin.get('/admin/templates')).body as Array<{ id: string; status: string }>;
    expect(list.find((x) => x.id === draft.body.id)?.status).toBe('published');
  });

  it('founder and developer panels are role-gated; doctors see their own insights; patients see none of it', async () => {
    const founder = await staffOfRole('founder');
    expect((await founder.get('/founder/metrics')).body.weeks).toHaveLength(8);
    expect((await founder.get('/admin/overview')).status).toBe(403);
    const dev = await staffOfRole('developer');
    const s = (await dev.get('/developer/status')).body;
    expect(s.providers.llm).toContain('mock');
    expect((await dev.post('/developer/flags').send({ key: 'whatsapp_reminders', enabled: true })).status).toBe(200);

    const { doctor, phone } = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    await finishInterview(p.agent, p.profile.id, doctor.id);
    const doc = await doctorLogin(t, phone);
    const ins = (await doc.get('/doctor/insights')).body;
    expect(ins.months).toHaveLength(6);
    expect(ins.months[5].summaries).toBe(1);
    expect(ins.minutesSavedEstimate).toBe(4);

    expect((await p.agent.get('/admin/overview')).status).toBe(403);
    expect((await p.agent.get('/developer/status')).status).toBe(403);
    expect((await p.agent.post('/support').send({ subject: 'Cannot see my record' })).status).toBe(201);
  });
});
