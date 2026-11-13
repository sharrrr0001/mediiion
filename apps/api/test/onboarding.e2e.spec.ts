import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { BIDX, ENC } from '@medicos/db';
import type { DoctorCard, OnboardingView, VerificationQueueItem } from '@medicos/shared';
import { totp } from '../src/auth/totp';
import { PrismaService } from '../src/config/core.module';
import { fc, patientWithProfile } from './fixtures';
import { createTestApp, uniqueIp, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64');

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
});
afterAll(async () => {
  await t.app.close();
});

let n = 0;
const uniqueEmail = () => `doc${Date.now()}${++n}@example.test`;

/** Email OTP → session (patient role for new accounts, or a 2FA challenge for staff roles). */
async function emailOtp(email: string) {
  const agent = request.agent(t.app.getHttpServer());
  const ip = uniqueIp();
  const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'email', email });
  expect(r.status, JSON.stringify(r.body)).toBe(201);
  const v = await agent.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(email) });
  return { agent, v };
}

async function staffLogin(email: string) {
  const { agent, v } = await emailOtp(email);
  expect(v.body.twoFactor).toBe('setup');
  expect((await agent.post('/auth/2fa').send({ ticket: v.body.ticket, code: totp(v.body.secret) })).status).toBe(200);
  return agent;
}

const SIGNUP = {
  name: 'Kavya Testrao',
  specialty: 'dermatology',
  city: 'Indore',
  registrationNo: 'MP-99999',
  council: 'Madhya Pradesh Medical Council',
  degrees: ['MBBS', 'MD (Dermatology)'],
  yearsExperience: 6,
  languages: ['en', 'hi'],
};

describe('doctor onboarding (spec §7.2) → admin verification (§7.5) → listed for patients', () => {
  it('signs up by email, needs 2FA, uploads documents, sets clinic + fee, is approved by an admin', async () => {
    const email = uniqueEmail();
    const first = await emailOtp(email);
    expect(first.v.status).toBe(200);
    const signup = await first.agent.post('/doctor-signup').send(SIGNUP);
    expect(signup.status, JSON.stringify(signup.body)).toBe(201);
    // Role changed → old sessions revoked; doctor role needs 2FA from now on.
    expect((await first.agent.get('/me')).status).toBe(401);
    // Skip the 30 s resend wait for the second login with the same email.
    await prisma.otpChallenge.updateMany({ where: { identifierHash: fc().blindIndex(email, BIDX.email) }, data: { createdAt: new Date(Date.now() - 60_000) } });

    const doc = await staffLogin(email);
    let view = (await doc.get('/doctor/onboarding')).body as OnboardingView;
    expect(view).toMatchObject({ status: 'pending', steps: { documents: false, clinic: false } });
    // Pending doctors cannot see patients (rule 10) or request QR access.
    expect((await doc.get('/doctor/queue')).status).toBe(403);

    for (const kind of ['registration_certificate', 'government_id']) {
      const up = await doc.post('/doctor/onboarding/documents').field('kind', kind).attach('file', PNG, 'doc.png');
      expect(up.status, JSON.stringify(up.body)).toBe(201);
    }
    expect((await doc.post('/doctor/onboarding/documents').field('kind', 'degree').attach('file', Buffer.from('MZ not a pdf'), 'x.pdf')).status).toBe(400);
    const clinic = await doc.put('/doctor/onboarding/clinic').send({
      name: 'Testrao Skin Clinic',
      address: '12 Test Lane',
      city: 'Indore',
      area: 'Palasia',
      slotMinutes: 15,
      hours: [1, 2, 3, 4, 5].map((weekday) => ({ weekday, start: '10:00', end: '13:00' })),
      fee: { consult: 700, followUp: 350, modes: ['pay_at_clinic', 'upi'] },
    });
    expect(clinic.status, JSON.stringify(clinic.body)).toBe(200);
    view = (await doc.put('/doctor/onboarding/profile').send({ about: 'Skin and hair clinic.' })).body;
    expect(view.steps).toEqual({ account: true, documents: true, clinic: true, profile: true });

    // Not visible to patients before verification.
    const http = request(t.app.getHttpServer());
    const doctorId = (await prisma.doctor.findFirstOrThrow({ where: { user: { emailHash: fc().blindIndex(email, BIDX.email) } } })).id;
    expect(((await http.get('/doctors')).body as DoctorCard[]).some((d) => d.id === doctorId)).toBe(false);

    // Admin approves from the verification queue.
    const adminEmail = uniqueEmail();
    await prisma.user.create({ data: { emailHash: fc().blindIndex(adminEmail, BIDX.email), emailEnc: fc().encrypt(adminEmail, ENC.email), role: 'admin' } });
    const admin = await staffLogin(adminEmail);
    const queue = (await admin.get('/admin/verifications')).body as VerificationQueueItem[];
    const item = queue.find((q) => q.doctorId === doctorId)!;
    expect(item.documents).toHaveLength(2);
    expect((await admin.post(`/admin/verifications/${doctorId}`).send({ decision: 'reject' })).status).toBe(400); // reason required
    expect((await admin.post(`/admin/verifications/${doctorId}`).send({ decision: 'approve' })).body.status).toBe('verified');

    expect(((await doc.get('/doctor/onboarding')).body as OnboardingView).status).toBe('verified');
    const listed = ((await http.get('/doctors')).body as DoctorCard[]).find((d) => d.id === doctorId);
    expect(listed).toMatchObject({ name: 'Dr. Kavya Testrao', fee: 700, clinic: { name: 'Testrao Skin Clinic', area: 'Palasia' } });
    expect((await doc.get('/doctor/queue')).status).toBe(200);
  });

  it('refuses an account that already has patient profiles; patients and doctors cannot use admin endpoints', async () => {
    const p = await patientWithProfile(t);
    expect((await p.agent.post('/doctor-signup').send(SIGNUP)).status).toBe(409);
    expect((await p.agent.get('/admin/verifications')).status).toBe(403);
  });
});
