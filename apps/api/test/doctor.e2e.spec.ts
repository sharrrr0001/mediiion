import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { BUILTIN_TEMPLATES } from '@medicos/ai';
import { BIDX, createFieldCrypto } from '@medicos/db';
import { CONSENT_VERSION, type DoctorQueueRow, type DoctorSummaryView, type IntakeView, type RecordEntryView } from '@medicos/shared';
import { totp } from '../src/auth/totp';
import { PrismaService } from '../src/config/core.module';
import { createTestApp, loginWithPhone, uniqueIp, uniquePhone, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;
const fc = () => createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
  for (const tpl of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { key_version: { key: tpl.key, version: tpl.version } },
      update: {},
      create: { key: tpl.key, specialty: tpl.specialty, version: tpl.version, json: tpl as object, status: 'published' },
    });
  }
});
afterAll(async () => {
  await t.app.close();
});

/** Fictional doctor with a clinic. */
async function createDoctor(status: 'verified' | 'pending' = 'verified') {
  const phone = uniquePhone();
  const user = await prisma.user.create({ data: { phoneHash: fc().blindIndex(phone, BIDX.phone), phoneEnc: fc().encrypt(phone, 'user.phone'), role: 'doctor' } });
  const doctor = await prisma.doctor.create({ data: { userId: user.id, name: `Dr. Test ${phone.slice(-4)}`, specialty: 'general_medicine', degrees: ['MBBS'], languages: ['Hindi'], verificationStatus: status } });
  const clinic = await prisma.clinic.create({ data: { name: `Clinic ${phone.slice(-4)}`, address: '1 Test Road', city: 'Indore', ownerDoctorId: doctor.id } });
  await prisma.clinicMember.create({ data: { clinicId: clinic.id, userId: user.id, role: 'doctor' } });
  return { phone, doctor };
}

/** OTP + TOTP enrolment; returns a signed-in agent and the TOTP secret. */
async function doctorLogin(phone: string, secret?: string) {
  const agent = request.agent(t.app.getHttpServer());
  const ip = uniqueIp();
  const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
  const v = await agent.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(phone) });
  expect(v.status).toBe(200);
  expect(v.headers['set-cookie'] ?? []).not.toEqual(expect.arrayContaining([expect.stringMatching(/^mc_at=/)]));
  const s = secret ?? v.body.secret;
  if (!secret) expect(v.body.twoFactor).toBe('setup');
  else expect(v.body.twoFactor).toBe('verify');
  const code = totp(s);
  const done = await agent.post('/auth/2fa').send({ ticket: v.body.ticket, code });
  return { agent, secret: s as string, done, ticket: v.body.ticket as string, code };
}

async function patientInterviewWith(doctorId: string) {
  const { agent } = await loginWithPhone(t);
  await agent.post('/consents').send({ type: 'data_processing', version: CONSENT_VERSION, agreed: true });
  const profile = (await agent.post('/patients/profiles').send({ name: 'Ramesh Testsingh', age: 46, gender: 'male', city: 'Indore', language: 'hi-Latn' })).body;
  let view = (await agent.post('/intake/sessions').send({ profileId: profile.id, doctorId })).body as IntakeView;
  for (let i = 0; i < 30 && view.awaiting !== 'done'; i++) {
    view = (await agent.post(`/intake/sessions/${view.id}/messages`).send({ text: i === 2 ? 'khana khane ke baad chhati mein jalan, 2 hafte se' : 'Nahi' })).body;
  }
  expect(view.awaiting).toBe('done');
  const submitted = await agent.post(`/intake/sessions/${view.id}/submit`);
  expect(submitted.status).toBe(200);
  return { agent, profile, sessionId: view.id };
}

describe('doctor sign-in with TOTP 2FA', () => {
  it('enrols on first login, then requires the code; a code cannot be replayed', async () => {
    const { phone } = await createDoctor();
    const first = await doctorLogin(phone);
    expect(first.done.status).toBe(200);
    expect((await first.agent.get('/doctor/me')).body.verificationStatus).toBe('verified');

    const replay = await request(t.app.getHttpServer()).post('/auth/2fa').send({ ticket: first.ticket, code: first.code });
    expect(replay.status).toBe(401);

    const user = await prisma.user.findFirstOrThrow({ where: { phoneHash: fc().blindIndex(phone, BIDX.phone) } });
    expect(user.totpSecretEnc).not.toContain(first.secret);
    // Next login asks for verification (no new secret). Move past the used time step first.
    await prisma.user.update({ where: { id: user.id }, data: { totpLastStep: 0 } });
    // The OTP resend wait (30 s) applies per phone; clear the earlier challenge for this test.
    await prisma.otpChallenge.deleteMany({ where: { identifierHash: user.phoneHash! } });
    const second = await doctorLogin(phone, first.secret);
    expect(second.done.status).toBe(200);
  });

  it('rejects a wrong code and an expired/forged ticket', async () => {
    const { phone } = await createDoctor();
    const agent = request.agent(t.app.getHttpServer());
    const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', uniqueIp()).send({ channel: 'sms', phone });
    const v = await agent.post('/auth/otp/verify').send({ challengeId: r.body.challengeId, code: t.outbox.latest(phone) });
    expect((await agent.post('/auth/2fa').send({ ticket: v.body.ticket, code: '000000' })).status).toBe(401);
    expect((await agent.post('/auth/2fa').send({ ticket: 'x'.repeat(40), code: '123456' })).status).toBe(401);
  });

  it('an unverified doctor cannot see patients', async () => {
    const { phone } = await createDoctor('pending');
    const { agent } = await doctorLogin(phone);
    const q = await agent.get('/doctor/queue');
    expect(q.status).toBe(403);
    expect(q.body.error.code).toBe('NOT_VERIFIED');
  });
});

