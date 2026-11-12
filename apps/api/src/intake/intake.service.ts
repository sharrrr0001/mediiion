import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import type { Request } from 'express';
import {
  FIXED,
  IntakeTemplate,
  deidentify,
  detectLanguage,
  isMedicalQuestion,
  matchSafety,
  nextQuestion,
  runTurn,
  type TranscriptItem,
} from '@medicos/ai';
import { ENC } from '@medicos/db';
import { SAFETY_LINE, type IntakeReview, type IntakeView, type Language, type StartIntake } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { can } from '../auth/policy';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { AiService } from './ai.service';
import { AttachmentsService } from './attachments.service';
import { SummaryService } from './summary.service';
import {
  buildReview,
  currentStep,
  deriveAwaiting,
  detectAnsweredBy,
  lastAiMessage,
  lastQuestion,
  toMessageView,
  uploadHint,
  type DecryptedMessage,
} from './intake-views';

const NOT_FOUND = () => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Interview not found.');
const CONFLICT = (msg: string) => new AppError(HttpStatus.CONFLICT, 'INTAKE_STATE', msg);

@Injectable()
export class IntakeService {
  private readonly logger = new Logger('Intake');
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly ai: AiService,
    private readonly attachments: AttachmentsService,
    private readonly summaries: SummaryService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  // ───────────── loading & access (rule 10) ─────────────

  private async load(user: AuthUser, id: string) {
    const session = await this.prisma.intakeSession.findUnique({
      where: { id },
      include: { patientProfile: true, messages: { orderBy: { createdAt: 'asc' } } },
    });
    if (!session || session.patientProfile.deletedAt) throw NOT_FOUND();
    const allowed = can({ userId: user.id, role: user.role }, 'patient_record.read', {
      kind: 'patient_profile',
      ownerUserId: session.patientProfile.ownerUserId,
      grants: [],
    });
    if (!allowed) throw NOT_FOUND();
    const tpl = await this.prisma.template.findUniqueOrThrow({
      where: { key_version: { key: session.templateId, version: session.templateVersion } },
    });
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
    return { session, profile: session.patientProfile, template, messages };
  }

  private async addMessage(
    sessionId: string,
    m: { role: 'ai' | 'patient' | 'system'; kind: string; text: string; questionId?: string; step?: number; quickReplies?: string[]; filtered?: boolean },
  ) {
    await this.prisma.intakeMessage.create({
      data: {
        sessionId,
        role: m.role,
        kind: m.kind,
        textEnc: this.crypto.encrypt(m.text, ENC.message),
        questionId: m.questionId ?? null,
        step: m.step ?? null,
        quickReplies: m.quickReplies ?? [],
        filtered: m.filtered ?? false,
      },
    });
  }

  private ageOf(birthYear: number | null) {
    return birthYear ? new Date().getFullYear() - birthYear : null;
  }

  // ───────────── public operations ─────────────

  async start(user: AuthUser, body: StartIntake, req: Request): Promise<IntakeView> {
    const profile = await this.prisma.patientProfile.findFirst({ where: { id: body.profileId, deletedAt: null } });
    if (!profile || !can({ userId: user.id, role: user.role }, 'patient_profile.update', { kind: 'patient_profile', ownerUserId: profile.ownerUserId, grants: [] })) {
      throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Profile not found.');
    }
    const tpl = await this.prisma.template.findFirst({
      where: { key: body.templateKey, status: 'published' },
      orderBy: { version: 'desc' },
    });
    if (!tpl) throw new AppError(HttpStatus.SERVICE_UNAVAILABLE, 'NO_TEMPLATE', 'This interview is not available yet.');
    const language = (body.language ?? profile.language) as Language;
    if (body.doctorId) {
      const doc = await this.prisma.doctor.findUnique({ where: { id: body.doctorId }, select: { verificationStatus: true } });
      if (doc?.verificationStatus !== 'verified') throw new AppError(HttpStatus.BAD_REQUEST, 'DOCTOR_NOT_AVAILABLE', 'This doctor is not available on Medicos.');
    }
    const session = await this.prisma.intakeSession.create({
      data: { patientProfileId: profile.id, templateId: tpl.key, templateVersion: tpl.version, language, doctorId: body.doctorId ?? null },
    });
    const name = this.crypto.decrypt(profile.nameEnc, ENC.name).split(' ')[0] ?? '';
    await this.addMessage(session.id, {
      role: 'ai',
      kind: 'identity',
      text: FIXED.identity(name, this.ageOf(profile.birthYear))[language],
      quickReplies: [...FIXED.identityReplies[language]],
    });
    await this.audit.record({ actor: user, action: 'intake.start', entity: 'intake_session', entityId: session.id, patientProfileId: profile.id, req });
    return this.view(user, session.id, req, false);
  }

