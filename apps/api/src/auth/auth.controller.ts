import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { OtpRequest, OtpVerify } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { ENV, type Env } from '../config/env';
import { DEVICE_COOKIE, REFRESH_COOKIE, clearAuthCookies, setAuthCookies, setDeviceCookie } from './cookies';
import { CurrentUser, Public, type AuthUser } from './decorators';
import { OtpService } from './otp.service';
import { SessionService } from './session.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly otp: OtpService,
    private readonly sessions: SessionService,
    private readonly audit: AuditService,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private deviceId(req: Request, res: Response): string {
    const existing: unknown = req.cookies?.[DEVICE_COOKIE];
    if (typeof existing === 'string' && /^[0-9a-f-]{36}$/.test(existing)) return existing;
    const id = randomUUID();
    setDeviceCookie(res, this.env, id);
    return id;
  }

  @Public()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('otp/request')
  @ZodBody(OtpRequest)
  async requestOtp(@Body(new ZodPipe(OtpRequest)) body: OtpRequest, @Req() req: Request) {
    return this.otp.request(body, req.ip ?? 'unknown');
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('otp/verify')
  @HttpCode(HttpStatus.OK)
  @ZodBody(OtpVerify)
  async verifyOtp(
    @Body(new ZodPipe(OtpVerify)) body: OtpVerify,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.otp.verify(body);
    const tokens = await this.sessions.create(user, this.deviceId(req, res), req.headers['user-agent']);
    setAuthCookies(res, this.env, tokens.accessToken, tokens.refreshToken);
    await this.audit.record({ actor: user, action: 'auth.login', entity: 'session', entityId: tokens.sessionId, req });
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token: unknown = req.cookies?.[REFRESH_COOKIE];
    const device: unknown = req.cookies?.[DEVICE_COOKIE];
    if (typeof token !== 'string' || typeof device !== 'string') {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Please log in again.');
    }
    try {
      const tokens = await this.sessions.rotate(token, device, req.headers['user-agent']);
      setAuthCookies(res, this.env, tokens.accessToken, tokens.refreshToken);
      return { ok: true };
    } catch (e) {
      clearAuthCookies(res, this.env);
      throw e;
    }
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeSession(user.sessionId);
    clearAuthCookies(res, this.env);
    await this.audit.record({ actor: user, action: 'auth.logout', entity: 'session', entityId: user.sessionId, req });
    return { ok: true };
  }

  @Post('logout-all')
  @HttpCode(HttpStatus.OK)
  async logoutAll(@CurrentUser() user: AuthUser, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.sessions.revokeAllForUser(user.id);
    clearAuthCookies(res, this.env);
    await this.audit.record({ actor: user, action: 'auth.logout_all', entity: 'user', entityId: user.id, req });
    return { ok: true };
  }
}
