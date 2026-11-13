import { expect } from 'vitest';
import request from 'supertest';
import { BUILTIN_TEMPLATES } from '@medicos/ai';
import { BIDX, createFieldCrypto } from '@medicos/db';
import { CONSENT_VERSION, type IntakeView } from '@medicos/shared';
import { totp } from '../src/auth/totp';
import { PrismaService } from '../src/config/core.module';
import { loginWithPhone, uniqueIp, uniquePhone, type TestApp } from './helpers';

/** Shared fictional fixtures for API tests (spec §15: never real people). */
export const fc = () => createFieldCrypto(process.env.FIELD_ENCRYPTION_KEY, process.env.BLIND_INDEX_KEY);

export async function seedTemplates(prisma: PrismaService) {
  for (const tpl of BUILTIN_TEMPLATES) {
    await prisma.template.upsert({
      where: { key_version: { key: tpl.key, version: tpl.version } },
      update: {},
      create: { key: tpl.key, specialty: tpl.specialty, version: tpl.version, json: tpl as object, status: 'published' },
    });
  }
}

/** Verified fictional doctor with a clinic open every day 00:00–23:45 IST (15-minute slots) and a fee. */
export async function createDoctorWithClinic(prisma: PrismaService, status: 'verified' | 'pending' = 'verified') {
  const phone = uniquePhone();
  const user = await prisma.user.create({ data: { phoneHash: fc().blindIndex(phone, BIDX.phone), phoneEnc: fc().encrypt(phone, 'user.phone'), role: 'doctor' } });
  const doctor = await prisma.doctor.create({
    data: { userId: user.id, name: `Dr. Test ${phone.slice(-4)}`, specialty: 'general_medicine', degrees: ['MBBS'], languages: ['hi', 'en'], verificationStatus: status },
  });
  const clinic = await prisma.clinic.create({ data: { name: `Clinic ${phone.slice(-4)}`, address: '1 Test Road', city: 'Indore', area: 'Vijay Nagar', ownerDoctorId: doctor.id } });
  await prisma.clinicMember.create({ data: { clinicId: clinic.id, userId: user.id, role: 'doctor' } });
  await prisma.schedule.createMany({ data: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ doctorId: doctor.id, clinicId: clinic.id, weekday, start: '00:00', end: '23:45', slotMinutes: 15 })) });
  await prisma.fee.create({ data: { doctorId: doctor.id, clinicId: clinic.id, consult: 500, followUp: 250, modes: ['pay_at_clinic'] } });
  return { phone, user, doctor, clinic };
}

export async function doctorLogin(t: TestApp, phone: string) {
  const agent = request.agent(t.app.getHttpServer());
  const ip = uniqueIp();
  const r = await agent.post('/auth/otp/request').set('X-Forwarded-For', ip).send({ channel: 'sms', phone });
  const v = await agent.post('/auth/otp/verify').set('X-Forwarded-For', ip).send({ challengeId: r.body.challengeId, code: t.outbox.latest(phone) });
  expect(v.body.twoFactor).toBe('setup');
  const done = await agent.post('/auth/2fa').send({ ticket: v.body.ticket, code: totp(v.body.secret) });
  expect(done.status).toBe(200);
  return agent;
}

export async function patientWithProfile(t: TestApp, name = 'Ramesh Testsingh') {
  const { agent, phone } = await loginWithPhone(t);
  await agent.post('/consents').send({ type: 'data_processing', version: CONSENT_VERSION, agreed: true });
  const profile = (await agent.post('/patients/profiles').send({ name, age: 46, gender: 'male', city: 'Indore', language: 'hi-Latn' })).body as { id: string; medicosId: string };
  return { agent, phone, profile };
}

/** Runs a full scripted interview and submits it; `doctorId` = doctor-first order. */
export async function finishInterview(agent: ReturnType<typeof request.agent>, profileId: string, doctorId?: string) {
  let view = (await agent.post('/intake/sessions').send({ profileId, ...(doctorId ? { doctorId } : {}) })).body as IntakeView;
  for (let i = 0; i < 30 && view.awaiting !== 'done'; i++) {
    view = (await agent.post(`/intake/sessions/${view.id}/messages`).send({ text: i === 2 ? 'khana khane ke baad chhati mein jalan, 2 hafte se' : 'Nahi' })).body;
  }
  expect(view.awaiting).toBe('done');
  expect((await agent.post(`/intake/sessions/${view.id}/submit`)).status).toBe(200);
  return view.id;
}

/** First free slot from now (IST) for a doctor's clinic. */
export async function firstFreeSlot(t: TestApp, doctorId: string, clinicId: string): Promise<string> {
  for (let d = 0; d < 3; d++) {
    const date = new Date(Date.now() + 5.5 * 3600_000 + d * 86_400_000).toISOString().slice(0, 10);
    const r = await request(t.app.getHttpServer()).get(`/doctors/${doctorId}/slots`).query({ clinicId, date });
    const free = (r.body.slots as Array<{ startsAt: string; free: boolean }>).find((s) => s.free);
    if (free) return free.startsAt;
  }
  throw new Error('no free slot');
}
