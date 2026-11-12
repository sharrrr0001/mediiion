import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { CreatePatientProfile, GrantConsent } from '@medicos/shared';
import { CurrentUser, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { PatientsService } from './patients.service';

@ApiTags('patients')
@Controller()
export class PatientsController {
  constructor(private readonly patients: PatientsService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.patients.me(user, req);
  }

  @Post('consents')
  @ZodBody(GrantConsent)
  grantConsent(@CurrentUser() user: AuthUser, @Body(new ZodPipe(GrantConsent)) body: GrantConsent, @Req() req: Request) {
    return this.patients.grantConsent(user, body, req);
  }

  @Post('patients/profiles')
  @ZodBody(CreatePatientProfile)
  createProfile(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(CreatePatientProfile)) body: CreatePatientProfile,
    @Req() req: Request,
  ) {
    return this.patients.createProfile(user, body, req);
  }

  @Get('patients/profiles/:id')
  getProfile(@CurrentUser() user: AuthUser, @Param('id', new ParseUUIDPipe()) id: string, @Req() req: Request) {
    return this.patients.getProfile(user, id, req);
  }
}
