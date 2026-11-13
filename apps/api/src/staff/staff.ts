import { Body, Controller, Get, HttpCode, HttpStatus, Injectable, Inject, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { BIDX, ENC } from '@medicos/db';
import { InviteStaff, StaffWalkIn, type ClinicContext, type ClinicQueueRow, type StaffMemberView } from '@medicos/shared';
import { AccessModule } from '../access/access.controller';
import { AccessService } from '../access/access.service';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { maskEmail, maskPhone } from '../auth/messaging/messaging';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { istDayRange } from '../doctor/doctor.service';

/** Clinic staff (spec §7.4): queue metadata, walk-in check-in via the patient's Allow, waiting-room QR. */
@Injectable()
export class StaffService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly access: AccessService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async doctorClinic(user: AuthUser) {
    const d = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
    if (!d || d.verificationStatus !== 'verified') throw new AppError(HttpStatus.FORBIDDEN, 'NOT_VERIFIED', 'Only verified doctors can manage staff.');
    const clinic = await this.prisma.clinic.findFirst({ where: { ownerDoctorId: d.id }, orderBy: { createdAt: 'asc' } });
    if (!clinic) throw new AppError(HttpStatus.CONFLICT, 'NO_CLINIC', 'Add your clinic first.');
    return { d, clinic };
  }

  async list(user: AuthUser): Promise<StaffMemberView[]> {
    const { clinic } = await this.doctorClinic(user);
    const members = await this.prisma.clinicMember.findMany({ where: { clinicId: clinic.id, role: 'staff' }, include: { user: true } });
    return members.map((m) => ({
      userId: m.userId,
      contact: m.user.emailEnc ? maskEmail(this.crypto.decrypt(m.user.emailEnc, ENC.email)) : m.user.phoneEnc ? maskPhone(this.crypto.decrypt(m.user.phoneEnc, ENC.phone)) : '—',
      addedAt: null,
    }));
  }

  async invite(user: AuthUser, body: InviteStaff, req: Request) {
    const { clinic } = await this.doctorClinic(user);
    const where = 'email' in body ? { emailHash: this.crypto.blindIndex(body.email, BIDX.email) } : { phoneHash: this.crypto.blindIndex(body.phone, BIDX.phone) };
    let staff = await this.prisma.user.findFirst({ where, include: { profiles: { select: { id: true } } } });
    if (staff && (staff.role !== 'staff' && (staff.role !== 'patient' || staff.profiles.length))) {
      throw new AppError(HttpStatus.CONFLICT, 'ACCOUNT_IN_USE', 'This number or email is used by another account. Use a separate one for clinic staff.');
    }
    if (!staff) {
      const created = await this.prisma.user.create({
        data: 'email' in body ? { ...where, emailEnc: this.crypto.encrypt(body.email, ENC.email), role: 'staff' } : { ...where, phoneEnc: this.crypto.encrypt(body.phone, ENC.phone), role: 'staff' },
      });
      staff = { ...created, profiles: [] };
    } else if (staff.role !== 'staff') {
      await this.prisma.user.update({ where: { id: staff.id }, data: { role: 'staff' } });
    }
    await this.prisma.clinicMember.upsert({ where: { clinicId_userId: { clinicId: clinic.id, userId: staff.id } }, update: { role: 'staff' }, create: { clinicId: clinic.id, userId: staff.id, role: 'staff' } });
    await this.audit.record({ actor: user, action: 'clinic.staff.invite', entity: 'clinic_member', entityId: staff.id, req });
    return this.list(user);
  }

  async remove(user: AuthUser, staffUserId: string, req: Request) {
    const { clinic } = await this.doctorClinic(user);
    await this.prisma.clinicMember.deleteMany({ where: { clinicId: clinic.id, userId: staffUserId, role: 'staff' } });
    await this.audit.record({ actor: user, action: 'clinic.staff.remove', entity: 'clinic_member', entityId: staffUserId, req });
    return this.list(user);
  }

  /** The clinic the signed-in staff member (or doctor) belongs to, with its verified doctors. */
  async context(user: AuthUser): Promise<ClinicContext> {
    const m = await this.prisma.clinicMember.findFirst({ where: { userId: user.id }, include: { clinic: { include: { members: { include: { user: { include: { doctor: true } } } } } } } });
    if (!m) throw new AppError(HttpStatus.FORBIDDEN, 'NO_CLINIC', 'You are not a member of any clinic.');
    const doctors = m.clinic.members.map((x) => x.user.doctor).filter((d): d is NonNullable<typeof d> => !!d && d.verificationStatus === 'verified');
    return { clinic: { id: m.clinic.id, name: m.clinic.name }, doctors: doctors.map((d) => ({ id: d.id, name: d.name, specialty: d.specialty })) };
  }

  async queue(user: AuthUser, req: Request): Promise<ClinicQueueRow[]> {
    const ctx = await this.context(user);
    const [from, to] = istDayRange();
    const appts = await this.prisma.appointment.findMany({
      where: { clinicId: ctx.clinic.id, startsAt: { gte: from, lt: to }, status: { notIn: ['cancelled'] } },
      include: { patientProfile: true, doctor: true, intakeSessions: { include: { summaries: { select: { id: true }, take: 1 } } } },
      orderBy: { startsAt: 'asc' },
    });
    await this.audit.record({ actor: user, action: 'clinic.queue.read', entity: 'appointment', req });
    return appts.map((a) => {
      const name = this.crypto.decrypt(a.patientProfile.nameEnc, ENC.name);
      const initials = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
      return {
        appointmentId: a.id,
        time: a.startsAt.toISOString(),
        medicosId: a.patientProfile.medicosId,
        label: initials,
        doctor: a.doctor.name,
        type: a.type,
        status: a.status,
        summaryReady: a.intakeSessions.some((s) => s.summaries.length > 0),
      };
    });
  }

  /** Walk-in: the patient still has to tap Allow; staff never see records (rule 10). */
  async walkIn(user: AuthUser, body: StaffWalkIn, req: Request) {
    const ctx = await this.context(user);
    if (!ctx.doctors.some((d) => d.id === body.doctorId)) throw new AppError(HttpStatus.BAD_REQUEST, 'DOCTOR_NOT_IN_CLINIC', 'Pick a doctor of this clinic.');
    const id = await this.access.createRequest(body.doctorId, body.medicosId, user, req);
    return { requestId: id, status: 'pending' as const };
  }

  async walkInStatus(user: AuthUser, id: string) {
    const ctx = await this.context(user);
    const r = await this.prisma.accessRequest.findUnique({ where: { id } });
    if (!r || !ctx.doctors.some((d) => d.id === r.doctorId)) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found.');
    const status = r.status === 'pending' && r.expiresAt.getTime() <= Date.now() ? 'expired' : r.status;
    return { requestId: id, status };
  }
}

