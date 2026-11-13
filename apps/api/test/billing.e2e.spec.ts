import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import type { BillingOverview, InvoiceDetail } from '@medicos/shared';
import { PrismaService } from '../src/config/core.module';
import { createDoctorWithClinic, doctorLogin, finishInterview, patientWithProfile, seedTemplates } from './fixtures';
import { createTestApp, type TestApp } from './helpers';

let t: TestApp;
let prisma: PrismaService;

const PLANS = [
  { key: 'free', name: 'Free', monthlyInr: 0, yearlyInr: null, maxDoctors: 1, summariesIncluded: 30, extraSummaryInr: null, staffLogins: 0, features: ['1_template'] },
  { key: 'pro', name: 'Pro', monthlyInr: 2999, yearlyInr: 29990, maxDoctors: 1, summariesIncluded: 300, extraSummaryInr: 6, staffLogins: 1, features: ['all_templates'] },
];

beforeAll(async () => {
  t = await createTestApp();
  prisma = t.app.get(PrismaService);
  await seedTemplates(prisma);
  for (const p of PLANS) await prisma.plan.upsert({ where: { key: p.key }, update: p, create: p });
  await prisma.coupon.upsert({ where: { code: 'PILOT2M' }, update: {}, create: { code: 'PILOT2M', planKey: 'pro', freeMonths: 2 } });
});
afterAll(async () => {
  await t.app.close();
});

const sign = (body: string) => createHmac('sha256', 'test-webhook-secret').update(body).digest('hex');

describe('billing (spec §9)', () => {
  it('starts on Free, meters delivered summaries, applies the pilot coupon once, refuses checkout without keys', async () => {
    const { doctor, phone } = await createDoctorWithClinic(prisma);
    const doc = await doctorLogin(t, phone);
    let b = (await doc.get('/doctor/billing')).body as BillingOverview;
    expect(b).toMatchObject({ plan: { key: 'free' }, usage: { used: 0, included: 30 }, warning: 'none', onlinePayments: false });

    // A summary counts when it is delivered to the doctor.
    const p = await patientWithProfile(t);
    await finishInterview(p.agent, p.profile.id, doctor.id);
    b = (await doc.get('/doctor/billing')).body;
    expect(b.usage.used).toBe(1);

    b = (await doc.post('/doctor/billing/coupon').send({ code: 'pilot2m' })).body;
    expect(b).toMatchObject({ plan: { key: 'pro' }, status: 'trialing' });
    expect((await doc.post('/doctor/billing/coupon').send({ code: 'PILOT2M' })).status).toBe(409);
    expect((await doc.post('/doctor/billing/coupon').send({ code: 'NOPE123' })).status).toBe(400);
    expect((await doc.post('/doctor/billing/checkout').send({ planKey: 'pro', cycle: 'monthly' })).status).toBe(503);

    // Soft limit: over 100% only warns, never blocks.
    const sub = await prisma.subscription.findFirstOrThrow({ where: { clinic: { ownerDoctorId: doctor.id } } });
    await prisma.usageCounter.updateMany({ where: { subscriptionId: sub.id }, data: { summaries: 301 } });
    expect(((await doc.get('/doctor/billing')).body as BillingOverview).warning).toBe('over');
  });

  it('accepts only signed Razorpay webhooks; a charge activates the plan and issues a GST invoice', async () => {
    const { phone, clinic } = await createDoctorWithClinic(prisma);
    const doc = await doctorLogin(t, phone);
    await doc.get('/doctor/billing'); // creates the Free subscription
    const http = request(t.app.getHttpServer());
    const payload = JSON.stringify({
      event: 'subscription.charged',
      payload: {
        subscription: { entity: { id: `sub_test_${Date.now()}`, current_end: Math.floor(Date.now() / 1000) + 30 * 86400, notes: { clinicId: clinic.id, planKey: 'pro' } } },
        payment: { entity: { amount: 353882 } }, // ₹3,538.82 incl. 18% GST
      },
    });
    const bad = await http.post('/webhooks/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', 'deadbeef').send(payload);
    expect(bad.status).toBe(401);
    const ok = await http.post('/webhooks/razorpay').set('Content-Type', 'application/json').set('x-razorpay-signature', sign(payload)).send(payload);
    expect(ok.status, JSON.stringify(ok.body)).toBe(200);

    const b = (await doc.get('/doctor/billing')).body as BillingOverview;
    expect(b).toMatchObject({ plan: { key: 'pro' }, status: 'active' });
    expect(b.invoices).toHaveLength(1);
    const inv = (await doc.get(`/doctor/billing/invoices/${b.invoices[0]!.id}`)).body as InvoiceDetail;
    expect(inv.number).toMatch(/^MED-\d{4}-\d{5}$/);
    expect(inv.amountInr + inv.gstInr).toBe(3539);
    expect(inv.gstInr).toBe(540);
  });
});
