import { Body, Controller, Get, HttpCode, HttpStatus, Inject, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { randomUUID } from 'node:crypto';
import type { Request, Response } from 'express';
import { BIDX, ENC, type User } from '@medicos/db';
import { PasswordLogin, ResetPassword, SetPassword } from '@medicos/shared';
import { AuditService } from '../audit/audit.service';
import { AppError } from '../common/errors';
import { ZodBody, ZodPipe } from '../common/zod';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { ENV, type Env } from '../config/env';
import { DEVICE_COOKIE, setAuthCookies, setDeviceCookie } from './cookies';
import { CurrentUser, Public, type AuthUser } from './decorators';
import { maskEmail, maskPhone } from './messaging/messaging';
import { OtpService } from './otp.service';
import { dummyHash, hashPassword, verifyPassword } from './password';
import { SessionService } from './session.service';
import { TwoFactorService } from './two-factor.service';

const MAX_FAILS = 5;
const LOCK_MINUTES = 15;
const WRONG = () => new AppError(HttpStatus.UNAUTHORIZED, 'LOGIN_FAILED', 'Email or password is wrong. You can also log in with a code.');

/**
 * Password login (optional, after a first OTP login). OTP always remains available. Doctors, staff and
 * admins still pass TOTP 2FA after the password. 5 wrong passwords lock password login for 15 minutes.
 */
@ApiTags('auth')
@Controller('auth/password')
export class PasswordController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly twoFactor: TwoFactorService,
    private readonly otp: OtpService,
    private readonly audit: AuditService,
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

  /** Same finish as an OTP login: 2FA challenge for staff roles, otherwise a session. */
  private async finish(user: User, req: Request, res: Response, action: string) {
    if (user.status !== 'active') throw new AppError(HttpStatus.FORBIDDEN, 'ACCOUNT_INACTIVE', 'This account is not active.');
    if (this.twoFactor.required(user.role)) {
      const label = user.phoneEnc ? maskPhone(this.crypto.decrypt(user.phoneEnc, ENC.phone)) : user.emailEnc ? maskEmail(this.crypto.decrypt(user.emailEnc, ENC.email)) : 'account';
      await this.audit.record({ actor: user, action: `${action}_2fa_pending`, entity: 'user', entityId: user.id, req });
      return this.twoFactor.challenge(user, label);
    }
    const tokens = await this.sessions.create(user, this.deviceId(req, res), req.headers['user-agent']);
    setAuthCookies(res, this.env, tokens.accessToken, tokens.refreshToken);
    await this.audit.record({ actor: user, action, entity: 'session', entityId: tokens.sessionId, req });
    return { ok: true };
  }

  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ZodBody(PasswordLogin)
  async login(@Body(new ZodPipe(PasswordLogin)) body: PasswordLogin, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const where = 'email' in body ? { emailHash: this.crypto.blindIndex(body.email, BIDX.email) } : { phoneHash: this.crypto.blindIndex(body.phone, BIDX.phone) };
    const user = await this.prisma.user.findFirst({ where });
    if (!user?.passwordHash) {
      await verifyPassword(body.password, await dummyHash()); // same timing as a real check
      throw WRONG();
    }
    if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'PASSWORD_LOCKED', `Too many wrong tries. Log in with a code, or try again in ${minutes} min.`, { retryAfterSeconds: minutes * 60 });
    }
    if (!(await verifyPassword(body.password, user.passwordHash))) {
      const fails = user.failedLogins + 1;
      await this.prisma.user.update({
        where: { id: user.id },
        data: fails >= MAX_FAILS ? { failedLogins: 0, lockedUntil: new Date(Date.now() + LOCK_MINUTES * 60_000) } : { failedLogins: fails },
      });
      await this.audit.record({ actor: user, action: fails >= MAX_FAILS ? 'auth.password_locked' : 'auth.password_failed', entity: 'user', entityId: user.id, req });
      throw WRONG();
    }
    await this.prisma.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null } });
    return this.finish(user, req, res, 'auth.login_password');
  }

  /** Has this account set a password? (drives the "Set a password" prompt after an OTP login). */
  @Get()
  async status(@CurrentUser() me: AuthUser) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id }, select: { passwordHash: true, passwordSetAt: true } });
    return { hasPassword: !!u.passwordHash, setAt: u.passwordSetAt?.toISOString() ?? null };
  }

  /** First time: no current password needed (the user just proved the email/phone by OTP). To change, give the current one. */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  @ZodBody(SetPassword)
  async set(@CurrentUser() me: AuthUser, @Body(new ZodPipe(SetPassword)) body: SetPassword, @Req() req: Request) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: me.id } });
    if (u.passwordHash && !(body.currentPassword && (await verifyPassword(body.currentPassword, u.passwordHash)))) {
      throw new AppError(HttpStatus.BAD_REQUEST, 'CURRENT_PASSWORD_WRONG', 'Your current password is wrong. Forgot it? Log out and use "Forgot password".');
    }
    await this.prisma.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(body.password), passwordSetAt: new Date(), failedLogins: 0, lockedUntil: null } });
    await this.audit.record({ actor: me, action: u.passwordHash ? 'auth.password_changed' : 'auth.password_set', entity: 'user', entityId: me.id, req });
    return { ok: true };
  }

  /** Forgot password: a fresh OTP proves the email/phone; then the new password is saved and the user is logged in. */
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  @ZodBody(ResetPassword)
  async reset(@Body(new ZodPipe(ResetPassword)) body: ResetPassword, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const user = await this.otp.verify({ challengeId: body.challengeId, code: body.code });
    const updated = await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.password), passwordSetAt: new Date(), failedLogins: 0, lockedUntil: null } });
    await this.audit.record({ actor: user, action: 'auth.password_reset', entity: 'user', entityId: user.id, req });
    return this.finish(updated, req, res, 'auth.login_password_reset');
  }
}
