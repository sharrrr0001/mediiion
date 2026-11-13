import { Body, Controller, Get, HttpCode, HttpStatus, Module, Param, ParseUUIDPipe, Post, Put, Req, UploadedFile, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiConsumes, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request } from 'express';
import { z } from 'zod';
import { ClinicSetup, DOC_KINDS, DoctorProfileUpdate, DoctorSignup, VerificationDecision } from '@medicos/shared';
import { AuthModule } from '../auth/auth.module';
import { CurrentUser, Roles, type AuthUser } from '../auth/decorators';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { IntakeModule } from '../intake/intake.module';
import { OnboardingService } from './onboarding.service';

/** Step 2 of doctor onboarding: a freshly OTP-verified account asks to become a doctor. */
@ApiTags('doctor-onboarding')
@Roles('patient')
@Controller('doctor-signup')
export class DoctorSignupController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  @ZodBody(DoctorSignup)
  signup(@CurrentUser() user: AuthUser, @Body(new ZodPipe(DoctorSignup)) body: DoctorSignup, @Req() req: Request) {
    return this.onboarding.signup(user, body, req);
  }
}

/** Steps 3–7 (pending doctors can use these before verification). */
@ApiTags('doctor-onboarding')
@Roles('doctor')
@Controller('doctor/onboarding')
export class OnboardingController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  view(@CurrentUser() user: AuthUser) {
    return this.onboarding.view(user);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('documents')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024, files: 1 } }))
  upload(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body(new ZodPipe(z.object({ kind: z.enum(DOC_KINDS) }))) body: { kind: (typeof DOC_KINDS)[number] },
    @Req() req: Request,
  ) {
    if (!file) throw new AppError(HttpStatus.BAD_REQUEST, 'NO_FILE', 'Please choose a file.');
    return this.onboarding.uploadDocument(user, body.kind, file.buffer, req);
  }

  @Put('clinic')
  @ZodBody(ClinicSetup)
  clinic(@CurrentUser() user: AuthUser, @Body(new ZodPipe(ClinicSetup)) body: ClinicSetup, @Req() req: Request) {
    return this.onboarding.setupClinic(user, body, req);
  }

  @Put('profile')
  @ZodBody(DoctorProfileUpdate)
  profile(@CurrentUser() user: AuthUser, @Body(new ZodPipe(DoctorProfileUpdate)) body: DoctorProfileUpdate) {
    return this.onboarding.updateProfile(user, body);
  }
}

/** Admin: doctor verification queue (spec §7.5). Approve/reject is always a human decision. */
@ApiTags('admin')
@Roles('admin')
@Controller('admin/verifications')
export class VerificationController {
  constructor(private readonly onboarding: OnboardingService) {}

  @Get()
  queue(@CurrentUser() user: AuthUser, @Req() req: Request) {
    return this.onboarding.queue(user, req);
  }

  @Post(':doctorId')
  @HttpCode(HttpStatus.OK)
  @ZodBody(VerificationDecision)
  decide(@CurrentUser() user: AuthUser, @Param('doctorId', ParseUUIDPipe) doctorId: string, @Body(new ZodPipe(VerificationDecision)) body: VerificationDecision, @Req() req: Request) {
    return this.onboarding.decide(user, doctorId, body, req);
  }
}

@Module({
  imports: [AuthModule, IntakeModule],
  controllers: [DoctorSignupController, OnboardingController, VerificationController],
  providers: [OnboardingService],
})
export class OnboardingModule {}