  async view(user: AuthUser, id: string, req: Request, audit = true): Promise<IntakeView> {
    const { session, template, messages } = await this.load(user, id);
    if (audit) {
      await this.audit.record({ actor: user, action: 'intake.read', entity: 'intake_session', entityId: id, patientProfileId: session.patientProfileId, req });
    }
    const awaiting = deriveAwaiting(messages, session.status);
    return {
      id: session.id,
      profileId: session.patientProfileId,
      templateKey: session.templateId,
      language: session.language,
      status: session.status,
      awaiting,
      step: currentStep(messages, awaiting),
      uploadHint: awaiting === 'answer' ? uploadHint(messages, template) : null,
      safetyLineShown: session.safetyLineShown,
      messages: messages.map(toMessageView),
      attachments: await this.attachments.listForSession(id),
    };
  }

  /** Every patient message runs through the safety rule FIRST (rule 4), then the engine. */
  async postMessage(user: AuthUser, id: string, text: string, req: Request): Promise<IntakeView> {
    const ctx = await this.load(user, id);
    const awaiting = deriveAwaiting(ctx.messages, ctx.session.status);
    if (!['identity', 'consent', 'answer'].includes(awaiting)) throw CONFLICT('Please continue the conversation first.');

    await this.addMessage(id, { role: 'patient', kind: 'answer', text });
    if (ctx.session.status === 'paused') await this.prisma.intakeSession.update({ where: { id }, data: { status: 'started' } });
    await this.audit.record({ actor: user, action: 'intake.message', entity: 'intake_session', entityId: id, patientProfileId: ctx.profile.id, req });

    const safety = matchSafety(text, ctx.template.extraSafetyPatterns.map((p) => new RegExp(p, 'u')));
    if (safety.matched) {
      await this.showSafetyLine(id, safety.ruleIds);
      return this.view(user, id, req, false);
    }
    await this.advance(user, id);
    return this.view(user, id, req, false);
  }

  /** The patient chose to continue after seeing the safety line. */
  async continueAfterSafety(user: AuthUser, id: string, req: Request): Promise<IntakeView> {
    const ctx = await this.load(user, id);
    if (deriveAwaiting(ctx.messages, ctx.session.status) !== 'safety_ack') throw CONFLICT('Nothing to continue.');
    await this.addMessage(id, { role: 'system', kind: 'safety_ack', text: 'Patient chose to continue.' });
    await this.advance(user, id);
    return this.view(user, id, req, false);
  }

  /** Retry the AI turn after a failure (e.g. provider timeout). */
  async next(user: AuthUser, id: string, req: Request): Promise<IntakeView> {
    const ctx = await this.load(user, id);
    if (deriveAwaiting(ctx.messages, ctx.session.status) !== 'ai_turn') throw CONFLICT('Nothing to retry.');
    await this.advance(user, id);
    return this.view(user, id, req, false);
  }