@ApiTags('clinic')
@Roles('doctor')
@Controller('doctor/staff')
export class DoctorStaffController {
  constructor(private readonly staff: StaffService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.staff.list(user);
  }

  @Post()
  @ZodBody(InviteStaff)
  invite(@CurrentUser() user: AuthUser, @Body(new ZodPipe(InviteStaff)) body: InviteStaff, @Req() req: Request) {
    return this.staff.invite(user, body, req);
  }

  @Post(':userId/remove')
  @HttpCode(HttpStatus.OK)
  remove(@CurrentUser() user: AuthUser, @Param('userId', ParseUUIDPipe) userId: string, @Req() req: Request) {
    return this.staff.remove(user, userId, req);
  }
}

@ApiTags('clinic')
@Roles('staff', 'doctor')
@Controller('clinic')
export class ClinicController {
  constructor(private readonly staff: StaffService) {}

  @Get('context')
  context(@CurrentUser() user: AuthUser) {
    return this.staff.context(user);
  }

  @Get('queue')
  queue(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.staff.queue(user, req);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('walk-ins')
  @ZodBody(StaffWalkIn)
  walkIn(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StaffWalkIn)) body: StaffWalkIn, @Req() req: Request) {
    return this.staff.walkIn(user, body, req);
  }

  @Get('walk-ins/:id')
  walkInStatus(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.staff.walkInStatus(user, id);
  }
}

@Module({ imports: [AccessModule], controllers: [DoctorStaffController, ClinicController], providers: [StaffService] })
export class StaffModule {}
