import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ENC } from '@medicos/db';
import type { DoctorListItem, DoctorMe, DoctorQueueRow, DoctorSummaryView, FinaliseNote, FinalisedNoteView, QueueStatus, SummaryFeedbackInput } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { can } from '../auth/policy';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { StorageService } from '../intake/storage.service';
import { SummaryService, reidentify } from '../intake/summary.service';

const NOT_FOUND = () => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found.');
const IST_OFFSET_MS = 5.5 * 3600_000;

/** [start, end) of "today" in India Standard Time. */
export function istDayRange(now = new Date()): [Date, Date] {
  const ist = new Date(now.getTime() + IST_OFFSET_MS);
  const start = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate()) - IST_OFFSET_MS;
  return [new Date(start), new Date(start + 86_400_000)];
}

@Injectable()
export class DoctorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly summaries: SummaryService,
    private readonly storage: StorageService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async doctorFor(user: AuthUser, requireVerified = true) {
    const doctor = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!doctor) throw new AppError(HttpStatus.FORBIDDEN, 'NOT_A_DOCTOR', 'No doctor profile for this account.');
    if (requireVerified && doctor.verificationStatus !== 'verified') {
      throw new AppError(HttpStatus.FORBIDDEN, 'NOT_VERIFIED', 'Your verification is in progress. You can receive patients once it is approved.');
    }
    return doctor;
  }

  private age(birthYear: number | null) {
    return birthYear ? new Date().getFullYear() - birthYear : null;
  }

  /** Doctor search for patients — verified doctors only, normal filters (no AI matching: rule 3). */
  async listVerified(): Promise<DoctorListItem[]> {
    const docs = await this.prisma.doctor.findMany({
      where: { verificationStatus: 'verified' },
      include: { fees: { include: { clinic: true }, take: 1 } },
      orderBy: { name: 'asc' },
    });
    return docs.map((d) => ({
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      degrees: d.degrees,
      yearsExperience: d.yearsExperience,
      clinic: d.fees[0] ? { name: d.fees[0].clinic.name, city: d.fees[0].clinic.city, area: d.fees[0].clinic.area } : null,
      fee: d.fees[0]?.consult ?? null,
    }));
  }

  async me(user: AuthUser): Promise<DoctorMe> {
    const d = await this.doctorFor(user, false);
    const clinic = await this.prisma.clinic.findFirst({ where: { members: { some: { userId: user.id } } }, select: { id: true, name: true } });
    return { id: d.id, name: d.name, specialty: d.specialty, verificationStatus: d.verificationStatus, clinic };
  }

  async queue(user: AuthUser, req: Request): Promise<DoctorQueueRow[]> {
    const doctor = await this.doctorFor(user);
    const [from, to] = istDayRange();
    const appts = await this.prisma.appointment.findMany({
      where: { doctorId: doctor.id, startsAt: { gte: from, lt: to }, status: { notIn: ['cancelled'] } },
      include: {
        patientProfile: true,
        intakeSessions: { orderBy: { startedAt: 'desc' }, take: 1, include: { summaries: { orderBy: { version: 'desc' }, take: 1 } } },
        notes: { where: { finalisedAt: { not: null } }, take: 1 },
      },
      orderBy: { startsAt: 'asc' },
    });
    await this.audit.record({ actor: user, action: 'doctor.queue.read', entity: 'appointment', req });
    const rows = appts.map((a): DoctorQueueRow => {
      const session = a.intakeSessions[0];
      const summary = session?.summaries[0];
      const status: QueueStatus = a.notes.length
        ? 'done'
        : summary
          ? 'ready'
          : session && session.status !== 'submitted'
            ? 'progress'
            : a.type === 'walk_in'
              ? 'walkin'
              : 'idle';
      const p = a.patientProfile;
      const name = this.crypto.decrypt(p.nameEnc, ENC.name);
      const initials = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
      const age = this.age(p.birthYear);
      const sex = p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : '';
      const complaint = summary ? this.summaries.decrypt(summary.jsonEnc).subjective.chiefComplaint.text.replaceAll('[PATIENT]', '').slice(0, 80) : null;
      return {
        appointmentId: a.id,
        time: a.startsAt.toISOString(),
        medicosId: p.medicosId,
        label: `${initials}${age !== null ? ` · ${age}` : ''}${sex ? ` ${sex}` : ''}`,
        complaint,
        status,
        safety: !!session?.safetyLineShown,
        type: a.type,
      };
    });
    // Neutral safety marker first (not a score), then by time.
    return rows.sort((x, y) => Number(y.safety && y.status !== 'done') - Number(x.safety && x.status !== 'done') || x.time.localeCompare(y.time));
  }

  private async loadAppointment(user: AuthUser, appointmentId: string) {
    const doctor = await this.doctorFor(user);
    const appt = await this.prisma.appointment.findUnique({
      where: { id: appointmentId },
      include: {
        patientProfile: { include: { accessGrants: { select: { doctorId: true, expiresAt: true, revokedAt: true } } } },
        intakeSessions: { orderBy: { startedAt: 'desc' }, take: 1, include: { summaries: { orderBy: { version: 'desc' }, take: 1 }, attachments: true } },
        notes: { include: { prescriptions: { include: { items: true } } }, orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    if (!appt || appt.doctorId !== doctor.id) throw NOT_FOUND();
    // Rule 10: access only with an active grant or this doctor's own appointment.
    const allowed = can({ userId: user.id, role: user.role, doctor }, 'patient_record.read', {
      kind: 'patient_profile',
      ownerUserId: appt.patientProfile.ownerUserId,
      grants: appt.patientProfile.accessGrants,
      appointmentDoctorIds: [appt.doctorId],
    });
    if (!allowed) throw NOT_FOUND();
    return { doctor, appt };
  }

  noteView(note: { id: string; assessmentEnc: string | null; planEnc: string | null; examinationEnc: string | null; testsAdvisedEnc: string | null; followUpDate: Date | null; finalisedAt: Date | null; prescriptions: Array<{ items: Array<{ drug: string; dose: string; frequency: string; duration: string; instructions: string | null }> }> }, doctorName: string): FinalisedNoteView {
    const dec = (v: string | null) => (v ? this.crypto.decrypt(v, ENC.note) : null);
    return {
      id: note.id,
      assessment: dec(note.assessmentEnc) ?? '',
      plan: dec(note.planEnc) ?? '',
      examination: dec(note.examinationEnc),
      testsAdvised: dec(note.testsAdvisedEnc),
      followUpDate: note.followUpDate?.toISOString().slice(0, 10) ?? null,
      finalisedAt: (note.finalisedAt ?? new Date()).toISOString(),
      doctorName,
      prescription: note.prescriptions.flatMap((p) => p.items.map((i) => ({ drug: i.drug, dose: i.dose, frequency: i.frequency, duration: i.duration, instructions: i.instructions }))),
    };
  }

  async summary(user: AuthUser, appointmentId: string, req: Request): Promise<DoctorSummaryView> {
    const { doctor, appt } = await this.loadAppointment(user, appointmentId);
    const p = appt.patientProfile;
    const session = appt.intakeSessions[0];
    const sum = session?.summaries[0];
    const name = this.crypto.decrypt(p.nameEnc, ENC.name);
    if (sum && !sum.openedByDoctorAt) await this.prisma.preVisitSummary.update({ where: { id: sum.id }, data: { openedByDoctorAt: new Date() } });
    await this.audit.record({ actor: user, action: 'summary.read', entity: 'pre_visit_summary', entityId: sum?.id, patientProfileId: p.id, req });
    const note = appt.notes[0]?.finalisedAt ? appt.notes[0] : null;
    return {
      appointmentId: appt.id,
      patient: { medicosId: p.medicosId, name, age: this.age(p.birthYear), gender: p.gender },
      visitType: appt.type,
      startsAt: appt.startsAt.toISOString(),
      summaryId: sum?.id ?? null,
      summaryStatus: sum?.status ?? null,
      summary: sum ? reidentify(this.summaries.decrypt(sum.jsonEnc), name.split(' ')[0] ?? name) : null,
      attachments: await Promise.all(
        (session?.attachments ?? []).map(async (a) => ({ id: a.id, kind: a.kind, mime: a.mime, label: a.label, url: await this.storage.signedGetUrl(a.s3Key) })),
      ),
      safetyShown: !!session?.safetyLineShown,
      note: note ? this.noteView(note, doctor.name) : null,
    };
  }

  /** Rule 9: only the doctor's finalised note becomes a clinical record in the patient's book. */
  async finalise(user: AuthUser, appointmentId: string, body: FinaliseNote, req: Request): Promise<DoctorSummaryView> {
    const { doctor, appt } = await this.loadAppointment(user, appointmentId);
    if (appt.notes[0]?.finalisedAt) throw new AppError(HttpStatus.CONFLICT, 'ALREADY_FINALISED', 'This visit is already finalised.');
    const summary = appt.intakeSessions[0]?.summaries[0];
    const enc = (v?: string) => (v ? this.crypto.encrypt(v, ENC.note) : null);
    const now = new Date();
    await this.prisma.$transaction(async (tx) => {
      const note = await tx.doctorNote.create({
        data: {
          appointmentId: appt.id,
          summaryId: summary?.id ?? null,
          assessmentEnc: enc(body.assessment),
          planEnc: enc(body.plan),
          examinationEnc: enc(body.examination),
          testsAdvisedEnc: enc(body.testsAdvised),
          followUpDate: body.followUpDate ? new Date(body.followUpDate) : null,
          finalisedAt: now,
          finalisedBy: user.id,
        },
      });
      await tx.recordBookEntry.create({ data: { patientProfileId: appt.patientProfileId, kind: 'doctor_note', refId: note.id, date: now, title: `Visit note · ${doctor.name}` } });
      if (body.prescription.length) {
        const rx = await tx.prescription.create({ data: { noteId: note.id, items: { create: body.prescription.map((i) => ({ ...i, instructions: i.instructions ?? null })) } } });
        await tx.recordBookEntry.create({ data: { patientProfileId: appt.patientProfileId, kind: 'prescription', refId: rx.id, date: now, title: `Prescription · ${doctor.name}` } });
      }
      if (summary) await tx.preVisitSummary.update({ where: { id: summary.id }, data: { status: 'reviewed' } });
      await tx.appointment.update({ where: { id: appt.id }, data: { status: 'completed' } });
    });
    await this.audit.record({ actor: user, action: 'doctor_note.finalise', entity: 'appointment', entityId: appt.id, patientProfileId: appt.patientProfileId, req });
    return this.summary(user, appointmentId, req);
  }

  async feedback(user: AuthUser, summaryId: string, body: SummaryFeedbackInput) {
    const doctor = await this.doctorFor(user);
    const s = await this.prisma.preVisitSummary.findUnique({ where: { id: summaryId }, include: { session: { include: { appointment: true } } } });
    if (!s || s.session.appointment?.doctorId !== doctor.id) throw NOT_FOUND();
    await this.prisma.summaryFeedback.create({ data: { summaryId, doctorId: doctor.id, useful: body.useful, issues: body.issues, comment: body.comment ?? null } });
    return { ok: true };
  }
}
