import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ENV, type Env } from '../config/env';
import { AuthController } from './auth.controller';
import { AuthGuard, OriginGuard } from './guards';
import { ConsoleSmsSender, DevOutbox, EMAIL_SENDER, SMS_SENDER, SmtpEmailSender } from './messaging/messaging';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ENV],
      useFactory: (env: Env) => ({ secret: env.JWT_SECRET, signOptions: { algorithm: 'HS256' } }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    OtpService,
    SessionService,
    TwoFactorService,
    DevOutbox,
    { provide: SMS_SENDER, useClass: ConsoleSmsSender },
    { provide: EMAIL_SENDER, useClass: SmtpEmailSender },
    // Order matters: origin check, then authentication (deny by default).
    { provide: APP_GUARD, useClass: OriginGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
  ],
  exports: [DevOutbox, SessionService],
})
export class AuthModule {}
