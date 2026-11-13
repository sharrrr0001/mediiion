import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { BookAppointment, DoctorSearch, SlotsQuery } from '@medicos/shared';
import { CurrentUser, Public, Roles, type AuthUser } from '../auth/decorators';
import { ZodBody, ZodPipe } from '../common/zod';
import { IntakeModule } from '../intake/intake.module';
import { BookingService } from './booking.service';

/** Verified doctors' public business details (name, clinic, fee, timings). No patient data. */
@ApiTags('doctors')
@Public()
@Controller('doctors')
export class DoctorsDirectoryController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  search(@Query(new ZodPipe(DoctorSearch)) q: DoctorSearch) {
    return this.booking.search(q);
  }

  @Get(':id')
  profile(@Param('id', ParseUUIDPipe) id: string) {
    return this.booking.profile(id);
  }

  @Get(':id/slots')
  slots(@Param('id', ParseUUIDPipe) id: string, @Query(new ZodPipe(SlotsQuery)) q: SlotsQuery) {
    return this.booking.slots(id, q.clinicId, q.date);
  }
}

@ApiTags('appointments')
@Roles('patient')
@Controller('appointments')
export class AppointmentsController {
  constructor(private readonly booking: BookingService) {}

  @Get()
  mine(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.booking.mine(user, req);
  }

  @Post()
  @ZodBody(BookAppointment)
  book(@CurrentUser() user: AuthUser, @Body(new ZodPipe(BookAppointment)) body: BookAppointment, @Req() req: Request) {
    return this.booking.book(user, body, req);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.booking.cancel(user, id, req);
  }
}

@Module({
  imports: [IntakeModule],
  controllers: [DoctorsDirectoryController, AppointmentsController],
  providers: [BookingService],
})
export class BookingModule {}
