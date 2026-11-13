import type { PrismaClient } from '@medicos/db';

const IST_OFFSET_MS = 5.5 * 3600_000;

/** First instant of the current calendar month in IST (billing periods follow Indian months). */
export function istMonthStart(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), 1) - IST_OFFSET_MS);
}

export function nextIstMonthStart(now = new Date()): Date {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth() + 1, 1) - IST_OFFSET_MS);
}

type Db = Pick<PrismaClient, 'subscription' | 'plan' | 'usageCounter' | 'clinic'>;

/** The clinic's subscription; every clinic starts on Free (spec §9). */
export async function ensureSubscription(db: Db, clinicId: string) {
  const existing = await db.subscription.findFirst({ where: { clinicId }, orderBy: { createdAt: 'desc' }, include: { plan: true } });
  if (existing) return existing;
  const free = await db.plan.findUniqueOrThrow({ where: { key: 'free' } });
  return db.subscription.create({ data: { clinicId, planId: free.id, status: 'active', periodEnd: null }, include: { plan: true } });
}

/**
 * Usage metering: a summary counts when it is delivered to the doctor (spec §9). Never blocks care —
 * limits only produce warnings. Safe to call more than once per summary only if callers dedupe; all
 * callers call it exactly when a summary changes to "delivered".
 */
export async function meterDeliveredSummary(db: Db, doctorId: string) {
  const clinic = await db.clinic.findFirst({ where: { OR: [{ ownerDoctorId: doctorId }, { members: { some: { user: { doctor: { id: doctorId } } } } }] }, orderBy: { createdAt: 'asc' }, select: { id: true } });
  if (!clinic) return;
  const sub = await ensureSubscription(db, clinic.id);
  const periodStart = istMonthStart();
  await db.usageCounter.upsert({
    where: { subscriptionId_periodStart: { subscriptionId: sub.id, periodStart } },
    update: { summaries: { increment: 1 } },
    create: { subscriptionId: sub.id, periodStart, summaries: 1 },
  });
}
