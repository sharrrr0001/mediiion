import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Injectable, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomBytes } from 'node:crypto';
import type { Request } from 'express';
import { BIDX, ENC } from '@medicos/db';
import { AI_DRAFT_LABEL, CreateShareLink, type ShareLinkView, type SharedSummaryView } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { IntakeModule } from '../intake/intake.module';
import { SummaryService, reidentify } from '../intake/summary.service';

const SHARE_HOURS = 72;
const NOT_FOUND = () => new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'This link has expired or was stopped by the patient.');

/**
 * "Share summary with a doctor not on Medicos" (spec §7.1 #9). The secret token lives only in the link;
 * the database keeps an HMAC of it. Links expire after 72 h and the patient can stop them at any time.
 */
@Injectable()
export class ShareService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly summaries: SummaryService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private async ownedSummaryEntry(user: AuthUser, recordId: string) {
    const r = await this.prisma.recordBookEntry.findUnique({ where: { id: recordId }, include: { patientProfile: true } });
    if (!r || r.kind !== 'pre_visit_summary' || r.patientProfile.ownerUserId !== user.id || r.patientProfile.deletedAt) {
      throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Summary not found.');
    }
    return r;
  }

  async create(user: AuthUser, recordId: string, req: Request): Promise<ShareLinkView> {
    const r = await this.ownedSummaryEntry(user, recordId);
    const token = randomBytes(24).toString('base64url');
    const link = await this.prisma.shareLink.create({
      data: { tokenHash: this.crypto.blindIndex(token, BIDX.token), patientProfileId: r.patientProfileId, summaryId: r.refId, expiresAt: new Date(Date.now() + SHARE_HOURS * 3600_000) },
    });
    await this.audit.record({ actor: user, action: 'share_link.create', entity: 'share_link', entityId: link.id, patientProfileId: r.patientProfileId, req });
    return { id: link.id, path: `/s/${token}`, expiresAt: link.expiresAt.toISOString(), revokedAt: null, openCount: 0 };
  }

  async list(user: AuthUser, recordId: string): Promise<ShareLinkView[]> {
    const r = await this.ownedSummaryEntry(user, recordId);
    const links = await this.prisma.shareLink.findMany({ where: { summaryId: r.refId, patientProfileId: r.patientProfileId }, orderBy: { createdAt: 'desc' }, take: 20 });
    return links.map((l) => ({ id: l.id, path: null, expiresAt: l.expiresAt.toISOString(), revokedAt: l.revokedAt?.toISOString() ?? null, openCount: l.openCount }));
  }

  async revoke(user: AuthUser, id: string, req: Request) {
    const l = await this.prisma.shareLink.findUnique({ where: { id }, include: { patientProfile: true } });
    if (!l || l.patientProfile.ownerUserId !== user.id) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found.');
    if (!l.revokedAt) await this.prisma.shareLink.update({ where: { id }, data: { revokedAt: new Date() } });
    await this.audit.record({ actor: user, action: 'share_link.revoke', entity: 'share_link', entityId: id, patientProfileId: l.patientProfileId, req });
    return { ok: true };
  }

  async open(token: string, req: Request): Promise<SharedSummaryView> {
    if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) throw NOT_FOUND();
    const l = await this.prisma.shareLink.findUnique({ where: { tokenHash: this.crypto.blindIndex(token, BIDX.token) }, include: { patientProfile: true } });
    if (!l || l.revokedAt || l.expiresAt.getTime() <= Date.now() || l.patientProfile.deletedAt) throw NOT_FOUND();
    const s = await this.prisma.preVisitSummary.findUnique({ where: { id: l.summaryId } });
    if (!s) throw NOT_FOUND();
    await this.prisma.shareLink.update({ where: { id: l.id }, data: { openCount: { increment: 1 } } });
    // Every read of patient data is audited, including anonymous reads through a share link (rule 10).
    await this.audit.record({ actor: null, action: 'share_link.open', entity: 'share_link', entityId: l.id, patientProfileId: l.patientProfileId, req });
    const p = l.patientProfile;
    const firstName = this.crypto.decrypt(p.nameEnc, ENC.name).split(' ')[0] ?? '';
    return {
      patient: { firstName, age: p.birthYear ? new Date().getFullYear() - p.birthYear : null, sex: p.gender === 'male' ? 'M' : p.gender === 'female' ? 'F' : '' },
      sharedAt: l.createdAt.toISOString(),
      expiresAt: l.expiresAt.toISOString(),
      aiLabel: AI_DRAFT_LABEL,
      summary: reidentify(this.summaries.decrypt(s.jsonEnc), firstName),
    };
  }
}

@ApiTags('share')
@Roles('patient')
@Controller('share-links')
export class ShareLinksController {
  constructor(private readonly share: ShareService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @ZodBody(CreateShareLink)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(CreateShareLink)) body: CreateShareLink, @Req() req: Request) {
    return this.share.create(user, body.recordId, req);
  }

  @Get('record/:recordId')
  list(@CurrentUser() user: AuthUser, @Param('recordId', ParseUUIDPipe) recordId: string) {
    return this.share.list(user, recordId);
  }

  @Post(':id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.share.revoke(user, id, req);
  }
}

@ApiTags('share')
@Public()
@Controller('shared')
export class SharedController {
  constructor(private readonly share: ShareService) {}

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Get(':token')
  open(@Param('token') token: string, @Req() req: Request) {
    return this.share.open(token, req);
  }
}

@Module({ imports: [IntakeModule], controllers: [ShareLinksController, SharedController], providers: [ShareService] })
export class ShareModule {}
