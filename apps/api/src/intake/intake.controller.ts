/// <reference types="multer" />
import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import {
  ATTACHMENT_KINDS,
  EditIntakeAnswer,
  MAX_UPLOAD_BYTES,
  PostIntakeMessage,
  SetIntakeLanguage,
  StartIntake,
  type Language,
} from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { AttachmentsService } from './attachments.service';
import { IntakeService } from './intake.service';

const UploadMeta = z.object({ kind: z.enum(ATTACHMENT_KINDS), label: z.string().max(80).optional() });

@ApiTags('intake')
@Roles('patient')
@Controller('intake/sessions')
export class IntakeController {
  constructor(
    private readonly intake: IntakeService,
    private readonly attachments: AttachmentsService,
    private readonly audit: AuditService,
  ) {}

  @Post()
  @ZodBody(StartIntake)
  start(@CurrentUser() user: AuthUser, @Body(new ZodPipe(StartIntake)) body: StartIntake, @Req() req: Request) {
    return this.intake.start(user, body, req);
  }

  @Get()
  listOpen(@CurrentUser() user: AuthUser) {
    return this.intake.listOpen(user);
  }

  @Get(':id')
  view(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.intake.view(user, id, req);
  }

  /** AI calls cost money: per-user limit on top of the global throttle. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/messages')
  @HttpCode(HttpStatus.OK)
  @ZodBody(PostIntakeMessage)
  message(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(PostIntakeMessage)) body: { text: string },
    @Req() req: Request,
  ) {
    return this.intake.postMessage(user, id, body.text, req);
  }

  @Post(':id/continue')
  @HttpCode(HttpStatus.OK)
  continueAfterSafety(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.intake.continueAfterSafety(user, id, req);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/next')
  @HttpCode(HttpStatus.OK)
  next(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.intake.next(user, id, req);
  }

  @Post(':id/pause')
  @HttpCode(HttpStatus.OK)
  pause(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.intake.pause(user, id, req);
  }

  @Patch(':id/language')
  @ZodBody(SetIntakeLanguage)
  language(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(SetIntakeLanguage)) body: { language: Language },
    @Req() req: Request,
  ) {
    return this.intake.setLanguage(user, id, body.language, req);
  }

  @Get(':id/review')
  review(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.intake.review(user, id, req);
  }

  @Patch(':id/answers/:messageId')
  @ZodBody(EditIntakeAnswer)
  editAnswer(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
    @Body(new ZodPipe(EditIntakeAnswer)) body: { text: string },
    @Req() req: Request,
  ) {
    return this.intake.editAnswer(user, id, messageId, body.text, req);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.intake.submit(user, id, req);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/attachments')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } }))
  async upload(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodPipe(UploadMeta)) meta: z.infer<typeof UploadMeta>,
    @Req() req: Request,
  ) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'NO_FILE', 'Please choose a file.');
    const view = await this.intake.view(user, id, req, false); // ownership check (rule 10)
    if (view.status === 'submitted') throw new AppError(HttpStatus.CONFLICT, 'INTAKE_STATE', 'This interview was already sent.');
    const attachmentId = await this.attachments.upload({ sessionId: id, profileId: view.profileId, kind: meta.kind, label: meta.label, file: file.buffer });
    await this.audit.record({ actor: user, action: 'attachment.upload', entity: 'attachment', entityId: attachmentId, patientProfileId: view.profileId, req });
    return this.intake.view(user, id, req, false);
  }
}
