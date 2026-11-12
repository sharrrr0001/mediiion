import { HttpStatus, Injectable } from '@nestjs/common';
import { createHash, randomUUID } from 'node:crypto';
import { ATTACHMENT_KINDS, MAX_UPLOAD_BYTES, type IntakeAttachmentView } from '@medicos/shared';
import { AppError } from '../common/errors';
import { PrismaService } from '../config/core.module';
import { StorageService, scanForMalware, sniffMime } from './storage.service';

type Kind = (typeof ATTACHMENT_KINDS)[number];

/** Patient uploads (attach only in v1 — no AI reading of photos, spec §5). */
@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async upload(args: { sessionId: string; profileId: string; kind: Kind; label?: string; file: Buffer }) {
    const { file } = args;
    if (file.length === 0 || file.length > MAX_UPLOAD_BYTES) {
      throw new AppError(HttpStatus.PAYLOAD_TOO_LARGE, 'FILE_TOO_LARGE', 'File is too large (max 8 MB).');
    }
    const mime = sniffMime(file);
    if (!mime) throw new AppError(HttpStatus.UNSUPPORTED_MEDIA_TYPE, 'FILE_TYPE', 'Please upload a photo (JPG, PNG, WEBP, HEIC) or a PDF.');
    if ((await scanForMalware(file)) !== 'clean') throw new AppError(HttpStatus.UNPROCESSABLE_ENTITY, 'FILE_REJECTED', 'This file could not be accepted.');

    // Random key: no patient data or original file name in object paths.
    const key = `patients/${args.profileId}/${randomUUID()}`;
    await this.storage.put(key, file, mime);
    const row = await this.prisma.attachment.create({
      data: {
        ownerPatientProfileId: args.profileId,
        sessionId: args.sessionId,
        kind: args.kind,
        label: args.label?.slice(0, 80) ?? null,
        s3Key: key,
        mime,
        sizeBytes: file.length,
        sha256: createHash('sha256').update(file).digest('hex'),
      },
    });
    return row.id;
  }

  async listForSession(sessionId: string): Promise<IntakeAttachmentView[]> {
    const rows = await this.prisma.attachment.findMany({ where: { sessionId }, orderBy: { createdAt: 'asc' } });
    return Promise.all(
      rows.map(async (a) => ({ id: a.id, kind: a.kind, mime: a.mime, label: a.label, url: await this.storage.signedGetUrl(a.s3Key) })),
    );
  }
}
