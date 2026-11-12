import { Body, Controller, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { OtpRequest, OtpVerify, TwoFactorVerify } from '@medicos/shared';
import { maskEmail, maskPhone } from './messaging/messaging';
import { ENC } from '@medicos/db';
import { CRYPTO, type FieldCrypto } from '../config/core.module';
import { TwoFactorService } from './two-factor.service';
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
    private readonly twoFactor: TwoFactorService,
    @Inject(ENV) private readonly env: Env,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private deviceId(req: Request, res: Response): string {
    const existing: unknown = req.cookies?.[DEVICE_COOKIE];
    if (typeof existing === 'string' && /^[0-9a-f-]{36}$/.test(existing)) return existing;
    const id = randomUUID();
    setDeviceCookie(res, this.env, id);
    return id;
  }

  @Public()
  // Flood guard only. Real limits (per phone number, per IP) live in OtpService; a low per-IP limit
  // here would lock out patients sharing one clinic Wi-Fi before they have a device cookie.
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
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
    if (this.twoFactor.required(user.role)) {
      // Doctor/staff/admin: no session until the TOTP step succeeds.
      const label = user.phoneEnc ? maskPhone(this.crypto.decrypt(user.phoneEnc, ENC.phone)) : user.emailEnc ? maskEmail(this.crypto.decrypt(user.emailEnc, ENC.email)) : 'account';
      await this.audit.record({ actor: user, action: 'auth.otp_ok_2fa_pending', entity: 'user', entityId: user.id, req });
      return this.twoFactor.challenge(user, label);
    }
    const tokens = await this.sessions.create(user, this.deviceId(req, res), req.headers['user-agent']);
    setAuthCookies(res, this.env, tokens.accessToken, tokens.refreshToken);
    await this.audit.record({ actor: user, action: 'auth.login', entity: 'session', entityId: tokens.sessionId, req });
    return { ok: true };
  }

  /** Second factor for doctor/staff/admin: enrol (first time) or verify a TOTP code. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa')
  @HttpCode(HttpStatus.OK)
  @ZodBody(TwoFactorVerify)
  async verifyTwoFactor(
    @Body(new ZodPipe(TwoFactorVerify)) body: TwoFactorVerify,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const user = await this.twoFactor.complete(body.ticket, body.code);
    const tokens = await this.sessions.create(user, this.deviceId(req, res), req.headers['user-agent']);
    setAuthCookies(res, this.env, tokens.accessToken, tokens.refreshToken);
    await this.audit.record({ actor: user, action: 'auth.login_2fa', entity: 'session', entityId: tokens.sessionId, req });
    return { ok: true, role: user.role };
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
