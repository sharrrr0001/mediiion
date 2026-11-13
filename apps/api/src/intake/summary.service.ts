import { Inject, Injectable, Logger } from '@nestjs/common';
import { IntakeTemplate, deidentify, writeSummary, type SummaryItem } from '@medicos/ai';
import { ENC } from '@medicos/db';
import { CONSENT_VERSION, type Language, type PreVisitSummary } from '@medicos/shared';
import { meterDeliveredSummary } from '../billing/usage';
import { ReminderPlanner } from '../notify/reminders';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { AiService } from './ai.service';
import { buildReview, type DecryptedMessage } from './intake-views';

/** How long a doctor the patient shared with can open the summary (decision log). */
export const SHARE_GRANT_HOURS = 72;

/** Re-insert the patient's name only at render time (rule 11: the model never saw it). */
export function reidentify(summary: PreVisitSummary, firstName: string): PreVisitSummary {
  return JSON.parse(JSON.stringify(summary).replaceAll('[PATIENT]', firstName)) as PreVisitSummary;
}

@Injectable()
export class SummaryService {
  private readonly logger = new Logger('Summary');
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly reminders: ReminderPlanner,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  decrypt(jsonEnc: string): PreVisitSummary {
    return JSON.parse(this.crypto.decrypt(jsonEnc, ENC.summary)) as PreVisitSummary;
  }

  /** Spec §6.4 on submit: write → store → (if a doctor was chosen) share + queue. */
  async generateAndDeliver(sessionId: string) {
    const session = await this.prisma.intakeSession.findUniqueOrThrow({
      where: { id: sessionId },
      include: { patientProfile: true, messages: { orderBy: { createdAt: 'asc' } }, attachments: true, safetyEvents: { orderBy: { shownAt: 'asc' }, take: 1 } },
    });
    const tpl = await this.prisma.template.findUniqueOrThrow({ where: { key_version: { key: session.templateId, version: session.templateVersion } } });
    const template = IntakeTemplate.parse(tpl.json);
    const messages: DecryptedMessage[] = session.messages.map((m) => ({
      id: m.id,
      role: m.role,
      kind: m.kind,
      text: this.crypto.decrypt(m.textEnc, ENC.message),
      questionId: m.questionId,
      step: m.step,
      quickReplies: m.quickReplies,
      createdAt: m.createdAt,
    }));

    // De-identify everything the model will see (rule 11).
    const owner = await this.prisma.patientProfile.findMany({ where: { ownerUserId: session.patientProfile.ownerUserId }, select: { nameEnc: true, medicosId: true } });
    const deid = { names: owner.map((p) => this.crypto.decrypt(p.nameEnc, ENC.name)), extra: owner.map((p) => p.medicosId) };
    const items: SummaryItem[] = buildReview(messages, template).flatMap((r) =>
      r.answers.map((a) => ({ messageId: a.messageId, questionId: r.questionId, section: r.section, question: deidentify(r.question, deid), answer: deidentify(a.text, deid) })),
    );
    if (!items.length) return null;

    const out = await writeSummary({
      provider: this.ai.provider,
      template,
      language: session.language as Language,
      items,
      attachments: session.attachments.map((a) => ({ fileId: a.id, kind: a.kind, label: a.label ?? a.kind.replace(/_/g, ' ') })),
      safety: { safetyLineShown: session.safetyLineShown, ...(session.safetyEvents[0] ? { shownAt: session.safetyEvents[0].shownAt.toISOString() } : {}) },
      interviewMinutes: Math.max(1, Math.round(((session.submittedAt ?? new Date()).getTime() - session.startedAt.getTime()) / 60000)),
      answeredBy: session.answeredBy === 'family' ? 'family' : 'self',
    });

    const version = (await this.prisma.preVisitSummary.count({ where: { sessionId } })) + 1;
    const delivered = !!session.doctorId;
    const summary = await this.prisma.preVisitSummary.create({
      data: {
        sessionId,
        version,
        jsonEnc: this.crypto.encrypt(JSON.stringify(out.summary), ENC.summary),
        status: delivered ? 'delivered' : 'draft',
        deliveredAt: delivered ? new Date() : null,
      },
    });
    const blockRows = out.blocks.flatMap((rules) => rules.map((rule) => ({ sessionId, stage: 'summary', rule: String(rule) })));
    if (blockRows.length) await this.prisma.filterBlockEvent.createMany({ data: blockRows });
    await this.ai.recordUsage(sessionId, 'summary', out.usage);
    await this.prisma.recordBookEntry.create({
      data: { patientProfileId: session.patientProfileId, kind: 'pre_visit_summary', refId: summary.id, date: new Date(), title: `AI pre-visit summary · ${template.title}` },
    });

    if (session.doctorId) {
      await this.shareWithDoctor(session, session.doctorId);
      await meterDeliveredSummary(this.prisma, session.doctorId);
      await this.reminders.onSummaryDelivered(session.doctorId);
    }
    this.logger.log({ sessionId, summaryId: summary.id, regenerations: out.regenerations, droppedUnsourced: out.droppedUnsourced }, 'summary_written');
    return summary.id;
  }

  /** Rule 10: the patient chose this doctor → share consent, time-boxed grant, today's queue entry. */
  async shareWithDoctor(
    session: { id: string; patientProfileId: string; appointmentId: string | null; patientProfile: { ownerUserId: string } },
    doctorId: string,
  ) {
    const expiresAt = new Date(Date.now() + SHARE_GRANT_HOURS * 3600_000);
    await this.prisma.consent.create({
      data: { userId: session.patientProfile.ownerUserId, patientProfileId: session.patientProfileId, type: 'share_with_doctor', version: CONSENT_VERSION, scope: `doctor:${doctorId}`, expiresAt },
    });
    await this.prisma.accessGrant.create({ data: { patientProfileId: session.patientProfileId, doctorId, grantedVia: 'share', scope: 'visit', expiresAt } });
    if (!session.appointmentId) {
      const clinic = await this.prisma.clinic.findFirst({ where: { members: { some: { user: { doctor: { id: doctorId } } } } }, select: { id: true } });
      if (!clinic) return;
      const appt = await this.prisma.appointment.create({
        data: { patientProfileId: session.patientProfileId, doctorId, clinicId: clinic.id, startsAt: new Date(), type: 'new', status: 'booked', source: 'patient_app' },
      });
      await this.prisma.intakeSession.update({ where: { id: session.id }, data: { appointmentId: appt.id } });
    }
  }
}
