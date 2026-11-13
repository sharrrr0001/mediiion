import { Controller, Get, Global, HttpCode, HttpStatus, Inject, Injectable, Logger, Module, Post, Body, type OnApplicationBootstrap, type OnModuleDestroy } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { z } from 'zod';
import { AuthModule } from '../auth/auth.module';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { PrismaService } from '../config/core.module';
import { ENV, type Env } from '../config/env';
import { NotifyService, fmtIst } from './notify.service';

const IST_OFFSET_MS = 5.5 * 3600_000;
const HOUR = 3600_000;
const MAX_MEDICINE_DAYS = 30;

/** 09:00 IST on the IST calendar day of `d` plus `addDays`. */
export function nineAmIst(d: Date, addDays = 0): Date {
  const ist = new Date(d.getTime() + IST_OFFSET_MS);
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + addDays, 9, 0) - IST_OFFSET_MS);
}

/** "5 days", "2 weeks", "1 month", "10" → days (capped). Unknown → 0 (no reminder rather than a wrong one). */
export function durationDays(text: string): number {
  const m = /(\d+)\s*(day|din|week|hafte|month|mahin)?/i.exec(text);
  if (!m) return 0;
  const n = Number(m[1]);
  const unit = (m[2] ?? 'day').toLowerCase();
  const days = unit.startsWith('week') || unit.startsWith('hafte') ? n * 7 : unit.startsWith('month') || unit.startsWith('mahin') ? n * 30 : n;
  return Math.min(MAX_MEDICINE_DAYS, Math.max(0, days));
}

/** Creates ReminderSchedule rows for visits, freshness checks, follow-ups and medicines (spec §6.6, §7.1 #13). */
@Injectable()
export class ReminderPlanner {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
  ) {}

  async onBooked(appointmentId: string) {
    const a = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { doctor: true, clinic: true, patientProfile: true, intakeSessions: { where: { status: 'submitted' }, orderBy: { submittedAt: 'desc' }, take: 1 } } });
    if (!a) return;
    const session = a.intakeSessions[0];
    this.notify.fire(a.patientProfile.ownerUserId, { key: 'patient.booking_confirmed', doctor: a.doctor.name, when: fmtIst(a.startsAt), clinic: a.clinic.name, needsInterview: !session });
    await this.prisma.reminderSchedule.deleteMany({ where: { refId: a.id, kind: { in: ['visit', 'freshness'] } } });
    const rows: Array<{ kind: string; nextAt: Date }> = [];
    const dayBefore = new Date(a.startsAt.getTime() - 24 * HOUR);
    if (dayBefore.getTime() > Date.now() + HOUR) rows.push({ kind: 'visit', nextAt: dayBefore });
    // Freshness (spec §6.6): interview 2+ days before the slot → ask 12 h before if anything changed.
    if (session?.submittedAt && a.startsAt.getTime() - session.submittedAt.getTime() >= 48 * HOUR) {
      const at = new Date(a.startsAt.getTime() - 12 * HOUR);
      if (at.getTime() > Date.now()) rows.push({ kind: 'freshness', nextAt: at });
    }
    if (rows.length) await this.prisma.reminderSchedule.createMany({ data: rows.map((r) => ({ patientProfileId: a.patientProfileId, refId: a.id, ...r })) });
  }

  async onFinalised(appointmentId: string) {
    const a = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { notes: { where: { finalisedAt: { not: null } }, include: { prescriptions: { include: { items: true } } }, orderBy: { finalisedAt: 'desc' }, take: 1 } } });
    const note = a?.notes[0];
    if (!a || !note) return;
    const rows: Array<{ kind: string; nextAt: Date }> = [];
    if (note.followUpDate) {
      const at = nineAmIst(note.followUpDate, -1);
      if (at.getTime() > Date.now()) rows.push({ kind: 'follow_up', nextAt: at });
    }
    const days = Math.max(0, ...note.prescriptions.flatMap((p) => p.items.map((i) => durationDays(i.duration))));
    for (let d = 1; d <= days; d++) rows.push({ kind: 'medicine', nextAt: nineAmIst(new Date(), d) });
    if (rows.length) await this.prisma.reminderSchedule.createMany({ data: rows.map((r) => ({ patientProfileId: a.patientProfileId, refId: a.id, ...r })) });
  }

  async onSummaryDelivered(doctorId: string) {
    const d = await this.prisma.doctor.findUnique({ where: { id: doctorId }, select: { userId: true } });
    if (d) this.notify.fire(d.userId, { key: 'doctor.summary_ready' });
  }
}

