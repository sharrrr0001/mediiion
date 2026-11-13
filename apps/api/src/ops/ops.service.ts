import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { IntakeTemplate, checkOutput } from '@medicos/ai';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { PrismaService } from '../config/core.module';
import { ENV, type Env } from '../config/env';
import { istDayRange } from '../doctor/doctor.service';
import { istMonthStart } from '../billing/usage';
import { ReminderJobs } from '../notify/reminders';

const DAY = 86_400_000;
const LANGS = ['en', 'hi', 'hi-Latn'] as const;

/**
 * Internal panels (spec §7.5) and doctor Insights (§7.3). Everything here is aggregate or de-identified:
 * no names, phones or message text. Stored summaries keep [PATIENT] tokens, so quality review sees them
 * de-identified.
 */
@Injectable()
export class OpsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly jobs: ReminderJobs,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private async mrr() {
    const subs = await this.prisma.subscription.findMany({ where: { status: 'active' }, include: { plan: true } });
    return subs.reduce((sum, s) => sum + (s.plan.monthlyInr ?? 0), 0);
  }

  async adminOverview() {
    const [from, to] = istDayRange();
    const weekAgo = new Date(Date.now() - 7 * DAY);
    const [interviewsToday, started7, submitted7, delivered7, openedBefore7, safetyToday, activeDoctors, pendingDoctors, mrr, openTickets] = await Promise.all([
      this.prisma.intakeSession.count({ where: { startedAt: { gte: from, lt: to } } }),
      this.prisma.intakeSession.count({ where: { startedAt: { gte: weekAgo } } }),
      this.prisma.intakeSession.count({ where: { startedAt: { gte: weekAgo }, status: 'submitted' } }),
      this.prisma.preVisitSummary.count({ where: { deliveredAt: { gte: weekAgo } } }),
      this.prisma.preVisitSummary.count({ where: { deliveredAt: { gte: weekAgo }, openedByDoctorAt: { not: null } } }),
      this.prisma.safetyEvent.count({ where: { shownAt: { gte: from, lt: to } } }),
      this.prisma.doctor.count({ where: { verificationStatus: 'verified' } }),
      this.prisma.doctor.count({ where: { verificationStatus: 'pending' } }),
      this.mrr(),
      this.prisma.supportTicket.count({ where: { status: 'open' } }),
    ]);
    return {
      interviewsToday,
      completionRate7d: started7 ? Math.round((submitted7 / started7) * 100) : null,
      summariesOpenedBeforeVisit7d: delivered7 ? Math.round((openedBefore7 / delivered7) * 100) : null,
      safetyMessagesToday: safetyToday,
      activeDoctors,
      pendingDoctors,
      mrrInr: mrr,
      openTickets,
    };
  }

  async safetyLog() {
    const rows = await this.prisma.safetyEvent.findMany({ orderBy: { shownAt: 'desc' }, take: 100, include: { session: { select: { templateId: true, doctorId: true } } } });
    return rows.map((r) => ({ id: r.id, sessionId: r.sessionId, template: r.session.templateId, matchedTerms: r.matchedTerms, shownAt: r.shownAt.toISOString(), clinicSeenAt: r.clinicSeenAt?.toISOString() ?? null, sentToDoctor: !!r.session.doctorId }));
  }

  async auditLog(action?: string) {
    const rows = await this.prisma.auditLog.findMany({ where: action ? { action: { startsWith: action } } : {}, orderBy: { at: 'desc' }, take: 200 });
    return rows.map((r) => ({ id: r.id, at: r.at.toISOString(), actorRole: r.actorRole, actorUserId: r.actorUserId, action: r.action, entity: r.entity, entityId: r.entityId, patientProfileId: r.patientProfileId }));
  }

  /** Low-rated or flagged summaries, de-identified (spec §7.5 quality review queue). */
  async qualityQueue() {
    const rows = await this.prisma.summaryFeedback.findMany({
      where: { OR: [{ useful: false }, { issues: { isEmpty: false } }] },
      orderBy: { createdAt: 'desc' },
      take: 50,
      include: { summary: { select: { id: true, version: true, session: { select: { templateId: true, language: true } } } } },
    });
    return rows.map((f) => ({ id: f.id, summaryId: f.summary.id, template: f.summary.session.templateId, language: f.summary.session.language, useful: f.useful, issues: f.issues, comment: f.comment, createdAt: f.createdAt.toISOString() }));
  }

  // ───────────── Template Studio ─────────────

  async templates() {
    const rows = await this.prisma.template.findMany({ orderBy: [{ key: 'asc' }, { version: 'desc' }] });
    return rows.map((t) => ({ id: t.id, key: t.key, specialty: t.specialty, version: t.version, status: t.status, createdAt: t.createdAt.toISOString() }));
  }

  async template(id: string) {
    const t = await this.prisma.template.findUnique({ where: { id } });
    if (!t) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found.');
    return { id: t.id, key: t.key, version: t.version, status: t.status, json: t.json };
  }

  /** Schema + safety check every question (they double as the safe fallback text, rule 6). */
  checkTemplate(json: unknown): { ok: boolean; problems: string[] } {
    const parsed = IntakeTemplate.safeParse(json);
    if (!parsed.success) return { ok: false, problems: parsed.error.issues.slice(0, 20).map((i) => `${i.path.join('.')}: ${i.message}`) };
    const problems: string[] = [];
    for (const q of parsed.data.questions) {
      for (const l of LANGS) {
        const r = checkOutput(q.text[l]);
        if (!r.ok) problems.push(`${q.id} (${l}): blocked by ${r.rules.join(', ')}`);
      }
    }
    return { ok: problems.length === 0, problems };
  }

  async saveDraft(user: AuthUser, json: unknown, req: Request) {
    const check = this.checkTemplate(json);
    if (!check.ok) throw new AppError(HttpStatus.BAD_REQUEST, 'TEMPLATE_INVALID', check.problems.join('; '));
    const t = IntakeTemplate.parse(json);
    const latest = await this.prisma.template.findFirst({ where: { key: t.key }, orderBy: { version: 'desc' } });
    const version = (latest?.version ?? 0) + 1;
    const row = await this.prisma.template.create({ data: { key: t.key, specialty: t.specialty, version, json: { ...t, version } as object, status: 'draft' } });
    await this.audit.record({ actor: user, action: 'template.draft', entity: 'template', entityId: row.id, req });
    return { id: row.id, version };
  }

  async publish(user: AuthUser, id: string, req: Request) {
    const t = await this.prisma.template.findUnique({ where: { id } });
    if (!t) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Template not found.');
    const check = this.checkTemplate(t.json);
    if (!check.ok) throw new AppError(HttpStatus.BAD_REQUEST, 'TEMPLATE_INVALID', check.problems.join('; '));
    await this.prisma.template.update({ where: { id }, data: { status: 'published', publishedBy: user.id } });
    await this.audit.record({ actor: user, action: 'template.publish', entity: 'template', entityId: id, req });
    return { ok: true };
  }

  // ───────────── Support ─────────────

  async createTicket(user: AuthUser, subject: string) {
    const t = await this.prisma.supportTicket.create({ data: { userId: user.id, subject } });
    return { id: t.id, status: t.status };
  }

  async tickets() {
    const rows = await this.prisma.supportTicket.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((t) => ({ id: t.id, subject: t.subject, status: t.status, createdAt: t.createdAt.toISOString() }));
  }

  async closeTicket(user: AuthUser, id: string, req: Request) {
    await this.prisma.supportTicket.update({ where: { id }, data: { status: 'closed' } });
    await this.audit.record({ actor: user, action: 'support.close', entity: 'support_ticket', entityId: id, req });
    return { ok: true };
  }

  // ───────────── Founder ─────────────

  async founderMetrics() {
    const since = new Date(Date.now() - 56 * DAY);
    const [mrr, subs, activeClinics, summaries, usage] = await Promise.all([
      this.mrr(),
      this.prisma.subscription.findMany({ include: { plan: true } }),
      this.prisma.appointment.groupBy({ by: ['clinicId'], where: { startsAt: { gte: new Date(Date.now() - 30 * DAY) } } }),
      this.prisma.preVisitSummary.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.aiUsage.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true, costInr: true } }),
    ]);
    const week = (d: Date) => Math.floor((Date.now() - d.getTime()) / (7 * DAY));
    const weeks = Array.from({ length: 8 }, (_, i) => {
      const n = summaries.filter((s) => week(s.createdAt) === i).length;
      const cost = usage.filter((u) => week(u.createdAt) === i).reduce((a, u) => a + Number(u.costInr), 0);
      return { weeksAgo: i, summaries: n, aiCostPerSummaryInr: n ? Math.round((cost / n) * 100) / 100 : null };
    }).reverse();
    const paying = subs.filter((s) => s.status === 'active' && (s.plan.monthlyInr ?? 0) > 0).length;
    return { mrrInr: mrr, payingClinics: paying, freeOrTrialClinics: subs.length - paying, activeClinics30d: activeClinics.length, weeks };
  }

  // ───────────── Developer ─────────────

  async developerStatus() {
    const dayAgo = new Date(Date.now() - DAY);
    const [usage, failed, due, blocks, templates, flags] = await Promise.all([
      this.prisma.aiUsage.findMany({ where: { createdAt: { gte: dayAgo } }, select: { step: true, provider: true, model: true, latencyMs: true, costInr: true } }),
      this.prisma.notification.count({ where: { createdAt: { gte: dayAgo }, status: 'failed' } }),
      this.prisma.reminderSchedule.count({ where: { enabled: true, nextAt: { lte: new Date() } } }),
      this.prisma.filterBlockEvent.count({ where: { createdAt: { gte: dayAgo } } }),
      this.prisma.template.findMany({ where: { status: 'published' }, select: { key: true, version: true }, orderBy: { version: 'desc' } }),
      this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } }),
    ]);
    const lat = usage.map((u) => u.latencyMs ?? 0).sort((a, b) => a - b);
    const pct = (p: number) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))]! : null);
    const seen = new Set<string>();
    return {
      providers: { llm: `${this.env.LLM_PROVIDER} / ${this.env.LLM_MODEL || 'default'}`, stt: `${this.env.STT_PROVIDER} / ${this.env.STT_MODEL || 'default'}`, demoMode: this.env.DEMO_MODE, phoneLogin: this.env.PHONE_LOGIN, voice: this.env.VOICE_ENABLED },
      ai24h: { calls: usage.length, p50Ms: pct(0.5), p95Ms: pct(0.95), costInr: Math.round(usage.reduce((a, u) => a + Number(u.costInr), 0) * 100) / 100, filterBlocks: blocks },
      jobs: { dueReminders: due, failedNotifications24h: failed, jobsEnabled: this.env.JOBS_ENABLED },
      templates: templates.filter((t) => (seen.has(t.key) ? false : (seen.add(t.key), true))),
      flags: flags.map((f) => ({ key: f.key, enabled: f.enabled, updatedAt: f.updatedAt.toISOString() })),
    };
  }

  async setFlag(user: AuthUser, key: string, enabled: boolean, req: Request) {
    await this.prisma.featureFlag.upsert({ where: { key }, update: { enabled }, create: { key, enabled } });
    await this.audit.record({ actor: user, action: `flag.${enabled ? 'on' : 'off'}`, entity: 'feature_flag', entityId: key, req });
    return { ok: true };
  }

  async runJobs(user: AuthUser, req: Request) {
    const sent = await this.jobs.runOnce();
    await this.audit.record({ actor: user, action: 'jobs.run', entity: 'jobs', req });
    return { sent };
  }

  // ───────────── Doctor Insights ─────────────

  async insights(user: AuthUser) {
    const d = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!d) throw new AppError(HttpStatus.FORBIDDEN, 'NOT_A_DOCTOR', 'No doctor profile for this account.');
    const since = new Date(Date.now() - 180 * DAY);
    const [sessions, feedback] = await Promise.all([
      this.prisma.intakeSession.findMany({ where: { doctorId: d.id, startedAt: { gte: since } }, select: { startedAt: true, submittedAt: true, status: true } }),
      this.prisma.summaryFeedback.findMany({ where: { doctorId: d.id }, select: { useful: true } }),
    ]);
    const submitted = sessions.filter((s) => s.status === 'submitted' && s.submittedAt);
    const minutes = submitted.map((s) => (s.submittedAt!.getTime() - s.startedAt.getTime()) / 60000).filter((m) => m > 0 && m < 120);
    // Month buckets in IST (YYYY-MM), current month and the five before it.
    const istMonth = (d: Date) => new Date(d.getTime() + 5.5 * 3600_000).toISOString().slice(0, 7);
    const now = new Date(istMonthStart().getTime() + 5.5 * 3600_000);
    const months = Array.from({ length: 6 }, (_, i) => {
      const key = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)).toISOString().slice(0, 7);
      return { month: key, summaries: submitted.filter((s) => istMonth(s.submittedAt!) === key).length };
    }).reverse();
    return {
      months,
      avgInterviewMinutes: minutes.length ? Math.round((minutes.reduce((a, b) => a + b, 0) / minutes.length) * 10) / 10 : null,
      completionRate: sessions.length ? Math.round((submitted.length / sessions.length) * 100) : null,
      // Estimate shown as an estimate in the UI: ~4 minutes of history-taking saved per summary read.
      minutesSavedEstimate: submitted.length * 4,
      usefulPercent: feedback.length ? Math.round((feedback.filter((f) => f.useful).length / feedback.length) * 100) : null,
      feedbackCount: feedback.length,
    };
  }
}
