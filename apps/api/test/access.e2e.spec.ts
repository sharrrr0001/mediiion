import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import type { AccessGrantView, DoctorAccessRequestView, DoctorPatientView, DoctorQueueRow, PatientAccessRequestView, RecordEntryView } from '@medicos/shared';
import { PrismaService } from '../src/config/core.module';
import { createDoctorWithClinic, doctorLogin, finishInterview, patientWithProfile, seedTemplates } from './fixtures';
import { createTestApp, type TestApp } from './helpers';

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

describe('QR access (rule 10): scan → Allow / Deny → 24 h grant', () => {
  it('Phase 4 journey: AI interview → clinic QR → allow → walk-in queue → finalise → record book → revoke', async () => {
    const { doctor, phone } = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    await finishInterview(p.agent, p.profile.id); // AI first, no doctor chosen yet
    const doc = await doctorLogin(t, phone);

    // Doctor scans the Medicos ID: no patient data until the patient allows.
    const req = (await doc.post('/doctor/access-requests').send({ medicosId: p.profile.medicosId.toLowerCase() })).body as DoctorAccessRequestView;
    expect(req.status).toBe('pending');
    expect(req.patient).toBeNull();
    expect((await doc.get(`/doctor/patients/${p.profile.id}`)).status).toBe(404);

    // Patient sees the prompt with the doctor's name and 24 h duration, then allows.
    const prompts = (await p.agent.get('/access/requests')).body as PatientAccessRequestView[];
    expect(prompts[0]).toMatchObject({ id: req.id, doctor: { name: doctor.name }, grantHours: 24 });
    expect((await p.agent.post(`/access/requests/${req.id}`).send({ decision: 'allow' })).body.status).toBe('allowed');
    expect((await p.agent.post(`/access/requests/${req.id}`).send({ decision: 'allow' })).status).toBe(409);

    const after = (await doc.get(`/doctor/access-requests/${req.id}`)).body as DoctorAccessRequestView;
    expect(after.status).toBe('allowed');
    expect(after.patient?.profileId).toBe(p.profile.id);
    const record = (await doc.get(`/doctor/patients/${p.profile.id}`)).body as DoctorPatientView;
    expect(record.entries.map((e) => e.kind)).toContain('pre_visit_summary');

    // Walk-in appears in today's queue with the earlier interview's summary attached.
    const row = ((await doc.get('/doctor/queue')).body as DoctorQueueRow[]).find((r) => r.medicosId === p.profile.medicosId)!;
    expect(row).toMatchObject({ type: 'walk_in', status: 'ready' });

    const fin = await doc.post(`/doctor/appointments/${row.appointmentId}/finalise`).send({ assessment: 'Doctor-written assessment', plan: 'Doctor-written plan' });
    expect(fin.status, JSON.stringify(fin.body)).toBe(200);
    const book = (await p.agent.get('/records')).body as RecordEntryView[];
    expect(book.map((e) => e.kind)).toContain('doctor_note');

    // The patient sees and revokes the grant; the doctor loses access at once.
    const grants = (await p.agent.get('/access/grants')).body as AccessGrantView[];
    const qr = grants.find((g) => g.via === 'qr_prompt')!;
    expect(qr.active).toBe(true);
    expect((await p.agent.post(`/access/grants/${qr.id}/revoke`)).status).toBe(200);
    expect((await doc.get(`/doctor/patients/${p.profile.id}`)).status).toBe(404);

    const audit = await prisma.auditLog.findMany({ where: { patientProfileId: p.profile.id, action: { startsWith: 'access.' } }, select: { action: true } });
    expect(audit.map((a) => a.action)).toEqual(expect.arrayContaining(['access.request', 'access.allow', 'access.revoke']));
  });

  it('deny gives no access; expired prompts cannot be answered; other patients cannot answer', async () => {
    const { phone } = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    const other = await patientWithProfile(t, 'Sunita Testkumari');
    const doc = await doctorLogin(t, phone);

    const r1 = (await doc.post('/doctor/access-requests').send({ medicosId: p.profile.medicosId })).body as DoctorAccessRequestView;
    expect((await other.agent.post(`/access/requests/${r1.id}`).send({ decision: 'allow' })).status).toBe(404);
    expect((await p.agent.post(`/access/requests/${r1.id}`).send({ decision: 'deny' })).body.status).toBe('denied');
    expect(((await doc.get(`/doctor/access-requests/${r1.id}`)).body as DoctorAccessRequestView).patient).toBeNull();
    expect((await doc.get(`/doctor/patients/${p.profile.id}`)).status).toBe(404);

    const r2 = (await doc.post('/doctor/access-requests').send({ medicosId: p.profile.medicosId })).body as DoctorAccessRequestView;
    await prisma.accessRequest.update({ where: { id: r2.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    expect((await p.agent.post(`/access/requests/${r2.id}`).send({ decision: 'allow' })).status).toBe(409);
    expect(((await doc.get(`/doctor/access-requests/${r2.id}`)).body as DoctorAccessRequestView).status).toBe('expired');

    expect((await doc.post('/doctor/access-requests').send({ medicosId: 'MED-0000' })).status).toBe(400);
    // A patient account cannot use the doctor endpoint.
    expect((await p.agent.post('/doctor/access-requests').send({ medicosId: other.profile.medicosId })).status).toBe(403);
  });
});
