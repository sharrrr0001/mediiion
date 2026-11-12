import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { randomInt } from 'node:crypto';
import { BIDX, ENC, type User } from '@medicos/db';
import {
  OTP_MAX_ATTEMPTS,
  OTP_RESEND_SECONDS,
  OTP_TTL_SECONDS,
  type OtpRequest,
  type OtpVerify,
} from '@medicos/shared';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { ENV, type Env } from '../config/env';
import { EMAIL_SENDER, SMS_SENDER, type OtpSender } from './messaging/messaging';

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_IDENTIFIER = 3; // per 10 minutes

const INVALID = () =>
  new AppError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Code galat hai ya expire ho gaya. / Code is wrong or expired.');

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
    @Inject(SMS_SENDER) private readonly sms: OtpSender,
    @Inject(EMAIL_SENDER) private readonly email: OtpSender,
    @Inject(ENV) private readonly env: Env,
  ) {}

  private identifier(input: OtpRequest) {
    return input.channel === 'sms'
      ? {
          value: input.phone,
          hash: this.crypto.blindIndex(input.phone, BIDX.phone),
          enc: this.crypto.encrypt(input.phone, ENC.phone),
        }
      : {
          value: input.email,
          hash: this.crypto.blindIndex(input.email, BIDX.email),
          enc: this.crypto.encrypt(input.email, ENC.email),
        };
  }

  private codeHash(challengeId: string, code: string) {
    return this.crypto.blindIndex(`${challengeId}:${code}`, BIDX.otp);
  }

  /** Never reveals whether an account exists for this phone/email. */
  async request(input: OtpRequest, ip: string) {
    const id = this.identifier(input);
    const ipHash = this.crypto.blindIndex(ip, BIDX.ip);
    const since = new Date(Date.now() - WINDOW_MS);

    const recent = await this.prisma.otpChallenge.findMany({
      where: { identifierHash: id.hash, createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });
    const last = recent[0];
    if (last) {
      const waitMs = last.createdAt.getTime() + OTP_RESEND_SECONDS * 1000 - Date.now();
      if (waitMs > 0) {
        throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'OTP_RESEND_WAIT', 'Please wait before requesting a new code.', {
          retryAfterSeconds: Math.ceil(waitMs / 1000),
        });
      }
    }
    const ipCount = await this.prisma.otpChallenge.count({ where: { ipHash, createdAt: { gte: since } } });
    if (recent.length >= MAX_PER_IDENTIFIER || ipCount >= this.env.OTP_MAX_PER_IP) {
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'OTP_RATE_LIMITED', 'Too many codes requested. Try again in 10 minutes.');
    }

    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const challenge = await this.prisma.otpChallenge.create({
      data: {
        channel: input.channel,
        identifierHash: id.hash,
        identifierEnc: id.enc,
        codeHash: 'pending',
        ipHash,
        expiresAt: new Date(Date.now() + OTP_TTL_SECONDS * 1000),
      },
    });
    await this.prisma.otpChallenge.update({
      where: { id: challenge.id },
      data: { codeHash: this.codeHash(challenge.id, code) },
    });

    await (input.channel === 'sms' ? this.sms : this.email).sendOtp(id.value, code);

    return { challengeId: challenge.id, expiresInSeconds: OTP_TTL_SECONDS, resendInSeconds: OTP_RESEND_SECONDS };
  }

  /** Verifies the code, then finds or creates the patient account. */
  async verify(input: OtpVerify): Promise<User> {
    const challenge = await this.prisma.otpChallenge.findUnique({ where: { id: input.challengeId } });
    if (!challenge || challenge.consumedAt || challenge.expiresAt.getTime() <= Date.now()) throw INVALID();

    // Atomic attempt counter: only succeeds while attempts < max.
    const bumped = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, attempts: { lt: OTP_MAX_ATTEMPTS }, consumedAt: null },
      data: { attempts: { increment: 1 } },
    });
    if (bumped.count === 0) {
      throw new AppError(HttpStatus.TOO_MANY_REQUESTS, 'OTP_LOCKED', 'Too many wrong attempts. Request a new code.');
    }

    if (!this.crypto.safeEqual(this.codeHash(challenge.id, input.code), challenge.codeHash)) {
      const attemptsLeft = OTP_MAX_ATTEMPTS - (challenge.attempts + 1);
      throw new AppError(HttpStatus.BAD_REQUEST, 'OTP_INVALID', 'Code galat hai. / Wrong code.', { attemptsLeft });
    }

    const consumed = await this.prisma.otpChallenge.updateMany({
      where: { id: challenge.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    if (consumed.count === 0) throw INVALID();

    const sms = challenge.channel === 'sms';
    const where = sms ? { phoneHash: challenge.identifierHash } : { emailHash: challenge.identifierHash };
    const user = await this.prisma.user.findUnique({ where });
    if (user) {
      if (user.status !== 'active') throw new AppError(HttpStatus.FORBIDDEN, 'ACCOUNT_INACTIVE', 'This account is not active.');
      return user;
    }
    const contact = sms ? { phoneEnc: challenge.identifierEnc } : { emailEnc: challenge.identifierEnc };
    return this.prisma.user.create({ data: { ...where, ...contact, role: 'patient' } });
  }

}