  private async showSafetyLine(sessionId: string, ruleIds: string[]) {
    await this.addMessage(sessionId, { role: 'system', kind: 'safety', text: SAFETY_LINE.combined });
    await this.prisma.$transaction([
      this.prisma.safetyEvent.create({ data: { sessionId, matchedTerms: ruleIds } }),
      this.prisma.intakeSession.update({ where: { id: sessionId }, data: { safetyLineShown: true } }),
    ]);
    // Rule ids only — never the patient's words.
    this.logger.log({ sessionId, ruleIds }, 'safety_line_shown');
  }

  /** Moves the conversation one step: identity → consent → planned questions → closing. */
  private async advance(user: AuthUser, id: string) {
    const { session, profile, template, messages } = await this.load(user, id);
    const stage = lastAiMessage(messages)?.kind;
    let language = session.language as Language;
    const lastPatient = [...messages].reverse().find((m) => m.role === 'patient');

    if (stage === 'identity') {
      await this.prisma.intakeSession.update({ where: { id }, data: { answeredBy: detectAnsweredBy(lastPatient?.text ?? '') } });
      await this.addMessage(id, { role: 'ai', kind: 'consent', text: FIXED.consent[language], quickReplies: [...FIXED.consentReplies[language]] });
      return;
    }

    const answeredQuestions = messages.filter((m) => m.role === 'ai' && m.kind === 'question');
    // Spec §6.1: detect the language from the first free-text answer.
    if (answeredQuestions.length === 1 && lastPatient && !lastPatient.quickReplies.length) {
      const detected = detectLanguage(lastPatient.text, language);
      if (detected !== language) {
        language = detected;
        await this.prisma.intakeSession.update({ where: { id }, data: { language } });
      }
    }

    const medicalQuestion = stage !== 'consent' && !!lastPatient && isMedicalQuestion(lastPatient.text);
    if (medicalQuestion) await this.addMessage(id, { role: 'ai', kind: 'redirect', text: FIXED.redirect[language] });

    const profileInfo = { gender: profile.gender, age: this.ageOf(profile.birthYear) };
    const askedIds = new Set(answeredQuestions.map((m) => m.questionId).filter((x): x is string => !!x));
    const question = nextQuestion(template, profileInfo, askedIds, answeredQuestions.length);
    if (!question) {
      await this.addMessage(id, { role: 'ai', kind: 'closing', text: FIXED.closing[language] });
      return;
    }
    const prevId = lastQuestion(messages)?.questionId;
    const previous = template.questions.find((q) => q.id === prevId) ?? null;

    const out = await runTurn({
      provider: this.ai.provider,
      template,
      language,
      question,
      previous,
      transcript: await this.transcriptFor(profile.ownerUserId, messages),
      medicalQuestion,
      prompt: { specialty: template.title },
    });
    await this.addMessage(id, {
      role: 'ai',
      kind: 'question',
      text: out.message,
      questionId: out.questionId,
      step: out.step,
      quickReplies: out.quickReplies,
      filtered: out.blocks.length > 0 || out.usedFallback,
    });
    const blockRows: Array<{ sessionId: string; stage: string; rule: string }> = out.blocks.flatMap((rules) =>
      rules.map((rule) => ({ sessionId: id, stage: 'chat', rule })),
    );
    if (out.invalidOutputs) blockRows.push(...Array.from({ length: out.invalidOutputs }, () => ({ sessionId: id, stage: 'chat', rule: 'invalid_output' })));
    if (blockRows.length) await this.prisma.filterBlockEvent.createMany({ data: blockRows });
    await this.ai.recordUsage(id, 'chat', out.usage);
  }

