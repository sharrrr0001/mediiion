import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { ClinicContext, ClinicQueueRow, PatientAccessRequestView, StaffMemberView } from '@medicos/shared';
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

describe('clinic staff (spec §7.4)', () => {
  it('doctor invites staff; staff sign in with 2FA, see queue metadata only, check in a walk-in after the patient allows', async () => {
    const { doctor, phone } = await createDoctorWithClinic(prisma);
    const doc = await doctorLogin(t, phone);
    const email = `staff${Date.now()}@example.test`;
    const invited = (await doc.post('/doctor/staff').send({ email })).body as StaffMemberView[];
    expect(invited).toHaveLength(1);
    expect(invited[0]!.contact).not.toContain(email.split('@')[0]); // masked

    // Staff login: OTP + TOTP enrolment (staff role requires 2FA).
    const staff = request.agent(t.app.getHttpServer());
    const ip = uniqueIp();
    const r = await staff.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'email', email });
    const v = await staff.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(email) });
    expect(v.body.twoFactor).toBe('setup');
    const done = await staff.post('/auth/2fa').send({ ticket: v.body.ticket, code: totp(v.body.secret) });
    expect(done.body.role).toBe('staff');

    const ctx = (await staff.get('/clinic/context')).body as ClinicContext;
    expect(ctx.doctors.map((d) => d.id)).toContain(doctor.id);

    // Walk-in: patient must allow; then the visit is in the clinic queue (no clinical text for staff).
    const p = await patientWithProfile(t);
    const w = (await staff.post('/clinic/walk-ins').send({ medicosId: p.profile.medicosId, doctorId: doctor.id })).body as { requestId: string };
    const prompt = ((await p.agent.get('/access/requests')).body as PatientAccessRequestView[])[0]!;
    expect(prompt.doctor.name).toBe(doctor.name);
    await p.agent.post(`/access/requests/${prompt.id}`).send({ decision: 'allow' });
    expect((await staff.get(`/clinic/walk-ins/${w.requestId}`)).body.status).toBe('allowed');
    const queue = (await staff.get('/clinic/queue')).body as ClinicQueueRow[];
    const row = queue.find((q) => q.medicosId === p.profile.medicosId)!;
    expect(row).toMatchObject({ type: 'walk_in', doctor: doctor.name });
    expect(row).not.toHaveProperty('complaint');

    // Staff cannot open clinical data or patient records (rule 10).
    expect((await staff.get(`/doctor/appointments/${row.appointmentId}`)).status).toBe(403);
    expect((await staff.get(`/doctor/patients/${p.profile.id}`)).status).toBe(403);
    expect((await staff.get('/doctor/queue')).status).toBe(403);

    // Removed staff lose the clinic.
    const userId = invited[0]!.userId;
    expect((await doc.post(`/doctor/staff/${userId}/remove`)).body).toEqual([]);
    expect((await staff.get('/clinic/queue')).status).toBe(403);
  });
});
