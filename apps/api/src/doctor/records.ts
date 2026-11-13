import { Controller, Get, HttpStatus, Inject, Injectable, Module, Param, ParseUUIDPipe, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { ENC } from '@medicos/db';
import type { RecordDetailView, RecordEntryView } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { IntakeModule } from '../intake/intake.module';
import { SummaryService, reidentify } from '../intake/summary.service';
import { DoctorController } from './doctor.controller';
import { DoctorService } from './doctor.service';

/** The patient's Medical Record Book (spec §7.1 #12). Owner-only; every read audited. */
@Injectable()
export class RecordsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly summaries: SummaryService,
    private readonly doctors: DoctorService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  async list(user: AuthUser, req: Request): Promise<RecordEntryView[]> {
    const rows = await this.prisma.recordBookEntry.findMany({
      where: { patientProfile: { ownerUserId: user.id, deletedAt: null } },
      include: { patientProfile: { select: { nameEnc: true } } },
      orderBy: { date: 'desc' },
      take: 100,
    });
    await this.audit.record({ actor: user, action: 'record_book.list', entity: 'record_book', req });
    return rows.map((r) => ({ id: r.id, kind: r.kind, date: r.date.toISOString(), title: r.title, patientName: this.crypto.decrypt(r.patientProfile.nameEnc, ENC.name) }));
  }

  async detail(user: AuthUser, id: string, req: Request): Promise<RecordDetailView> {
    const r = await this.prisma.recordBookEntry.findUnique({ where: { id }, include: { patientProfile: true } });
    if (!r || r.patientProfile.ownerUserId !== user.id || r.patientProfile.deletedAt) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Record not found.');
    await this.audit.record({ actor: user, action: 'record_book.read', entity: 'record_book_entry', entityId: id, patientProfileId: r.patientProfileId, req });
    const patientName = this.crypto.decrypt(r.patientProfile.nameEnc, ENC.name);
    const base = { id: r.id, kind: r.kind, date: r.date.toISOString(), title: r.title, patientName };
    if (r.kind === 'pre_visit_summary') {
      const s = await this.prisma.preVisitSummary.findUnique({ where: { id: r.refId } });
      return { ...base, note: null, summary: s ? reidentify(this.summaries.decrypt(s.jsonEnc), patientName.split(' ')[0] ?? patientName) : null };
    }
    const noteId = r.kind === 'prescription' ? (await this.prisma.prescription.findUnique({ where: { id: r.refId } }))?.noteId : r.refId;
    const note = noteId
      ? await this.prisma.doctorNote.findUnique({
          where: { id: noteId },
          include: { prescriptions: { include: { items: true } }, appointment: { include: { doctor: { select: { name: true } } } } },
        })
      : null;
    return { ...base, summary: null, note: note?.finalisedAt ? this.doctors.noteView(note, note.appointment.doctor.name) : null };
  }
}

@ApiTags('records')
@Roles('patient')
@Controller('records')
export class RecordsController {
  constructor(private readonly records: RecordsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.records.list(user, req);
  }

  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.records.detail(user, id, req);
  }
}

@Module({
  imports: [IntakeModule],
  controllers: [DoctorController, RecordsController],
  providers: [DoctorService, RecordsService],
})
export class DoctorModule {}