  /** De-identified conversation for the model (rule 11). Code-written stages are left out. */
  private async transcriptFor(ownerUserId: string, messages: DecryptedMessage[]): Promise<TranscriptItem[]> {
    const profiles = await this.prisma.patientProfile.findMany({ where: { ownerUserId }, select: { nameEnc: true, medicosId: true } });
    const names = profiles.map((p) => this.crypto.decrypt(p.nameEnc, ENC.name));
    const ctx = { names, extra: profiles.map((p) => p.medicosId) };
    const consentAt = messages.findIndex((m) => m.kind === 'consent');
    return messages
      .slice(consentAt + 2) // skip the consent prompt and the patient's "yes, start"
      .filter((m) => m.role !== 'system' && m.kind !== 'closing')
      .map((m) => ({ role: m.role, text: deidentify(m.text, ctx) }));
  }

  /** Latest unfinished interviews across the account's profiles (for "continue where you left off"). */
  async listOpen(user: AuthUser) {
    const rows = await this.prisma.intakeSession.findMany({
      where: { status: { in: ['started', 'paused'] }, patientProfile: { ownerUserId: user.id, deletedAt: null } },
      orderBy: { startedAt: 'desc' },
      take: 5,
      select: { id: true, patientProfileId: true, templateId: true, status: true, startedAt: true },
    });
    return rows.map((r) => ({ id: r.id, profileId: r.patientProfileId, templateKey: r.templateId, status: r.status, startedAt: r.startedAt.toISOString() }));
  }

  async pause(user: AuthUser, id: string, req: Request) {
    const { session } = await this.load(user, id);
    if (session.status === 'started') await this.prisma.intakeSession.update({ where: { id }, data: { status: 'paused' } });
    return this.view(user, id, req, false);
  }

  async setLanguage(user: AuthUser, id: string, language: Language, req: Request) {
    await this.load(user, id);
    await this.prisma.intakeSession.update({ where: { id }, data: { language } });
    return this.view(user, id, req, false);
  }

  async review(user: AuthUser, id: string, req: Request): Promise<IntakeReview> {
    const { session, template, messages } = await this.load(user, id);
    await this.audit.record({ actor: user, action: 'intake.review', entity: 'intake_session', entityId: id, patientProfileId: session.patientProfileId, req });
    return { id, status: session.status, items: buildReview(messages, template), attachments: await this.attachments.listForSession(id) };
  }

  /** Patient corrects an answer on "What you told us". Edits also pass the safety rule. */
  async editAnswer(user: AuthUser, id: string, messageId: string, text: string, req: Request) {
    const { session, messages, template } = await this.load(user, id);
    if (session.status === 'submitted') throw CONFLICT('This interview was already sent.');
    const msg = messages.find((m) => m.id === messageId && m.role === 'patient');
    if (!msg) throw NOT_FOUND();
    await this.prisma.intakeMessage.update({
      where: { id: messageId },
      data: { textEnc: this.crypto.encrypt(text, ENC.message), editedAt: new Date() },
    });
    await this.audit.record({ actor: user, action: 'intake.edit', entity: 'intake_message', entityId: messageId, patientProfileId: session.patientProfileId, req });
    const safety = matchSafety(text, template.extraSafetyPatterns.map((p) => new RegExp(p, 'u')));
    if (safety.matched) {
      await this.prisma.$transaction([
        this.prisma.safetyEvent.create({ data: { sessionId: id, matchedTerms: safety.ruleIds } }),
        this.prisma.intakeSession.update({ where: { id }, data: { safetyLineShown: true } }),
      ]);
    }
    return { ...(await this.review(user, id, req)), safetyLine: safety.matched ? SAFETY_LINE.combined : null };
  }

  async submit(user: AuthUser, id: string, req: Request) {
    const { session, messages } = await this.load(user, id);
    if (deriveAwaiting(messages, session.status) !== 'done') throw CONFLICT('Please finish the questions first.');
    await this.prisma.intakeSession.update({ where: { id }, data: { status: 'submitted', submittedAt: new Date() } });
    await this.audit.record({ actor: user, action: 'intake.submit', entity: 'intake_session', entityId: id, patientProfileId: session.patientProfileId, req });
    await this.summaries.generateAndDeliver(id);
    return this.view(user, id, req, false);
  }
}
