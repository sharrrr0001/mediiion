import { Controller, Get, HttpStatus, Inject, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { DevOutbox } from '../auth/messaging/messaging';
import { AppError } from '../common/errors';
import { PrismaService } from '../config/core.module';
import { ENV, type Env } from '../config/env';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @SkipThrottle()
  @Get()
  async health() {
    let db: 'up' | 'down' = 'up';
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      db = 'down';
    }
    return { status: db === 'up' ? 'ok' : 'degraded', db };
  }
}

/** Dev/test only: read the last OTP sent to a recipient. 404 unless DEV_OUTBOX is on (never in production). */
@ApiTags('dev')
@Controller('dev')
export class DevController {
  constructor(private readonly outbox: DevOutbox) {}

  @Public()
  @SkipThrottle()
  @Get('outbox')
  latest(@Query('to') to: string) {
    if (!this.outbox.enabled) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'Not found');
    const code = this.outbox.latest(to);
    if (!code) throw new AppError(HttpStatus.NOT_FOUND, 'NOT_FOUND', 'No message');
    return { code };
  }
}

/** What the web app may offer: login channels, voice, and whether this is a demo (fictional data only). */
@ApiTags('health')
@Controller('config')
export class PublicConfigController {
  constructor(@Inject(ENV) private readonly env: Env) {}

  @Public()
  @SkipThrottle()
  @Get()
  config() {
    const ai = this.env.LLM_PROVIDER === 'anthropic' ? 'claude' : this.env.LLM_PROVIDER === 'mock' ? 'scripted' : this.env.LLM_PROVIDER;
    return {
      demo: this.env.DEMO_MODE,
      ai,
      channels: this.env.PHONE_LOGIN ? ['sms', 'email'] : ['email'],
      voice: this.env.VOICE_ENABLED,
    };
  }
}
