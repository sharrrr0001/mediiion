import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { durationDays, nineAmIst, ReminderJobs } from '../src/notify/reminders';
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

async function waitText(to: string, match: RegExp) {
  for (let i = 0; i < 50; i++) {
    const text = t.outbox.latestText(to);
    if (text && match.test(text)) return text;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`no notification matching ${match} for recipient`);
}

describe('reminder maths', () => {
  it('parses durations and schedules at 09:00 IST', () => {
    expect(durationDays('5 days')).toBe(5);
    expect(durationDays('2 weeks')).toBe(14);
    expect(durationDays('3 din')).toBe(3);
    expect(durationDays('6 months')).toBe(30); // capped
    expect(durationDays('as needed')).toBe(0);
    expect(nineAmIst(new Date('2026-11-16T20:00:00Z')).toISOString()).toBe('2026-11-17T03:30:00.000Z');
  });
});

describe('notifications (no health details) and reminders', () => {
  it('notifies the patient on booking and the doctor when a summary is delivered; texts carry no complaint', async () => {
    const { doctor, clinic, phone: doctorPhone } = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    const startsAt = await firstFreeSlot(t, doctor.id, clinic.id);
    await p.agent.post('/appointments').send({ profileId: p.profile.id, doctorId: doctor.id, clinicId: clinic.id, startsAt });
    const booked = await waitText(p.phone, /is booked/);
    expect(booked).toContain(doctor.name);
    expect(booked).toContain('/p/intake/new'); // no interview yet → invite to the AI pre-visit

    await finishInterview(p.agent, p.profile.id, doctor.id);
    const ready = await waitText(doctorPhone, /pre-visit summary is ready/);
    expect(ready).not.toMatch(/jalan|chhati|fever/i);
    const rows = await prisma.notification.findMany({ where: { template: { in: ['patient.booking_confirmed', 'doctor.summary_ready'] } }, orderBy: { createdAt: 'desc' }, take: 5 });
    expect(rows.every((r) => r.status === 'sent')).toBe(true);
  });

  it('a finalised note with medicines and a follow-up creates reminders; the job sends them; patients can turn a kind off', async () => {
    const { doctor, phone } = await createDoctorWithClinic(prisma);
    const p = await patientWithProfile(t);
    await finishInterview(p.agent, p.profile.id, doctor.id);
    const doc = await doctorLogin(t, phone);
    const row = ((await doc.get('/doctor/queue')).body as Array<{ appointmentId: string; medicosId: string }>).find((r) => r.medicosId === p.profile.medicosId)!;
    const followUp = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 10);
    const fin = await doc.post(`/doctor/appointments/${row.appointmentId}/finalise`).send({
      assessment: 'Doctor-written assessment',
      plan: 'Doctor-written plan',
      followUpDate: followUp,
      prescription: [{ drug: 'Sample drug A', dose: '1 tab', frequency: 'Twice daily', duration: '3 days' }],
    });
    expect(fin.status).toBe(200);
    const reminders = (await p.agent.get('/reminders')).body as Array<{ kind: string }>;
    expect(reminders.filter((r) => r.kind === 'medicine')).toHaveLength(3);
    expect(reminders.filter((r) => r.kind === 'follow_up')).toHaveLength(1);

    expect((await p.agent.post('/reminders/off').send({ kind: 'medicine' })).body.turnedOff).toBe(3);
    const jobs = t.app.get(ReminderJobs);
    await jobs.runOnce(new Date(Date.now() + 30 * 86_400_000));
    const text = await waitText(p.phone, /follow-up/);
    expect(text).toContain(doctor.name);
    expect(text).not.toContain('Sample drug');
    expect(await prisma.reminderSchedule.count({ where: { patientProfileId: p.profile.id, enabled: true } })).toBe(0);
  });
});
