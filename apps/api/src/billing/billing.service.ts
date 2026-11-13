import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Request } from 'express';
import type { Plan } from '@medicos/db';
import { GST_RATE, type BillingOverview, type Checkout, type InvoiceDetail, type InvoiceView, type PlanView } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { PrismaService } from '../config/core.module';
import { ENV, type Env } from '../config/env';
import { ensureSubscription, istMonthStart } from './usage';

const planView = (p: Plan): PlanView => ({
  key: p.key,
  name: p.name,
  monthlyInr: p.monthlyInr,
  yearlyInr: p.yearlyInr,
  maxDoctors: p.maxDoctors,
  summariesIncluded: p.summariesIncluded,
  extraSummaryInr: p.extraSummaryInr,
  staffLogins: p.staffLogins,
  features: p.features,
});

/** Plans, usage, coupons, Razorpay subscriptions and GST invoices (spec §9). */
@Injectable()
export class BillingService {
  private readonly logger = new Logger('Billing');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private get online() {
    return !!(this.env.RAZORPAY_KEY_ID && this.env.RAZORPAY_KEY_SECRET);
  }

  private async clinicFor(user: AuthUser) {
    const d = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!d) throw new AppError(HttpStatus.FORBIDDEN, 'NOT_A_DOCTOR', 'No doctor profile for this account.');
    const clinic = await this.prisma.clinic.findFirst({ where: { ownerDoctorId: d.id }, orderBy: { createdAt: 'asc' } });
    if (!clinic) throw new AppError(HttpStatus.CONFLICT, 'NO_CLINIC', 'Add your clinic first.');
    return { d, clinic };
  }

  private invoiceView(i: { id: string; number: string; amountInr: number; gstInr: number; issuedAt: Date }, plan: string): InvoiceView {
    return { id: i.id, number: i.number, amountInr: i.amountInr, gstInr: i.gstInr, totalInr: i.amountInr + i.gstInr, issuedAt: i.issuedAt.toISOString(), plan };
  }

  async overview(user: AuthUser): Promise<BillingOverview> {
    const { clinic } = await this.clinicFor(user);
    let sub = await ensureSubscription(this.prisma, clinic.id);
    // A coupon trial that ended falls back to Free (no surprise charges).
    if (sub.status === 'trialing' && sub.periodEnd && sub.periodEnd.getTime() < Date.now()) {
      const free = await this.prisma.plan.findUniqueOrThrow({ where: { key: 'free' } });
      sub = await this.prisma.subscription.update({ where: { id: sub.id }, data: { planId: free.id, status: 'active', periodEnd: null }, include: { plan: true } });
    }
    const periodStart = istMonthStart();
    const usage = await this.prisma.usageCounter.findUnique({ where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } } });
    const used = usage?.summaries ?? 0;
    const included = sub.plan.summariesIncluded;
    const percent = included ? Math.round((used / included) * 100) : null;
    const [plans, invoices] = await Promise.all([
      this.prisma.plan.findMany({ where: { active: true }, orderBy: { summariesIncluded: { sort: 'asc', nulls: 'last' } } }),
      this.prisma.invoice.findMany({ where: { subscription: { clinicId: clinic.id } }, include: { subscription: { include: { plan: true } } }, orderBy: { issuedAt: 'desc' }, take: 24 }),
    ]);
    return {
      clinic: { id: clinic.id, name: clinic.name },
      plan: planView(sub.plan),
      status: sub.status as BillingOverview['status'],
      periodEnd: sub.periodEnd?.toISOString() ?? null,
      usage: { used, included, percent, periodStart: periodStart.toISOString() },
      warning: percent === null ? 'none' : percent >= 100 ? 'over' : percent >= 80 ? 'near' : 'none',
      plans: plans.map(planView),
      invoices: invoices.map((i) => this.invoiceView(i, i.subscription.plan.name)),
      onlinePayments: this.online,
    };
  }

  /** Pilot coupon, e.g. PILOT2M = 2 months of Pro free. One coupon trial per clinic. */
  async applyCoupon(user: AuthUser, code: string, req: Request) {
    const { clinic } = await this.clinicFor(user);
    const coupon = await this.prisma.coupon.findUnique({ where: { code } });
    if (!coupon || (coupon.expiresAt && coupon.expiresAt.getTime() < Date.now()) || (coupon.maxUses !== null && coupon.used >= coupon.maxUses)) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'COUPON_INVALID', 'This code is not valid.');
    }
    const used = await this.prisma.auditLog.count({ where: { action: 'billing.coupon', entityId: clinic.id } });
    if (used) throw new AppError(HttpStatus.CONFLICT, 'COUPON_USED', 'A coupon was already used for this clinic.');
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { key: coupon.planKey } });
    const sub = await ensureSubscription(this.prisma, clinic.id);
    const periodEnd = new Date(Date.now() + coupon.freeMonths * 30 * 86_400_000);
    await this.prisma.$transaction([
      this.prisma.subscription.update({ where: { id: sub.id }, data: { planId: plan.id, status: 'trialing', periodEnd } }),
      this.prisma.coupon.update({ where: { id: coupon.id }, data: { used: { increment: 1 } } }),
    ]);
    await this.audit.record({ actor: user, action: 'billing.coupon', entity: 'clinic', entityId: clinic.id, req });
    return this.overview(user);
  }

  /** Razorpay subscription checkout. Without keys, online payment is off (clear message, no fake success). */
  async checkout(user: AuthUser, body: Checkout, req: Request) {
    const { clinic } = await this.clinicFor(user);
    if (!this.online) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENTS_OFF', 'Online payment is not set up yet. Use the pilot code or contact us.');
    const planIds = JSON.parse(this.env.RAZORPAY_PLAN_IDS) as Record<string, string>;
    const rzpPlan = planIds[`${body.planKey}:${body.cycle}`];
    if (!rzpPlan) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'PLAN_NOT_CONFIGURED', 'This plan cannot be bought online yet.');
    const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Basic ${Buffer.from(`${this.env.RAZORPAY_KEY_ID}:${this.env.RAZORPAY_KEY_SECRET}`).toString('base64')}` },
      body: JSON.stringify({ plan_id: rzpPlan, total_count: body.cycle === 'monthly' ? 12 : 1, customer_notify: 1, notes: { clinicId: clinic.id, planKey: body.planKey } }),
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await res.json()) as { id?: string; short_url?: string; error?: { description?: string } };
    if (!res.ok || !json.id || !json.short_url) {
      this.logger.error(`Razorpay subscription create failed: ${res.status} ${json.error?.description ?? ''}`);
      throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'PAYMENT_PROVIDER', 'Payment could not be started. Please try again.');
    }
    await this.audit.record({ actor: user, action: 'billing.checkout', entity: 'clinic', entityId: clinic.id, req });
    return { url: json.short_url, razorpayId: json.id };
  }

  /** Razorpay webhook: HMAC-SHA256 of the raw body with the webhook secret, compared in constant time. */
  verifyWebhook(raw: Buffer | undefined, signature: string | undefined): boolean {
    if (!raw || !signature || !this.env.RAZORPAY_WEBHOOK_SECRET) return false;
    const expected = createHmac('sha256', this.env.RAZORPAY_WEBHOOK_SECRET).update(raw).digest('hex');
    const a = Buffer.from(expected);
    const b = Buffer.from(signature);
    return a.length === b.length && timingSafeEqual(a, b);
  }

  async handleWebhook(event: { event?: string; payload?: { subscription?: { entity?: { id?: string; current_end?: number; notes?: { clinicId?: string; planKey?: string } } }; payment?: { entity?: { amount?: number } } } }) {
    const s = event.payload?.subscription?.entity;
    const clinicId = s?.notes?.clinicId;
    if (!s?.id || !clinicId) return { ok: true, ignored: true };
    const plan = await this.prisma.plan.findUnique({ where: { key: s.notes?.planKey ?? 'pro' } });
    if (!plan) return { ok: true, ignored: true };
    const sub = await ensureSubscription(this.prisma, clinicId);
    const periodEnd = s.current_end ? new Date(s.current_end * 1000) : null;
    switch (event.event) {
      case 'subscription.activated':
      case 'subscription.charged': {
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { planId: plan.id, status: 'active', razorpayId: s.id, periodEnd } });
        if (event.event === 'subscription.charged') {
          // Razorpay amounts are in paise and include GST: split it out for the invoice.
          const total = Math.round((event.payload?.payment?.entity?.amount ?? (plan.monthlyInr ?? 0) * (1 + GST_RATE) * 100) / 100);
          const amount = Math.round(total / (1 + GST_RATE));
          await this.createInvoice(sub.id, amount, total - amount);
        }
        break;
      }
      case 'subscription.halted':
      case 'subscription.pending':
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'past_due' } });
        break;
      case 'subscription.cancelled':
      case 'subscription.completed':
        await this.prisma.subscription.update({ where: { id: sub.id }, data: { status: 'cancelled', periodEnd } });
        break;
      default:
        return { ok: true, ignored: true };
    }
    await this.audit.record({ actor: null, action: `billing.webhook.${event.event}`, entity: 'subscription', entityId: sub.id });
    return { ok: true };
  }

  private async createInvoice(subscriptionId: string, amountInr: number, gstInr: number) {
    const year = new Date().getFullYear();
    const count = await this.prisma.invoice.count({ where: { number: { startsWith: `MED-${year}-` } } });
    return this.prisma.invoice.create({ data: { subscriptionId, number: `MED-${year}-${String(count + 1).padStart(5, '0')}`, amountInr, gstInr } });
  }

  async invoice(user: AuthUser, id: string): Promise<InvoiceDetail> {
    const { d, clinic } = await this.clinicFor(user);
    const i = await this.prisma.invoice.findUnique({ where: { id }, include: { subscription: { include: { plan: true } } } });
    if (!i || i.subscription.clinicId !== clinic.id) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Invoice not found.');
    return {
      ...this.invoiceView(i, i.subscription.plan.name),
      clinic: { name: clinic.name, address: clinic.address, city: clinic.city },
      doctorName: d.name,
      periodNote: `${i.subscription.plan.name} plan`,
      seller: { name: this.env.SELLER_NAME, gstin: this.env.SELLER_GSTIN ?? null, address: this.env.SELLER_ADDRESS },
    };
  }
}
