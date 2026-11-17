import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { ReplyWaitingPing, SendWaitingPing } from '@medicos/shared';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { WaitingService } from './waiting.service';

@ApiTags('waiting-room')
@Roles('patient')
@Controller('waiting')
export class PatientWaitingController {
  constructor(private readonly waiting: WaitingService) {}

  @Get('today')
  today(@CurrentUser() user: AuthUser) {
    return this.waiting.today(user);
  }

  /** "I have arrived" / "May I come in?" — at most one per visit every 150 s (also a route flood guard). */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':appointmentId/ping')
  @ZodBody(SendWaitingPing)
  ping(@CurrentUser() user: AuthUser, @Param('appointmentId', ParseUUIDPipe) id: string, @Body(new ZodPipe(SendWaitingPing)) body: SendWaitingPing, @Req() req: Request) {
    return this.waiting.ping(user, id, body.kind, req);
  }
}

@ApiTags('waiting-room')
@Roles('staff', 'doctor')
@Controller('clinic/waiting')
export class ClinicWaitingController {
  constructor(private readonly waiting: WaitingService) {}

  @Get()
  board(@CurrentUser() user: AuthUser) {
    return this.waiting.board(user);
  }

  @Post(':pingId/reply')
  @HttpCode(HttpStatus.OK)
  @ZodBody(ReplyWaitingPing)
  reply(@CurrentUser() user: AuthUser, @Param('pingId', ParseUUIDPipe) pingId: string, @Body(new ZodPipe(ReplyWaitingPing)) body: ReplyWaitingPing, @Req() req: Request) {
    return this.waiting.reply(user, pingId, body, req);
  }
}

@Module({ controllers: [PatientWaitingController, ClinicWaitingController], providers: [WaitingService] })
export class WaitingModule {}
