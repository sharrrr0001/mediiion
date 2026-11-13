import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { OpsService } from './ops.service';

const TemplateBody = z.object({ json: z.unknown() }).strict();
const FlagBody = z.object({ key: z.string().regex(/^[a-z0-9_.-]{2,40}$/), enabled: z.boolean() }).strict();
const TicketBody = z.object({ subject: z.string().trim().min(3).max(200) }).strict();

@ApiTags('admin')
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly ops: OpsService) {}

  @Get('overview')
  overview() {
    return this.ops.adminOverview();
  }

  @Get('safety-log')
  safety() {
    return this.ops.safetyLog();
  }

  @Get('audit')
  audit(@Query('action') action?: string) {
    return this.ops.auditLog(action?.slice(0, 60));
  }

  @Get('quality')
  quality() {
    return this.ops.qualityQueue();
  }

  @Get('templates')
  templates() {
    return this.ops.templates();
  }

  @Get('templates/:id')
  template(@Param('id', ParseUUIDPipe) id: string) {
    return this.ops.template(id);
  }

  @Post('templates/check')
  @HttpCode(HttpStatus.OK)
  @ZodBody(TemplateBody)
  check(@Body(new ZodPipe(TemplateBody)) body: { json: unknown }) {
    return this.ops.checkTemplate(body.json);
  }

  @Post('templates')
  @ZodBody(TemplateBody)
  draft(@CurrentUser() user: AuthUser, @Body(new ZodPipe(TemplateBody)) body: { json: unknown }, @Req() req: Request) {
    return this.ops.saveDraft(user, body.json, req);
  }

  @Post('templates/:id/publish')
  @HttpCode(HttpStatus.OK)
  publish(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.ops.publish(user, id, req);
  }

  @Get('support')
  tickets() {
    return this.ops.tickets();
  }

  @Post('support/:id/close')
  @HttpCode(HttpStatus.OK)
  close(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.ops.closeTicket(user, id, req);
  }
}

@ApiTags('founder')
@Roles('founder', 'admin')
@Controller('founder')
export class FounderController {
  constructor(private readonly ops: OpsService) {}

  @Get('metrics')
  metrics() {
    return this.ops.founderMetrics();
  }
}

@ApiTags('developer')
@Roles('developer', 'admin')
@Controller('developer')
export class DeveloperController {
  constructor(private readonly ops: OpsService) {}

  @Get('status')
  status() {
    return this.ops.developerStatus();
  }

  @Post('flags')
  @HttpCode(HttpStatus.OK)
  @ZodBody(FlagBody)
  flag(@CurrentUser() user: AuthUser, @Body(new ZodPipe(FlagBody)) body: { key: string; enabled: boolean }, @Req() req: Request) {
    return this.ops.setFlag(user, body.key, body.enabled, req);
  }

  @Post('jobs/run')
  @HttpCode(HttpStatus.OK)
  runJobs(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.ops.runJobs(user, req);
  }
}

@ApiTags('doctor')
@Roles('doctor')
@Controller('doctor/insights')
export class InsightsController {
  constructor(private readonly ops: OpsService) {}

  @Get()
  insights(@CurrentUser() user: AuthUser) {
    return this.ops.insights(user);
  }
}

/** Any signed-in user (patient, doctor, staff) can open a support ticket. */
@ApiTags('support')
@Roles('patient', 'doctor', 'staff')
@Controller('support')
export class SupportController {
  constructor(private readonly ops: OpsService) {}

  @Post()
  @ZodBody(TicketBody)
  create(@CurrentUser() user: AuthUser, @Body(new ZodPipe(TicketBody)) body: { subject: string }) {
    return this.ops.createTicket(user, body.subject);
  }
}

@Module({ controllers: [AdminController, FounderController, DeveloperController, InsightsController, SupportController], providers: [OpsService] })
export class OpsModule {}
