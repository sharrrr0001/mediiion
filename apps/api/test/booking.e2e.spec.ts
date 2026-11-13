import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import type { AppointmentView, DoctorCard, DoctorProfileView, DoctorQueueRow } from '@medicos/shared';
import { PrismaService } from '../src/config/core.module';
import { createDoctorWithClinic, doctorLogin, finishInterview, firstFreeSlot, patientWithProfile, seedTemplates } from './fixtures';
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

describe('doctor search (rule 3: normal filters, verified only)', () => {
  it('lists verified doctors with fee and next slot, filters by fee/area, hides pending doctors', async () => {
    const { doctor } = await createDoctorWithClinic(prisma);
    const { doctor: pending } = await createDoctorWithClinic(prisma, 'pending');
    const http = request(t.app.getHttpServer());

    const all = (await http.get('/doctors').query({ city: 'indore', area: 'vijay' })).body as DoctorCard[];
    const mine = all.find((d) => d.id === doctor.id);
    expect(mine?.fee).toBe(500);
    expect(mine?.nextSlot).toEqual(expect.any(String));
    expect(all.some((d) => d.id === pending.id)).toBe(false);
    expect(((await http.get('/doctors').query({ maxFee: 100 })).body as DoctorCard[]).some((d) => d.id === doctor.id)).toBe(false);

    const profile = (await http.get(`/doctors/${doctor.id}`)).body as DoctorProfileView;
    expect(profile.clinics[0]?.hours).toHaveLength(7);
    expect((await http.get(`/doctors/${pending.id}`)).status).toBe(404);
    expect((await http.get('/doctors').query({ bogus: 'x' })).status).toBe(400);
  });
});

describe('booking', () => {
  it('doctor-first: books a slot, the slot is then taken, double booking is refused', async () => {
    const { doctor, clinic } = await createDoctorWithClinic(prisma);
    const a = await patientWithProfile(t);
    const startsAt = await firstFreeSlot(t, doctor.id, clinic.id);

    const booked = await a.agent.post('/appointments').send({ profileId: a.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt });
    expect(booked.status).toBe(201);
    expect((booked.body as AppointmentView).status).toBe('booked');

    const b = await patientWithProfile(t, 'Sunita Testkumari');
    const clash = await b.agent.post('/appointments').send({ profileId: b.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt });
    expect(clash.status).toBe(409);

    const offGrid = new Date(new Date(startsAt).getTime() + 7 * 60_000).toISOString();
    expect((await b.agent.post('/appointments').send({ profileId: b.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt: offGrid })).status).toBe(400);

    // Someone else's profile cannot be booked for (rule 10).
    expect((await b.agent.post('/appointments').send({ profileId: a.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt: offGrid })).status).toBe(404);

    const mine = (await a.agent.get('/appointments')).body as AppointmentView[];
    expect(mine.map((x) => x.id)).toContain(booked.body.id);
    const cancelled = await a.agent.post(`/appointments/${booked.body.id}/cancel`);
    expect(cancelled.body.status).toBe('cancelled');
    // A cancelled slot is free again.
    expect((await b.agent.post('/appointments').send({ profileId: b.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt })).status).toBe(201);
  });

  it('AI-first: an interview finished without a doctor is shared only when the patient books', async () => {
    const { doctor, clinic, phone } = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    const sessionId = await finishInterview(p.agent, p.profile.id);

    // Not shared yet: no grant for this doctor.
    expect(await prisma.accessGrant.count({ where: { patientProfileId: p.profile.id, doctorId: doctor.id } })).toBe(0);

    const startsAt = await firstFreeSlot(t, doctor.id, clinic.id);
    const booked = (await p.agent.post('/appointments').send({ profileId: p.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt, sessionId })).body as AppointmentView;
    expect(booked.summaryAttached).toBe(true);
    expect(await prisma.accessGrant.count({ where: { patientProfileId: p.profile.id, doctorId: doctor.id, grantedVia: 'share' } })).toBe(1);

    // Another doctor cannot take an interview already shared with this one.
    const other = await createDoctorWithClinic(prisma);
    const slot2 = await firstFreeSlot(t, other.doctor.id, other.clinic.id);
    expect((await p.agent.post('/appointments').send({ profileId: p.profile.id, doctorId: other.doctor.id, clinicId: other.clinic.id, startsAt: slot2, sessionId })).status).toBe(409);

    // The booked doctor sees it in the queue when the visit is today.
    const doc = await doctorLogin(t, phone);
    const queue = (await doc.get('/doctor/queue')).body as DoctorQueueRow[];
    const sameDay = new Date(startsAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
    if (sameDay) expect(queue.find((r) => r.appointmentId === booked.id)?.status).toBe('ready');
  });
});
