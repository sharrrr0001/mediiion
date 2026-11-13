import { HttpStatus, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Request } from 'express';
import type { ClinicSetup, DocKind, DoctorProfileUpdate, DoctorSignup, OnboardingView, VerificationDecision, VerificationQueueItem } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { SessionService } from '../auth/session.service';
import { AppError } from '../common/errors';
import { PrismaService } from '../config/core.module';
import { StorageService, scanForMalware, sniffMime } from '../intake/storage.service';

const MAX_DOC_BYTES = 5 * 1024 * 1024;
const RECHECK_DAYS = 365;

/** Doctor onboarding (spec §7.2) and the Admin verification queue (spec §7.5). */
@Injectable()
export class OnboardingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly storage: StorageService,
    private readonly sessions: SessionService,
  ) {}

  /**
   * A new account (just signed in by OTP, no patient profiles) becomes a pending doctor. Sessions are
   * revoked because the doctor role needs 2FA: the next login enrols TOTP.
   */
  async signup(user: AuthUser, body: DoctorSignup, req: Request) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { profiles: { select: { id: true } }, doctor: true } });
    if (u.doctor) throw new AppError(HttpStatus.CONFLICT, 'ALREADY_DOCTOR', 'This account already has a doctor profile. Please log in.');
    if (u.role !== 'patient' || u.profiles.length) {
      throw new AppError(HttpStatus.CONFLICT, 'ACCOUNT_IN_USE', 'This number or email is already used for a patient account. Please use a different one for your doctor account.');
    }
    const doctor = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: u.id }, data: { role: 'doctor' } });
      return tx.doctor.create({
        data: {
          userId: u.id,
          name: body.name.startsWith('Dr') ? body.name : `Dr. ${body.name}`,
          specialty: body.specialty,
          degrees: body.degrees,
          registrationNo: body.registrationNo,
          council: body.council,
          yearsExperience: body.yearsExperience,
          languages: body.languages,
          about: null,
          verificationStatus: 'pending',
        },
      });
    });
    await this.prisma.clinic.create({ data: { name: `${doctor.name}'s clinic`, address: '', city: body.city, ownerDoctorId: doctor.id, members: { create: { userId: u.id, role: 'doctor' } } } });
    await this.sessions.revokeAllForUser(u.id);
    await this.audit.record({ actor: { id: u.id, role: 'doctor' }, action: 'doctor.signup', entity: 'doctor', entityId: doctor.id, req });
    return { ok: true, next: '/d/login?registered=1' };
  }

  private async doctorOf(user: AuthUser) {
    const d = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!d) throw new AppError(HttpStatus.FORBIDDEN, 'NOT_A_DOCTOR', 'No doctor profile for this account.');
    return d;
  }

  async view(user: AuthUser): Promise<OnboardingView> {
    const d = await this.doctorOf(user);
    const [docs, clinic] = await Promise.all([
      this.prisma.verificationDocument.findMany({ where: { doctorId: d.id }, orderBy: { createdAt: 'desc' } }),
      this.prisma.clinic.findFirst({ where: { ownerDoctorId: d.id }, include: { schedules: { where: { doctorId: d.id } }, fees: { where: { doctorId: d.id } } }, orderBy: { createdAt: 'asc' } }),
    ]);
    const kinds = new Set(docs.map((x) => x.kind));
    const fee = clinic?.fees[0];
    const clinicView =
      clinic && clinic.address && fee && clinic.schedules.length
        ? {
            id: clinic.id,
            name: clinic.name,
            address: clinic.address,
            city: clinic.city,
            area: clinic.area,
            slotMinutes: clinic.schedules[0]!.slotMinutes,
            hours: clinic.schedules.map((s) => ({ weekday: s.weekday, start: s.start, end: s.end })),
            fee: { consult: fee.consult, followUp: fee.followUp, modes: fee.modes as Array<'pay_at_clinic' | 'upi'> },
          }
        : null;
    const rejected = docs.find((x) => x.status === 'rejected' && x.note);
    return {
      status: d.verificationStatus,
      rejectionNote: d.verificationStatus === 'rejected' ? (rejected?.note ?? null) : null,
      steps: { account: true, documents: kinds.has('registration_certificate') && kinds.has('government_id'), clinic: !!clinicView, profile: !!d.about },
      documents: docs.map((x) => ({ id: x.id, kind: x.kind as DocKind, status: x.status, createdAt: x.createdAt.toISOString() })),
      clinic: clinicView,
      about: d.about,
      languages: d.languages,
    };
  }

  async uploadDocument(user: AuthUser, kind: DocKind, file: Buffer, req: Request) {
    const d = await this.doctorOf(user);
    if (!file.length || file.length > MAX_DOC_BYTES) throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_SIZE', 'Files must be under 5 MB.');
    const mime = sniffMime(file);
    if (!mime) throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_TYPE', 'Please upload a photo (JPG, PNG) or a PDF.');
    if ((await scanForMalware(file)) !== 'clean') throw new AppError(HttpStatus.BAD_REQUEST, 'FILE_REJECTED', 'This file was rejected.');
    const key = `doctor-docs/${d.id}/${randomUUID()}`;
    await this.storage.put(key, file, mime);
    const doc = await this.prisma.verificationDocument.create({ data: { doctorId: d.id, kind, s3Key: key } });
    // A new document after a rejection puts the doctor back in the queue.
    if (d.verificationStatus === 'rejected') await this.prisma.doctor.update({ where: { id: d.id }, data: { verificationStatus: 'pending' } });
    await this.audit.record({ actor: user, action: 'doctor.document.upload', entity: 'verification_document', entityId: doc.id, req });
    return this.view(user);
  }

  async setupClinic(user: AuthUser, body: ClinicSetup, req: Request) {
    const d = await this.doctorOf(user);
    const existing = await this.prisma.clinic.findFirst({ where: { ownerDoctorId: d.id }, orderBy: { createdAt: 'asc' } });
    await this.prisma.$transaction(async (tx) => {
      const data = { name: body.name, address: body.address, city: body.city, area: body.area ?? null };
      const clinic = existing
        ? await tx.clinic.update({ where: { id: existing.id }, data })
        : await tx.clinic.create({ data: { ...data, ownerDoctorId: d.id, members: { create: { userId: user.id, role: 'doctor' } } } });
      await tx.schedule.deleteMany({ where: { doctorId: d.id, clinicId: clinic.id } });
      await tx.schedule.createMany({ data: body.hours.map((h) => ({ doctorId: d.id, clinicId: clinic.id, weekday: h.weekday, start: h.start, end: h.end, slotMinutes: body.slotMinutes })) });
      await tx.fee.upsert({
        where: { doctorId_clinicId: { doctorId: d.id, clinicId: clinic.id } },
        update: { consult: body.fee.consult, followUp: body.fee.followUp, modes: body.fee.modes },
        create: { doctorId: d.id, clinicId: clinic.id, consult: body.fee.consult, followUp: body.fee.followUp, modes: body.fee.modes },
      });
    });
    await this.audit.record({ actor: user, action: 'doctor.clinic.update', entity: 'clinic', req });
    return this.view(user);
  }

  async updateProfile(user: AuthUser, body: DoctorProfileUpdate) {
    const d = await this.doctorOf(user);
    await this.prisma.doctor.update({ where: { id: d.id }, data: { ...(body.about !== undefined ? { about: body.about || null } : {}), ...(body.languages ? { languages: body.languages } : {}) } });
    return this.view(user);
  }

  // ───────────── Admin ─────────────

  async queue(user: AuthUser, req: Request): Promise<VerificationQueueItem[]> {
    const docs = await this.prisma.doctor.findMany({
      where: { verificationStatus: 'pending' },
      include: { documents: { orderBy: { createdAt: 'desc' } }, ownedClinics: { take: 1, orderBy: { createdAt: 'asc' } } },
      orderBy: { createdAt: 'asc' },
    });
    await this.audit.record({ actor: user, action: 'admin.verification.list', entity: 'doctor', req });
    return Promise.all(
      docs.map(async (d) => ({
        doctorId: d.id,
        name: d.name,
        specialty: d.specialty,
        registrationNo: d.registrationNo,
        council: d.council,
        degrees: d.degrees,
        yearsExperience: d.yearsExperience,
        city: d.ownedClinics[0]?.city ?? null,
        submittedAt: d.createdAt.toISOString(),
        documents: await Promise.all(d.documents.map(async (x) => ({ id: x.id, kind: x.kind, url: await this.storage.signedGetUrl(x.s3Key), mime: 'application/octet-stream' }))),
      })),
    );
  }

  async decide(user: AuthUser, doctorId: string, body: VerificationDecision, req: Request) {
    const d = await this.prisma.doctor.findUnique({ where: { id: doctorId } });
    if (!d) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Doctor not found.');
    const approve = body.decision === 'approve';
    await this.prisma.$transaction([
      this.prisma.doctor.update({
        where: { id: doctorId },
        data: approve
          ? { verificationStatus: 'verified', verifiedAt: new Date(), recheckDue: new Date(Date.now() + RECHECK_DAYS * 86_400_000) }
          : { verificationStatus: 'rejected' },
      }),
      this.prisma.verificationDocument.updateMany({ where: { doctorId, status: 'pending' }, data: { status: approve ? 'approved' : 'rejected', reviewerId: user.id, note: body.note ?? null } }),
    ]);
    await this.audit.record({ actor: user, action: approve ? 'admin.verification.approve' : 'admin.verification.reject', entity: 'doctor', entityId: doctorId, req });
    return { ok: true, status: approve ? 'verified' : 'rejected' };
  }
}
