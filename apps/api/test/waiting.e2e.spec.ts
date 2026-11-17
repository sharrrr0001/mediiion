import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ClinicWaitingRow, PatientWaitingView } from '@medicos/shared';
import { totp } from '../src/auth/totp';
import { PrismaService } from '../src/config/core.module';
import { createDoctorWithClinic, doctorLogin, patientWithProfile, seedTemplates } from './fixtures';
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

async function staffFor(doc: ReturnType<typeof request.agent>) {
  const email = `desk${Date.now()}${Math.random().toString(36).slice(2, 6)}@example.test`;
  await doc.post('/doctor/staff').send({ email });
  const agent = request.agent(t.app.getHttpServer());
  const ip = uniqueIp();
  const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'email', email });
  const v = await agent.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(email) });
  await agent.post('/auth/2fa').send({ ticket: v.body.ticket, code: totp(v.body.secret) });
  return agent;
}

describe('waiting room: "I have arrived" / "May I come in?"', () => {
  it('patient signals (150 s cooldown, server-side); staff and doctor see it and reply; the patient sees the reply', async () => {
    const { doctor, clinic, phone } = await createDoctorWithClinic(prisma);
    const doc = await doctorLogin(t, phone);
    const desk = await staffFor(doc);
    const p = await patientWithProfile(t);
    const appt = await prisma.appointment.create({ data: { patientProfileId: p.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt: new Date(), type: 'new', status: 'booked', source: 'patient_app' } });

    let today = (await p.agent.get('/waiting/today')).body as PatientWaitingView[];
    expect(today).toHaveLength(1);
    expect(today[0]).toMatchObject({ arrived: false, lastPing: null, nextAllowedAt: null });

    const first = await p.agent.post(`/waiting/${appt.id}/ping`).send({ kind: 'arrived' });
    expect(first.status, JSON.stringify(first.body)).toBe(201);
    expect(first.body).toMatchObject({ arrived: true, lastPing: { kind: 'arrived' } });
    expect((await prisma.appointment.findUniqueOrThrow({ where: { id: appt.id } })).status).toBe('checked_in');

    // No spamming: a second signal inside 150 s is refused with the wait time.
    const spam = await p.agent.post(`/waiting/${appt.id}/ping`).send({ kind: 'may_i_come_in' });
    expect(spam.status).toBe(429);
    expect(spam.body.error.code).toBe('WAITING_TOO_SOON');
    expect(spam.body.error.retryAfterSeconds).toBeGreaterThan(140);
    expect(spam.body.error.retryAfterSeconds).toBeLessThanOrEqual(150);

    // Staff desk and the doctor both see the arrival (metadata only, no health data).
    let board = (await desk.get('/clinic/waiting')).body as ClinicWaitingRow[];
    const row = board.find((r) => r.appointmentId === appt.id)!;
    expect(row).toMatchObject({ kind: 'arrived', medicosId: p.profile.medicosId, reply: null, signalsToday: 1 });
    expect(JSON.stringify(row)).not.toContain('Testsingh');
    expect(((await doc.get('/clinic/waiting')).body as ClinicWaitingRow[]).some((r) => r.appointmentId === appt.id)).toBe(true);

    // Staff: "Doctor is busy".
    board = (await desk.post(`/clinic/waiting/${row.pingId}/reply`).send({ response: 'busy' })).body;
    today = (await p.agent.get('/waiting/today')).body;
    expect(today[0]!.reply).toMatchObject({ response: 'busy', by: 'staff' });

    // After the cooldown the patient may ask again; the old reply no longer answers the new signal.
    await prisma.waitingPing.updateMany({ where: { appointmentId: appt.id }, data: { createdAt: new Date(Date.now() - 151_000) } });
    const again = await p.agent.post(`/waiting/${appt.id}/ping`).send({ kind: 'may_i_come_in' });
    expect(again.status).toBe(201);
    expect(again.body.reply).toBeNull();

    // Doctor: "Please come in".
    const fresh = ((await doc.get('/clinic/waiting')).body as ClinicWaitingRow[]).find((r) => r.appointmentId === appt.id)!;
    expect(fresh).toMatchObject({ kind: 'may_i_come_in', signalsToday: 2, reply: null });
    await doc.post(`/clinic/waiting/${fresh.pingId}/reply`).send({ response: 'come_in' });
    today = (await p.agent.get('/waiting/today')).body;
    expect(today[0]!.reply).toMatchObject({ response: 'come_in', by: 'doctor' });

    // Validation: "wait" needs minutes, "custom" needs text, text is short.
    expect((await desk.post(`/clinic/waiting/${fresh.pingId}/reply`).send({ response: 'wait' })).status).toBe(400);
    expect((await desk.post(`/clinic/waiting/${fresh.pingId}/reply`).send({ response: 'custom' })).status).toBe(400);
    expect((await desk.post(`/clinic/waiting/${fresh.pingId}/reply`).send({ response: 'custom', text: 'x'.repeat(141) })).status).toBe(400);
    expect((await desk.post(`/clinic/waiting/${fresh.pingId}/reply`).send({ response: 'wait', waitMinutes: 10 })).status).toBe(200);

    const audit = await prisma.auditLog.findMany({ where: { entityId: appt.id, action: { startsWith: 'waiting.' } }, select: { action: true } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['waiting.arrived', 'waiting.may_i_come_in', 'waiting.reply.busy', 'waiting.reply.come_in']));
  });

  it('only the patient can signal, only on the visit day; other clinics and doctors cannot see or reply', async () => {
    const a = await createDoctorWithClinic(prisma);
    const b = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    const other = await patientWithProfile(t, 'Sunita Testkumari');
    const appt = await prisma.appointment.create({ data: { patientProfileId: p.profile.id, doctorId: a.doctor.id, clinicId: a.clinic.id, startsAt: new Date(), type: 'new', status: 'booked', source: 'patient_app' } });
    const tomorrow = await prisma.appointment.create({ data: { patientProfileId: p.profile.id, doctorId: a.doctor.id, clinicId: a.clinic.id, startsAt: new Date(Date.now() + 2 * 86_400_000), type: 'new', status: 'booked', source: 'patient_app' } });

    expect((await other.agent.post(`/waiting/${appt.id}/ping`).send({ kind: 'arrived' })).status).toBe(404);
    expect((await p.agent.post(`/waiting/${tomorrow.id}/ping`).send({ kind: 'arrived' })).status).toBe(409);
    await p.agent.post(`/waiting/${appt.id}/ping`).send({ kind: 'arrived' });

    const docB = await doctorLogin(t, b.phone);
    const boardB = (await docB.get('/clinic/waiting')).body as ClinicWaitingRow[];
    expect(boardB.some((r) => r.appointmentId === appt.id)).toBe(false);
    const ping = await prisma.waitingPing.findFirstOrThrow({ where: { appointmentId: appt.id } });
    expect((await docB.post(`/clinic/waiting/${ping.id}/reply`).send({ response: 'come_in' })).status).toBe(404);
    expect((await p.agent.get('/clinic/waiting')).status).toBe(403);
  });
});
