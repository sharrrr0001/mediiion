import { Body, Controller, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { FinaliseNote, SummaryFeedbackInput } from '@medicos/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { DoctorService } from './doctor.service';

@ApiTags('doctor')
@Roles('doctor')
@Controller('doctor')
export class DoctorController {
  constructor(private readonly doctors: DoctorService) {}

  @Get('me')
  me(@CurrentUser() user: AuthUser) {
    return this.doctors.me(user);
  }

  @Get('queue')
  queue(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.doctors.queue(user, req);
  }

  @Get('appointments/:id')
  summary(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.doctors.summary(user, id, req);
  }

  @Post('appointments/:id/finalise')
  @HttpCode(HttpStatus.OK)
  @ZodBody(FinaliseNote)
  finalise(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(FinaliseNote)) body: FinaliseNote, @Req() req: Request) {
    return this.doctors.finalise(user, id, body, req);
  }

  @Post('summaries/:id/feedback')
  @ZodBody(SummaryFeedbackInput)
  feedback(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Body(new ZodPipe(SummaryFeedbackInput)) body: SummaryFeedbackInput) {
    return this.doctors.feedback(user, id, body);
  }
}
