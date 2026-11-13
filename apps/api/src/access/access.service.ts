import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ENC } from '@medicos/db';
import { ACCESS_GRANT_HOURS, CONSENT_VERSION, normalizeMedicosId, type AccessGrantView, type DoctorAccessRequestView, type DoctorPatientView, type PatientAccessRequestView } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { meterDeliveredSummary } from '../billing/usage';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { istDayRange } from '../doctor/doctor.service';

const NOT_FOUND = (m = 'Not found.') => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', m);
const PROMPT_MINUTES = 10;
const RECENT_INTERVIEW_DAYS = 7;

/**
 * QR access (spec §7.1 #11, rule 10): the doctor scans the patient's Medicos ID, the patient sees
 * Allow / Deny, and only "Allow" creates a time-boxed AccessGrant (24 h). Every step is audited.
 */
@Injectable()
export class AccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async verifiedDoctor(user: AuthUser) {
    const d = await this.prisma.doctor.findUnique({ where: { userId: user.id }, include: { user: { include: { clinicMembers: { include: { clinic: true }, take: 1 } } } } });
    if (!d || d.verificationStatus !== 'verified') throw new AppError(HttpStatus.FORBIDDEN, 'NOT_VERIFIED', 'Only verified doctors can request access.');
    return d;
  }

  private label(p: { nameEnc: string; birthYear: number | null; gender: string | null }) {
    const name = this.crypto.decrypt(p.nameEnc, ENC.name);
    const initials = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
    const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
    const sex = p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : '';
    return `${initials}${age !== null ? ` · ${age}` : ''}${sex ? ` ${sex}` : ''}`;
  }

  // ───────────── doctor side ─────────────

  async request(user: AuthUser, medicosIdInput: string, req: Request): Promise<DoctorAccessRequestView> {
    const doctor = await this.verifiedDoctor(user);
    const id = await this.createRequest(doctor.id, medicosIdInput, user, req);
    return this.doctorView(user, id);
  }

  /** Shared by the doctor's Scan QR and the clinic staff's walk-in check-in. Returns the request id. */
  async createRequest(doctorId: string, medicosIdInput: string, actor: AuthUser, req: Request): Promise<string> {
    const medicosId = normalizeMedicosId(medicosIdInput);
    if (!medicosId) throw new AppError(HttpStatus.BAD_REQUEST, 'BAD_MEDICOS_ID', 'That is not a valid Medicos ID (MED-XXXX-XXXX).');
    const profile = await this.prisma.patientProfile.findFirst({ where: { medicosId, deletedAt: null } });
    if (!profile) throw NOT_FOUND('No patient with this Medicos ID.');
    const r = await this.prisma.accessRequest.create({
      data: { patientProfileId: profile.id, doctorId, expiresAt: new Date(Date.now() + PROMPT_MINUTES * 60_000) },
    });
    await this.audit.record({ actor, action: 'access.request', entity: 'access_request', entityId: r.id, patientProfileId: profile.id, req });
    return r.id;
  }

  async doctorView(user: AuthUser, id: string): Promise<DoctorAccessRequestView> {
    const doctor = await this.verifiedDoctor(user);
    const r = await this.prisma.accessRequest.findUnique({ where: { id }, include: { patientProfile: true } });
    if (!r || r.doctorId !== doctor.id) throw NOT_FOUND();
    const status = r.status === 'pending' && r.expiresAt.getTime() <= Date.now() ? 'expired' : (r.status as DoctorAccessRequestView['status']);
    const grant = status === 'allowed' && r.grantId ? await this.prisma.accessGrant.findUnique({ where: { id: r.grantId } }) : null;
    const active = !!grant && !grant.revokedAt && grant.expiresAt.getTime() > Date.now();
    return {
      id: r.id,
      status,
      medicosId: r.patientProfile.medicosId,
      expiresAt: r.expiresAt.toISOString(),
      grantExpiresAt: active ? grant.expiresAt.toISOString() : null,
      // No patient data until the patient allows (rule 10).
      patient: active ? { profileId: r.patientProfileId, label: this.label(r.patientProfile) } : null,
    };
  }

  /** Record book of a patient who granted this doctor access. */
  async patient(user: AuthUser, profileId: string, req: Request): Promise<DoctorPatientView> {
    const doctor = await this.verifiedDoctor(user);
    const grant = await this.prisma.accessGrant.findFirst({
      where: { patientProfileId: profileId, doctorId: doctor.id, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { expiresAt: 'desc' },
      include: { patientProfile: true },
    });
    if (!grant || grant.patientProfile.deletedAt) throw NOT_FOUND();
    const entries = await this.prisma.recordBookEntry.findMany({ where: { patientProfileId: profileId }, orderBy: { date: 'desc' }, take: 100 });
    await this.audit.record({ actor: user, action: 'doctor.patient_record.read', entity: 'patient_profile', entityId: profileId, patientProfileId: profileId, req });
    return {
      profileId,
      medicosId: grant.patientProfile.medicosId,
      label: this.label(grant.patientProfile),
      grantExpiresAt: grant.expiresAt.toISOString(),
      entries: entries.map((e) => ({ id: e.id, kind: e.kind, title: e.title, date: e.date.toISOString() })),
    };
  }

  // ───────────── patient side ─────────────

  async pendingForPatient(user: AuthUser): Promise<PatientAccessRequestView[]> {
    const rows = await this.prisma.accessRequest.findMany({
      where: { status: 'pending', expiresAt: { gt: new Date() }, patientProfile: { ownerUserId: user.id, deletedAt: null } },
      include: { patientProfile: true, doctor: { include: { user: { include: { clinicMembers: { include: { clinic: true }, take: 1 } } } } } },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      doctor: { name: r.doctor.name, specialty: r.doctor.specialty, clinic: r.doctor.user.clinicMembers[0]?.clinic.name ?? null },
      profileName: this.crypto.decrypt(r.patientProfile.nameEnc, ENC.name),
      createdAt: r.createdAt.toISOString(),
      expiresAt: r.expiresAt.toISOString(),
      grantHours: ACCESS_GRANT_HOURS,
    }));
  }

  async decide(user: AuthUser, id: string, decision: 'allow' | 'deny', req: Request) {
    const r = await this.prisma.accessRequest.findUnique({ where: { id }, include: { patientProfile: true } });
    if (!r || r.patientProfile.ownerUserId !== user.id) throw NOT_FOUND();
    if (r.status !== 'pending' || r.expiresAt.getTime() <= Date.now()) {
      throw new AppError(HttpStatus.CONFLICT, 'REQUEST_CLOSED', 'This request has expired. Ask the doctor to scan again.');
    }
    if (decision === 'deny') {
      await this.prisma.accessRequest.update({ where: { id }, data: { status: 'denied', decidedAt: new Date() } });
      await this.audit.record({ actor: user, action: 'access.deny', entity: 'access_request', entityId: id, patientProfileId: r.patientProfileId, req });
      return { ok: true, status: 'denied' as const };
    }

    const expiresAt = new Date(Date.now() + ACCESS_GRANT_HOURS * 3600_000);
    const grant = await this.prisma.$transaction(async (tx) => {
      const g = await tx.accessGrant.create({ data: { patientProfileId: r.patientProfileId, doctorId: r.doctorId, grantedVia: 'qr_prompt', scope: 'visit', expiresAt } });
      await tx.consent.create({
        data: { userId: user.id, patientProfileId: r.patientProfileId, type: 'record_access', version: CONSENT_VERSION, scope: `doctor:${r.doctorId}`, expiresAt },
      });
      await tx.accessRequest.update({ where: { id }, data: { status: 'allowed', decidedAt: new Date(), grantId: g.id } });
      return g;
    });
    await this.ensureVisitToday(r.patientProfileId, r.doctorId);
    await this.audit.record({ actor: user, action: 'access.allow', entity: 'access_grant', entityId: grant.id, patientProfileId: r.patientProfileId, req });
    return { ok: true, status: 'allowed' as const, expiresAt: expiresAt.toISOString() };
  }

  /**
   * Walk-in via QR: put the patient in today's queue (so the doctor can finalise) and attach their
   * recent interview that was not yet shared with any doctor.
   */
  private async ensureVisitToday(patientProfileId: string, doctorId: string) {
    const [from, to] = istDayRange();
    let appt = await this.prisma.appointment.findFirst({ where: { patientProfileId, doctorId, startsAt: { gte: from, lt: to }, status: { notIn: ['cancelled', 'no_show'] } } });
    if (!appt) {
      const clinic = await this.prisma.clinic.findFirst({ where: { members: { some: { user: { doctor: { id: doctorId } } } } }, select: { id: true } });
      if (!clinic) return;
      appt = await this.prisma.appointment.create({
        data: { patientProfileId, doctorId, clinicId: clinic.id, startsAt: new Date(), type: 'walk_in', status: 'checked_in', source: 'waiting_room_qr' },
      });
    }
    const since = new Date(Date.now() - RECENT_INTERVIEW_DAYS * 86_400_000);
    const session = await this.prisma.intakeSession.findFirst({
      where: { patientProfileId, doctorId: null, appointmentId: null, status: 'submitted', submittedAt: { gte: since } },
      orderBy: { submittedAt: 'desc' },
    });
    if (session) {
      await this.prisma.intakeSession.update({ where: { id: session.id }, data: { doctorId, appointmentId: appt.id } });
      const { count } = await this.prisma.preVisitSummary.updateMany({ where: { sessionId: session.id, status: 'draft' }, data: { status: 'delivered', deliveredAt: new Date() } });
      if (count) await meterDeliveredSummary(this.prisma, doctorId);
    }
  }

  async grants(user: AuthUser, req: Request): Promise<AccessGrantView[]> {
    const rows = await this.prisma.accessGrant.findMany({
      where: { patientProfile: { ownerUserId: user.id, deletedAt: null } },
      include: { doctor: true, patientProfile: true },
      orderBy: { grantedAt: 'desc' },
      take: 100,
    });
    await this.audit.record({ actor: user, action: 'access.grants.list', entity: 'access_grant', req });
    const now = Date.now();
    return rows.map((g) => ({
      id: g.id,
      doctor: { name: g.doctor.name, specialty: g.doctor.specialty },
      profileName: this.crypto.decrypt(g.patientProfile.nameEnc, ENC.name),
      via: g.grantedVia,
      grantedAt: g.grantedAt.toISOString(),
      expiresAt: g.expiresAt.toISOString(),
      revokedAt: g.revokedAt?.toISOString() ?? null,
      active: !g.revokedAt && g.expiresAt.getTime() > now,
    }));
  }

  async revoke(user: AuthUser, id: string, req: Request) {
    const g = await this.prisma.accessGrant.findUnique({ where: { id }, include: { patientProfile: true } });
    if (!g || g.patientProfile.ownerUserId !== user.id) throw NOT_FOUND();
    if (!g.revokedAt) await this.prisma.accessGrant.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.audit.record({ actor: user, action: 'access.revoke', entity: 'access_grant', entityId: id, patientProfileId: g.patientProfileId, req });
    return { ok: true };
  }
}
