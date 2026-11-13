import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { DecideAccess, RequestAccess } from '@medicos/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { AccessService } from './access.service';

@ApiTags('doctor')
@Roles('doctor')
@Controller('doctor')
export class DoctorAccessController {
  constructor(private readonly access: AccessService) {}

  /** Scan QR / type Medicos ID → the patient gets an Allow / Deny prompt. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('access-requests')
  @ZodBody(RequestAccess)
  request(@CurrentUser() user: AuthUser, @Body(new ZodPipe(RequestAccess)) body: RequestAccess, @Req() req: Request) {
    return this.access.request(user, body.medicosId, req);
  }

  @Get('access-requests/:id')
  status(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.access.doctorView(user, id);
  }

  @Get('patients/:profileId')
  patient(@CurrentUser() user: AuthUser, @Param('profileId', ParseUUIDPipe) profileId: string, @Req() req: Request) {
    return this.access.patient(user, profileId, req);
  }
}

@ApiTags('access')
@Roles('patient')
@Controller('access')
export class PatientAccessController {
  constructor(private readonly access: AccessService) {}

  @Get('requests')
  pending(@CurrentUser() user: AuthUser) {
    return this.access.pendingForPatient(user);
  }

  @Post('requests/:id')
  @HttpCode(HttpStatus.OK)
  @ZodBody(DecideAccess)
  decide(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(DecideAccess)) body: DecideAccess, @Req() req: Request) {
    return this.access.decide(user, id, body.decision, req);
  }

  @Get('grants')
  grants(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.access.grants(user, req);
  }

  @Post('grants/:id/revoke')
  @HttpCode(HttpStatus.OK)
  revoke(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.access.revoke(user, id, req);
  }
}

@Module({ controllers: [DoctorAccessController, PatientAccessController], providers: [AccessService], exports: [AccessService] })
export class AccessModule {}