describe('Phase 2 flow: interview → summary → doctor → finalise → record book', () => {
  it('runs end to end with rules 5, 8/9 and 10 enforced', async () => {
    const { phone, doctor } = await createDoctor();
    const patient = await patientInterviewWith(doctor.id);
    const doc = await doctorLogin(phone);

    // Queue shows the patient with a ready summary.
    const queue = (await doc.agent.get('/doctor/queue')).body as DoctorQueueRow[];
    const row = queue.find((r) => r.medicosId === patient.profile.medicosId)!;
    expect(row.status).toBe('ready');
    expect(row.label).toMatch(/^RT · 46 M$/);

    // Summary: S/O only, sourced, no A/P keys (rule 5); name re-inserted only at render.
    const view = (await doc.agent.get(`/doctor/appointments/${row.appointmentId}`)).body as DoctorSummaryView;
    expect(view.summaryStatus).toBe('delivered');
    expect(view.summary?.subjective.historyOfPresentIllness.length).toBeGreaterThanOrEqual(0);
    expect(JSON.stringify(view.summary)).not.toMatch(/"(assessment|plan|diagnosis)"/i);
    expect(view.note).toBeNull();
    const stored = await prisma.preVisitSummary.findFirstOrThrow({ where: { sessionId: patient.sessionId } });
    expect(stored.jsonEnc).not.toMatch(/jalan|Ramesh/);
    expect(stored.openedByDoctorAt).not.toBeNull();

    // Rule 10: another verified doctor cannot open it.
    const other = await createDoctor();
    const otherDoc = await doctorLogin(other.phone);
    expect((await otherDoc.agent.get(`/doctor/appointments/${row.appointmentId}`)).status).toBe(404);
    // Patients cannot use doctor endpoints.
    expect((await patient.agent.get('/doctor/queue')).status).toBe(403);

    // Rule 9: before finalise, the record book has only the AI draft — no clinical note.
    const before = (await patient.agent.get('/records')).body as RecordEntryView[];
    expect(before.map((r) => r.kind)).toEqual(['pre_visit_summary']);

    const fin = await doc.agent.post(`/doctor/appointments/${row.appointmentId}/finalise`).send({
      assessment: 'Doctor-written assessment',
      plan: 'Doctor-written plan',
      followUpDate: '2026-12-01',
      prescription: [{ drug: 'Sample drug A', dose: '1 tab', frequency: 'Twice daily', duration: '5 days', instructions: 'After food' }],
    });
    expect(fin.status, JSON.stringify(fin.body)).toBe(200);
    expect(fin.body.summaryStatus).toBe('reviewed');
    expect(fin.body.note.assessment).toBe('Doctor-written assessment');
    expect((await doc.agent.post(`/doctor/appointments/${row.appointmentId}/finalise`).send({ assessment: 'x', plan: 'y' })).status).toBe(409);

    const after = (await patient.agent.get('/records')).body as RecordEntryView[];
    expect(after.map((r) => r.kind).sort()).toEqual(['doctor_note', 'pre_visit_summary', 'prescription']);
    const noteEntry = after.find((r) => r.kind === 'doctor_note')!;
    const detail = (await patient.agent.get(`/records/${noteEntry.id}`)).body;
    expect(detail.note.plan).toBe('Doctor-written plan');
    expect(detail.note.prescription[0].drug).toBe('Sample drug A');

    // Another patient cannot read this record.
    const stranger = await loginWithPhone(t);
    expect((await stranger.agent.get(`/records/${noteEntry.id}`)).status).toBe(404);

    // Feedback on the summary.
    expect((await doc.agent.post(`/doctor/summaries/${view.summaryId}/feedback`).send({ useful: true })).status).toBe(201);
    const after2 = (await doc.agent.get('/doctor/queue')).body as DoctorQueueRow[];
    expect(after2.find((r) => r.appointmentId === row.appointmentId)?.status).toBe('done');
  });
});
