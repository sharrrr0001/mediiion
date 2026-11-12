import { Controller, Get, HttpStatus, Query } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../auth/decorators';
import { DevOutbox } from '../auth/messaging/messaging';
import { AppError } from '../common/errors';
import { PrismaService } from '../config/core.module';

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
