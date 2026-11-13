import { DynamicModule, Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { DeviceThrottlerGuard } from './common/throttler.guard';
import { LoggerModule } from 'nestjs-pino';
import type { DestinationStream } from 'pino';
import { randomUUID } from 'node:crypto';
import { AuditModule } from './audit/audit.service';
import { AuthModule } from './auth/auth.module';
import { AllExceptionsFilter } from './common/errors';
import { CoreModule } from './config/core.module';
import { IntakeModule } from './intake/intake.module';
import { DoctorModule } from './doctor/records';
import { BookingModule } from './booking/booking.controller';
import { AccessModule } from './access/access.controller';
import { OnboardingModule } from './onboarding/onboarding.controller';
import { loadEnv } from './config/env';
import { DevController, HealthController, PublicConfigController } from './health/health.controller';
import { pinoRedact, serializers } from './logging/redaction';
import { PatientsController } from './patients/patients.controller';
import { PatientsService } from './patients/patients.service';

export interface AppOptions {
  /** Tests pass a stream to inspect log output (e.g. the no-PHI-in-logs test). */
  logStream?: DestinationStream;
}

@Module({})
export class AppModule {
  static register(opts: AppOptions = {}): DynamicModule {
    const env = loadEnv();
    const pretty = env.NODE_ENV === 'development' && !opts.logStream;
    return {
      module: AppModule,
      imports: [
        CoreModule,
        AuditModule,
        LoggerModule.forRoot({
          pinoHttp: [
            {
              level: env.LOG_LEVEL,
              redact: pinoRedact,
              serializers,
              genReqId: () => randomUUID(),
              transport: pretty ? { target: 'pino-pretty', options: { singleLine: true } } : undefined,
            },
            opts.logStream,
          ].filter(Boolean) as never,
        }),
        ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
        AuthModule,
        IntakeModule,
        DoctorModule,
        BookingModule,
        AccessModule,
        OnboardingModule,
      ],
      controllers: [HealthController, PublicConfigController, DevController, PatientsController],
      providers: [
        PatientsService,
        { provide: APP_GUARD, useClass: DeviceThrottlerGuard },
        { provide: APP_FILTER, useClass: AllExceptionsFilter },
      ],
    };
  }
}
