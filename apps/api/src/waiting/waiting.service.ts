import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ENC, type Prisma } from '@medicos/db';
import { WAITING_PING_COOLDOWN_SECONDS, type ClinicWaitingRow, type PatientWaitingView, type ReplyWaitingPing, type WaitingPingKind, type WaitingReplyView } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { istDayRange } from '../doctor/doctor.service';

const LIVE: Prisma.AppointmentWhereInput = { status: { in: ['booked', 'confirmed', 'checked_in'] } };
const NOT_FOUND = () => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Visit not found.');

type PingRow = { id: string; kind: string; createdAt: Date; respondedAt: Date | null; response: string | null; waitMinutes: number | null; responseText: string | null; respondedById: string | null };

/**
 * Waiting room: the patient at the clinic says "I have arrived" / "May I come in?"; doctor and staff
 * see it live and reply ("Please come in", "Doctor is busy", "Wait ~N min", short note). One signal
 * per visit every 150 s, enforced here (not only in the app). Metadata only — no health data.
 */
@Injectable()
export class WaitingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async roles(ids: Array<string | null>) {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    const users = unique.length ? await this.prisma.user.findMany({ where: { id: { in: unique } }, select: { id: true, role: true } }) : [];
    return new Map(users.map((u) => [u.id, u.role]));
  }

  private replyView(p: PingRow | undefined, roles: Map<string, string>): WaitingReplyView | null {
    if (!p?.respondedAt || !p.response) return null;
    return {
      response: p.response as WaitingReplyView['response'],
      waitMinutes: p.waitMinutes,
      text: p.responseText,
      at: p.respondedAt.toISOString(),
      by: roles.get(p.respondedById ?? '') === 'doctor' ? 'doctor' : 'staff',
    };
  }

  private nextAllowed(last: PingRow | undefined): Date | null {
    if (!last) return null;
    const next = last.createdAt.getTime() + WAITING_PING_COOLDOWN_SECONDS * 1000;
    return next > Date.now() ? new Date(next) : null;
  }

  // ───────────── patient ─────────────

  async today(user: AuthUser): Promise<PatientWaitingView[]> {
    const [from, to] = istDayRange();
    const appts = await this.prisma.appointment.findMany({
      where: { patientProfile: { ownerUserId: user.id, deletedAt: null }, startsAt: { gte: from, lt: to }, ...LIVE },
      include: { doctor: true, clinic: true, patientProfile: true, waitingPings: { orderBy: { createdAt: 'desc' }, take: 20 } },
      orderBy: { startsAt: 'asc' },
    });
    const roles = await this.roles(appts.flatMap((a) => a.waitingPings.map((p) => p.respondedById)));
    return appts.map((a) => {
      const last = a.waitingPings[0];
      const replied = a.waitingPings.find((p) => p.respondedAt);
      const next = this.nextAllowed(last);
      return {
        appointmentId: a.id,
        startsAt: a.startsAt.toISOString(),
        doctor: a.doctor.name,
        clinic: a.clinic.name,
        profileName: this.crypto.decrypt(a.patientProfile.nameEnc, ENC.name),
        arrived: a.status === 'checked_in',
        lastPing: last ? { kind: last.kind as WaitingPingKind, at: last.createdAt.toISOString() } : null,
        // Show the newest reply only if it answers the newest signal (or nothing newer was sent).
        reply: replied && (!last || replied.id === last.id || (replied.respondedAt && replied.respondedAt > last.createdAt)) ? this.replyView(replied, roles) : null,
        nextAllowedAt: next?.toISOString() ?? null,
      };
    });
  }

  async ping(user: AuthUser, appointmentId: string, kind: WaitingPingKind, req: Request) {
    const [from, to] = istDayRange();
    const a = await this.prisma.appointment.findUnique({ where: { id: appointmentId }, include: { patientProfile: true } });
    if (!a || a.patientProfile.ownerUserId !== user.id || a.patientProfile.deletedAt) throw NOT_FOUND();
    if (a.startsAt < from || a.startsAt >= to || !['booked', 'confirmed', 'checked_in'].includes(a.status)) {
      throw new AppError(HttpStatus.CONFLICT, 'NOT_TODAY', 'You can only do this on the day of your visit, at the clinic.');
    }
    await this.prisma.$transaction(async (tx) => {
      // Serialise taps for this visit so two quick taps cannot both pass the cooldown check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${'waiting:' + a.id}))`;
      const last = await tx.waitingPing.findFirst({ where: { appointmentId: a.id }, orderBy: { createdAt: 'desc' } });
      const next = this.nextAllowed(last ?? undefined);
      if (next) {
        throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'WAITING_TOO_SOON', 'The clinic has your message. You can send again in a moment.', {
          retryAfterSeconds: Math.ceil((next.getTime() - Date.now()) / 1000),
        });
      }
      await tx.waitingPing.create({ data: { appointmentId: a.id, kind } });
      if (a.status !== 'checked_in') await tx.appointment.update({ where: { id: a.id }, data: { status: 'checked_in' } });
    });
    await this.audit.record({ actor: user, action: `waiting.${kind}`, entity: 'appointment', entityId: a.id, patientProfileId: a.patientProfileId, req });
    return (await this.today(user)).find((v) => v.appointmentId === a.id)!;
  }

  // ───────────── doctor / staff ─────────────

  /** Staff see their whole clinic; a doctor sees only their own patients. */
  private async scope(user: AuthUser): Promise<Prisma.AppointmentWhereInput> {
    if (user.role === 'doctor') {
      const d = await this.prisma.doctor.findUnique({ where: { userId: user.id } });
      if (!d || d.verificationStatus !== 'verified') throw new AppError(HttpStatus.FORBIDDEN, 'NOT_VERIFIED', 'Only verified doctors can see the waiting room.');
      return { doctorId: d.id };
    }
    const clinicIds = (await this.prisma.clinicMember.findMany({ where: { userId: user.id }, select: { clinicId: true } })).map((m) => m.clinicId);
    if (!clinicIds.length) throw new AppError(HttpStatus.FORBIDDEN, 'NO_CLINIC', 'You are not a member of any clinic.');
    return { clinicId: { in: clinicIds } };
  }

  private label(p: { nameEnc: string; birthYear: number | null; gender: string | null }) {
    const name = this.crypto.decrypt(p.nameEnc, ENC.name);
    const initials = name.split(/\s+/).map((w) => w[0]?.toUpperCase() ?? '').join('').slice(0, 2);
    const age = p.birthYear ? new Date().getFullYear() - p.birthYear : null;
    const sex = p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : '';
    return `${initials}${age !== null ? ` · ${age}` : ''}${sex ? ` ${sex}` : ''}`;
  }

  async board(user: AuthUser): Promise<ClinicWaitingRow[]> {
    const [from, to] = istDayRange();
    const appts = await this.prisma.appointment.findMany({
      where: { ...(await this.scope(user)), startsAt: { gte: from, lt: to }, ...LIVE, waitingPings: { some: { createdAt: { gte: from } } } },
      include: { doctor: true, patientProfile: true, waitingPings: { where: { createdAt: { gte: from } }, orderBy: { createdAt: 'desc' } } },
    });
    const roles = await this.roles(appts.flatMap((a) => a.waitingPings.map((p) => p.respondedById)));
    const rows = appts.map((a): ClinicWaitingRow => {
      const last = a.waitingPings[0]!;
      return {
        pingId: last.id,
        appointmentId: a.id,
        kind: last.kind as WaitingPingKind,
        at: last.createdAt.toISOString(),
        patientLabel: this.label(a.patientProfile),
        medicosId: a.patientProfile.medicosId,
        doctor: { id: a.doctor.id, name: a.doctor.name },
        appointmentTime: a.startsAt.toISOString(),
        signalsToday: a.waitingPings.length,
        reply: this.replyView(last, roles),
      };
    });
    // Unanswered first, then the longest waiting.
    return rows.sort((x, y) => Number(!!x.reply) - Number(!!y.reply) || x.at.localeCompare(y.at));
  }

  async reply(user: AuthUser, pingId: string, body: ReplyWaitingPing, req: Request) {
    const ping = await this.prisma.waitingPing.findUnique({ where: { id: pingId }, include: { appointment: true } });
    if (!ping) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found.');
    const allowed = await this.prisma.appointment.count({ where: { id: ping.appointmentId, ...(await this.scope(user)) } });
    if (!allowed) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found.');
    await this.prisma.waitingPing.update({
      where: { id: pingId },
      data: {
        response: body.response,
        waitMinutes: body.response === 'wait' ? (body.waitMinutes ?? null) : null,
        responseText: body.text ?? null,
        respondedAt: new Date(),
        respondedById: user.id,
      },
    });
    await this.audit.record({ actor: user, action: `waiting.reply.${body.response}`, entity: 'appointment', entityId: ping.appointmentId, patientProfileId: ping.appointment.patientProfileId, req });
    return this.board(user);
  }
}