/** Sends due reminders every minute. One runner at a time across processes (Postgres advisory lock). */
@Injectable()
export class ReminderJobs implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger('Jobs');
  private timer: ReturnType<typeof setInterval> | undefined;
  constructor(
    private readonly prisma: PrismaService,
    private readonly notify: NotifyService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onApplicationBootstrap() {
    if (!this.env.JOBS_ENABLED) return;
    this.timer = setInterval(() => void this.runOnce().catch((e: unknown) => this.logger.warn(`jobs: ${e instanceof Error ? e.message.slice(0, 120) : 'error'}`)), 60_000);
  }
  onModuleDestroy() {
    clearInterval(this.timer);
  }

  async runOnce(now = new Date()): Promise<number> {
    const rows = await this.prisma.$queryRaw<Array<{ locked: boolean }>>`SELECT pg_try_advisory_lock(424242) AS locked`;
    if (!rows[0]?.locked) return 0;
    try {
      const due = await this.prisma.reminderSchedule.findMany({ where: { enabled: true, nextAt: { lte: now } }, orderBy: { nextAt: 'asc' }, take: 100 });
      let sent = 0;
      for (const r of due) {
        const profile = await this.prisma.patientProfile.findUnique({ where: { id: r.patientProfileId } });
        const appt = r.refId ? await this.prisma.appointment.findUnique({ where: { id: r.refId }, include: { doctor: true, intakeSessions: { where: { status: 'submitted' }, take: 1 } } }) : null;
        const live = appt && ['booked', 'confirmed'].includes(appt.status);
        if (profile && !profile.deletedAt) {
          if (r.kind === 'visit' && appt && live) this.notify.fire(profile.ownerUserId, { key: 'patient.visit_reminder', doctor: appt.doctor.name, when: fmtIst(appt.startsAt), needsInterview: !appt.intakeSessions.length });
          else if (r.kind === 'freshness' && appt && live) this.notify.fire(profile.ownerUserId, { key: 'patient.freshness', when: fmtIst(appt.startsAt) });
          else if (r.kind === 'follow_up' && appt) this.notify.fire(profile.ownerUserId, { key: 'patient.follow_up', doctor: appt.doctor.name });
          else if (r.kind === 'medicine') this.notify.fire(profile.ownerUserId, { key: 'patient.medicine' });
          sent++;
        }
        await this.prisma.reminderSchedule.delete({ where: { id: r.id } });
      }
      return sent;
    } finally {
      await this.prisma.$queryRaw`SELECT pg_advisory_unlock(424242)`;
    }
  }
}

const ReminderKind = z.object({ kind: z.enum(['medicine', 'follow_up', 'visit', 'freshness']) }).strict();

/** Patients see upcoming reminders and can turn a kind off (spec §7.1 #13). */
@ApiTags('reminders')
@Roles('patient')
@Controller('reminders')
export class RemindersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    const rows = await this.prisma.reminderSchedule.findMany({ where: { enabled: true, nextAt: { gte: new Date() }, patientProfileId: { in: (await this.prisma.patientProfile.findMany({ where: { ownerUserId: user.id }, select: { id: true } })).map((p) => p.id) } }, orderBy: { nextAt: 'asc' }, take: 50 });
    return rows.map((r) => ({ id: r.id, kind: r.kind, nextAt: r.nextAt.toISOString() }));
  }

  @Post('off')
  @HttpCode(HttpStatus.OK)
  @ZodBody(ReminderKind)
  async off(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ReminderKind)) body: { kind: string }) {
    const ids = (await this.prisma.patientProfile.findMany({ where: { ownerUserId: user.id }, select: { id: true } })).map((p) => p.id);
    const { count } = await this.prisma.reminderSchedule.updateMany({ where: { patientProfileId: { in: ids }, kind: body.kind, enabled: true }, data: { enabled: false } });
    return { ok: true, turnedOff: count };
  }
}

@Global()
@Module({ imports: [AuthModule], controllers: [RemindersController], providers: [NotifyService, ReminderPlanner, ReminderJobs], exports: [NotifyService, ReminderPlanner, ReminderJobs] })
export class NotifyModule {}
