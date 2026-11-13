import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { ENC, type Prisma } from '@medicos/db';
import type { AppointmentView, BookAppointment, ClinicView, DoctorCard, DoctorProfileView, DoctorSearch, SlotsView } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import type { AuthUser } from '../auth/decorators';
import { can } from '../auth/policy';
import { AppError } from '../common/errors';
import { meterDeliveredSummary } from '../billing/usage';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { SummaryService } from '../intake/summary.service';
import { addDays, isScheduledSlot, istDate, slotsFor, type ScheduleRow } from './slots';

const NOT_FOUND = (what = 'Not found.') => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', what);
const LIVE: Prisma.AppointmentWhereInput = { status: { notIn: ['cancelled', 'no_show'] } };
const DAYS_AHEAD = 14;

const doctorInclude = {
  fees: { include: { clinic: true } },
  schedules: true,
} satisfies Prisma.DoctorInclude;
type DoctorRow = Prisma.DoctorGetPayload<{ include: typeof doctorInclude }>;

/** Doctor search, profile, slots and booking (spec §7.1 steps 7–9). Normal filters only (rule 3). */
@Injectable()
export class BookingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly summaries: SummaryService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async takenFor(doctorId: string, from: Date, to: Date) {
    const rows = await this.prisma.appointment.findMany({ where: { doctorId, startsAt: { gte: from, lt: to }, ...LIVE }, select: { startsAt: true } });
    return rows.map((r) => r.startsAt);
  }

  private async nextSlot(d: DoctorRow, now = new Date()): Promise<string | null> {
    if (!d.schedules.length) return null;
    const today = istDate(now);
    const taken = await this.takenFor(d.id, now, new Date(now.getTime() + 8 * 86_400_000));
    const clinicIds = [...new Set(d.schedules.map((s) => s.clinicId))];
    for (let i = 0; i < 7; i++) {
      const date = addDays(today, i);
      const free = clinicIds.flatMap((c) => slotsFor(d.schedules, c, date, taken, now)).filter((s) => s.free);
      if (free.length) return free.sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0]!.startsAt;
    }
    return null;
  }

  private card(d: DoctorRow, nextSlot: string | null): DoctorCard {
    const primary = d.fees[0];
    return {
      id: d.id,
      name: d.name,
      specialty: d.specialty,
      degrees: d.degrees,
      yearsExperience: d.yearsExperience,
      languages: d.languages,
      verified: true,
      clinic: primary ? { id: primary.clinic.id, name: primary.clinic.name, city: primary.clinic.city, area: primary.clinic.area } : null,
      fee: primary?.consult ?? null,
      nextSlot,
    };
  }

  async search(f: DoctorSearch): Promise<DoctorCard[]> {
    const clinicWhere: Prisma.ClinicWhereInput = {
      ...(f.city ? { city: { equals: f.city, mode: 'insensitive' } } : {}),
      ...(f.area ? { area: { contains: f.area, mode: 'insensitive' } } : {}),
    };
    const docs = await this.prisma.doctor.findMany({
      where: {
        verificationStatus: 'verified',
        ...(f.specialty ? { specialty: f.specialty } : {}),
        ...(f.language ? { languages: { has: f.language } } : {}),
        ...(f.q ? { name: { contains: f.q, mode: 'insensitive' } } : {}),
        ...(f.city || f.area || f.maxFee !== undefined
          ? { fees: { some: { ...(f.maxFee !== undefined ? { consult: { lte: f.maxFee } } : {}), clinic: clinicWhere } } }
          : {}),
      },
      include: doctorInclude,
      orderBy: { name: 'asc' },
      take: 50,
    });
    return Promise.all(docs.map(async (d) => this.card(d, await this.nextSlot(d))));
  }

  private async verifiedDoctor(id: string) {
    const d = await this.prisma.doctor.findUnique({ where: { id }, include: doctorInclude });
    if (!d || d.verificationStatus !== 'verified') throw NOT_FOUND('This doctor is not available on Medicos.');
    return d;
  }

  async profile(id: string): Promise<DoctorProfileView> {
    const d = await this.verifiedDoctor(id);
    const clinics: ClinicView[] = d.fees.map((f) => ({
      id: f.clinic.id,
      name: f.clinic.name,
      address: f.clinic.address,
      city: f.clinic.city,
      area: f.clinic.area,
      lat: f.clinic.lat,
      lng: f.clinic.lng,
      fee: { consult: f.consult, followUp: f.followUp, modes: f.modes },
      hours: d.schedules.filter((s) => s.clinicId === f.clinicId).map((s) => ({ weekday: s.weekday, start: s.start, end: s.end, slotMinutes: s.slotMinutes })),
    }));
    return { ...this.card(d, await this.nextSlot(d)), about: d.about, registrationNo: d.registrationNo, council: d.council, clinics };
  }

  async slots(doctorId: string, clinicId: string, date: string): Promise<SlotsView> {
    const d = await this.verifiedDoctor(doctorId);
    const today = istDate(new Date());
    if (date < today || date > addDays(today, DAYS_AHEAD)) return { date, clinicId, slots: [] };
    const taken = await this.takenFor(d.id, new Date(`${date}T00:00:00+05:30`), new Date(`${addDays(date, 1)}T00:00:00+05:30`));
    return { date, clinicId, slots: slotsFor(d.schedules as ScheduleRow[], clinicId, date, taken) };
  }

  async book(user: AuthUser, body: BookAppointment, req: Request): Promise<AppointmentView> {
    const profile = await this.prisma.patientProfile.findFirst({ where: { id: body.profileId, deletedAt: null } });
    if (!profile || !can({ userId: user.id, role: user.role }, 'patient_profile.update', { kind: 'patient_profile', ownerUserId: profile.ownerUserId, grants: [] })) {
      throw NOT_FOUND('Profile not found.');
    }
    const d = await this.verifiedDoctor(body.doctorId);
    const startsAt = new Date(body.startsAt);
    const today = istDate(new Date());
    if (!isScheduledSlot(d.schedules as ScheduleRow[], body.clinicId, startsAt) || startsAt.getTime() < Date.now() || istDate(startsAt) > addDays(today, DAYS_AHEAD)) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'SLOT_INVALID', 'Please pick one of the times shown.');
    }

    const session = body.sessionId
      ? await this.prisma.intakeSession.findFirst({ where: { id: body.sessionId, patientProfileId: profile.id } })
      : null;
    if (body.sessionId && !session) throw NOT_FOUND('Interview not found.');
    if (session?.doctorId && session.doctorId !== d.id) {
      throw new AppError(HttpStatus.CONFLICT, 'SESSION_OTHER_DOCTOR', 'This interview is already shared with another doctor.');
    }

    const appt = await this.prisma.$transaction(async (tx) => {
      // One booking per doctor per slot: serialise bookings for this doctor, then check.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${d.id}))`;
      const clash = await tx.appointment.findFirst({ where: { doctorId: d.id, startsAt, ...LIVE }, select: { id: true } });
      // Rebooking the interview's own "today" appointment to a real slot is not a clash.
      if (clash && clash.id !== session?.appointmentId) throw new AppError(HttpStatus.CONFLICT, 'SLOT_TAKEN', 'Someone just booked this time. Please pick another.');
      if (session?.appointmentId) {
        const own = await tx.appointment.findUnique({ where: { id: session.appointmentId } });
        if (own && own.doctorId === d.id && own.status === 'booked') {
          return tx.appointment.update({ where: { id: own.id }, data: { startsAt, clinicId: body.clinicId } });
        }
      }
      const created = await tx.appointment.create({
        data: { patientProfileId: profile.id, doctorId: d.id, clinicId: body.clinicId, startsAt, type: 'new', status: 'booked', source: 'patient_app' },
      });
      if (session) await tx.intakeSession.update({ where: { id: session.id }, data: { appointmentId: created.id, doctorId: d.id } });
      return created;
    });

    // AI-first order: the interview was finished before choosing a doctor — share its summary now (rule 10).
    if (session && !session.doctorId && session.status === 'submitted') {
      const latest = await this.prisma.preVisitSummary.findFirst({ where: { sessionId: session.id }, orderBy: { version: 'desc' } });
      if (latest) {
        await this.prisma.preVisitSummary.update({ where: { id: latest.id }, data: { status: 'delivered', deliveredAt: new Date() } });
        await meterDeliveredSummary(this.prisma, d.id);
        await this.summaries.shareWithDoctor({ id: session.id, patientProfileId: profile.id, appointmentId: appt.id, patientProfile: { ownerUserId: profile.ownerUserId } }, d.id);
      }
    }
    await this.audit.record({ actor: user, action: 'appointment.book', entity: 'appointment', entityId: appt.id, patientProfileId: profile.id, req });
    return this.view(appt.id);
  }

  private async view(id: string): Promise<AppointmentView> {
    const a = await this.prisma.appointment.findUniqueOrThrow({
      where: { id },
      include: { doctor: { include: { fees: true } }, clinic: true, patientProfile: true, intakeSessions: { include: { summaries: { where: { status: { in: ['delivered', 'reviewed'] } }, take: 1 } } } },
    });
    return {
      id: a.id,
      startsAt: a.startsAt.toISOString(),
      status: a.status,
      type: a.type,
      doctor: { id: a.doctor.id, name: a.doctor.name, specialty: a.doctor.specialty },
      clinic: { id: a.clinic.id, name: a.clinic.name, address: a.clinic.address, city: a.clinic.city },
      fee: a.doctor.fees.find((f) => f.clinicId === a.clinicId)?.consult ?? null,
      summaryAttached: a.intakeSessions.some((s) => s.summaries.length > 0),
      profile: { id: a.patientProfile.id, name: this.crypto.decrypt(a.patientProfile.nameEnc, ENC.name) },
    };
  }

  async mine(user: AuthUser, req: Request): Promise<AppointmentView[]> {
    const rows = await this.prisma.appointment.findMany({
      where: { patientProfile: { ownerUserId: user.id, deletedAt: null } },
      orderBy: { startsAt: 'desc' },
      take: 50,
      select: { id: true },
    });
    await this.audit.record({ actor: user, action: 'appointment.list', entity: 'appointment', req });
    return Promise.all(rows.map((r) => this.view(r.id)));
  }

  async cancel(user: AuthUser, id: string, req: Request): Promise<AppointmentView> {
    const a = await this.prisma.appointment.findUnique({ where: { id }, include: { patientProfile: true } });
    if (!a || a.patientProfile.ownerUserId !== user.id) throw NOT_FOUND();
    if (!['booked', 'confirmed'].includes(a.status)) throw new AppError(HttpStatus.CONFLICT, 'CANNOT_CANCEL', 'This visit can no longer be cancelled.');
    await this.prisma.appointment.update({ where: { id }, data: { status: 'cancelled' } });
    await this.audit.record({ actor: user, action: 'appointment.cancel', entity: 'appointment', entityId: id, patientProfileId: a.patientProfileId, req });
    return this.view(id);
  }
}
