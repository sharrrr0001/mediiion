import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import type { Request } from 'express';
import { ENC, Prisma } from '@medicos/db';
import {
  CONSENT_VERSION,
  generateMedicosId,
  type CreatePatientProfile,
  type GrantConsent,
  type MeResponse,
  type ProfileSummary,
} from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { maskEmail, maskPhone } from '../auth/messaging/messaging';
import { can } from '../auth/policy';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';

const NOT_FOUND = () => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Profile not found.');

@Injectable()
export class PatientsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async hasCurrentConsent(userId: string) {
    const c = await this.prisma.consent.findFirst({
      where: { userId, type: 'data_processing', version: CONSENT_VERSION, revokedAt: null },
      select: { id: true },
    });
    return c !== null;
  }

  private toSummary(p: { id: string; medicosId: string; nameEnc: string; isPrimary: boolean; language: string }): ProfileSummary {
    return {
      id: p.id,
      medicosId: p.medicosId,
      name: this.crypto.decrypt(p.nameEnc, ENC.name),
      isPrimary: p.isPrimary,
      language: p.language,
    };
  }

  async me(user: AuthUser, req: Request): Promise<MeResponse> {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: user.id } });
    const contactHint = u.phoneEnc
      ? maskPhone(this.crypto.decrypt(u.phoneEnc, ENC.phone))
      : u.emailEnc
        ? maskEmail(this.crypto.decrypt(u.emailEnc, ENC.email))
        : '';
    const profiles = await this.prisma.patientProfile.findMany({
      where: { ownerUserId: user.id, deletedAt: null },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
    });
    if (profiles.length) {
      await this.audit.record({ actor: user, action: 'patient_profile.list', entity: 'patient_profile', req });
    }
    return {
      user: { id: u.id, role: u.role, contactHint },
      needsConsent: !(await this.hasCurrentConsent(user.id)),
      needsProfile: profiles.length === 0,
      profiles: profiles.map((p) => this.toSummary(p)),
    };
  }

  async grantConsent(user: AuthUser, body: GrantConsent, req: Request) {
    if (await this.hasCurrentConsent(user.id)) return { ok: true };
    const consent = await this.prisma.consent.create({
      data: { userId: user.id, type: body.type, version: body.version },
    });
    await this.audit.record({ actor: user, action: 'consent.grant', entity: 'consent', entityId: consent.id, req });
    return { ok: true };
  }

  async createProfile(user: AuthUser, body: CreatePatientProfile, req: Request): Promise<ProfileSummary> {
    if (user.role !== 'patient') throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'Only patients can add profiles.');
    if (!(await this.hasCurrentConsent(user.id))) {
      throw new AppError(HttpStatus.FORBIDDEN, 'CONSENT_REQUIRED', 'Please accept the consent first.');
    }
    const existing = await this.prisma.patientProfile.count({ where: { ownerUserId: user.id, deletedAt: null } });
    const birthYear = body.dob ? Number(body.dob.slice(0, 4)) : new Date().getFullYear() - (body.age ?? 0);

    // Retry on the (astronomically unlikely) Medicos ID collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        const profile = await this.prisma.patientProfile.create({
          data: {
            ownerUserId: user.id,
            medicosId: generateMedicosId(randomInt),
            nameEnc: this.crypto.encrypt(body.name, ENC.name),
            dobEnc: body.dob ? this.crypto.encrypt(body.dob, ENC.dob) : null,
            birthYear,
            gender: body.gender,
            city: body.city,
            language: body.language,
            relation: existing === 0 ? 'self' : 'other',
            isPrimary: existing === 0,
          },
        });
        await this.audit.record({
          actor: user,
          action: 'patient_profile.create',
          entity: 'patient_profile',
          entityId: profile.id,
          patientProfileId: profile.id,
          req,
        });
        return this.toSummary(profile);
      } catch (e) {
        const collision = e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002';
        if (!collision) throw e;
      }
    }
    throw new AppError(HttpStatus.CONFLICT, 'ID_COLLISION', 'Please try again.');
  }

  async getProfile(user: AuthUser, id: string, req: Request): Promise<ProfileSummary> {
    const profile = await this.prisma.patientProfile.findFirst({
      where: { id, deletedAt: null },
      include: { accessGrants: { select: { doctorId: true, expiresAt: true, revokedAt: true } } },
    });
    if (!profile) throw NOT_FOUND();
    const doctor =
      user.role === 'doctor'
        ? await this.prisma.doctor.findUnique({ where: { userId: user.id }, select: { id: true, verificationStatus: true } })
        : null;
    const allowed = can({ userId: user.id, role: user.role, doctor }, 'patient_profile.read', {
      kind: 'patient_profile',
      ownerUserId: profile.ownerUserId,
      grants: profile.accessGrants,
    });
    // 404, not 403: do not reveal that the profile exists.
    if (!allowed) throw NOT_FOUND();
    await this.audit.record({
      actor: user,
      action: 'patient_profile.read',
      entity: 'patient_profile',
      entityId: profile.id,
      patientProfileId: profile.id,
      req,
    });
    return this.toSummary(profile);
  }
}
