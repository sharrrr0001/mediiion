import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ENC } from '@medicos/db';
import { ROLES_REQUIRING_2FA, type Role } from '@medicos/shared';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { generateTotpSecret, otpauthUrl, verifyTotp } from './totp';

const TICKET_TTL_SECONDS = 5 * 60;

interface TicketClaims {
  sub: string;
  purpose: '2fa';
  /** Present only while enrolling: the new secret, signed so the client cannot swap it. */
  enrol?: string;
}

export type TwoFactorChallenge =
  | { twoFactor: 'verify'; ticket: string }
  | { twoFactor: 'setup'; ticket: string; secret: string; otpauthUrl: string };

/** TOTP 2FA for doctor/staff/admin roles (spec §4/§11). Patients sign in with OTP only. */
@Injectable()
export class TwoFactorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  required(role: Role) {
    return ROLES_REQUIRING_2FA.includes(role);
  }

  async challenge(user: { id: string; totpSecretEnc: string | null }, accountLabel: string): Promise<TwoFactorChallenge> {
    if (user.totpSecretEnc) {
      const ticket = await this.jwt.signAsync({ sub: user.id, purpose: '2fa' } satisfies TicketClaims, { expiresIn: TICKET_TTL_SECONDS });
      return { twoFactor: 'verify', ticket };
    }
    const secret = generateTotpSecret();
    const ticket = await this.jwt.signAsync({ sub: user.id, purpose: '2fa', enrol: secret } satisfies TicketClaims, { expiresIn: TICKET_TTL_SECONDS });
    return { twoFactor: 'setup', ticket, secret, otpauthUrl: otpauthUrl(secret, accountLabel) };
  }

  /** Verifies the code; on first use stores the enrolled secret. Returns the signed-in user. */
  async complete(ticket: string, code: string) {
    const invalid = () => new AppError(HttpStatus.UNAUTHORIZED, 'TOTP_INVALID', 'That code is not right. Check the time on your phone and try again.');
    let claims: TicketClaims;
    try {
      claims = await this.jwt.verifyAsync<TicketClaims>(ticket);
    } catch {
      throw new AppError(HttpStatus.UNAUTHORIZED, 'TICKET_EXPIRED', 'Please log in again.');
    }
    if (claims.purpose !== '2fa') throw invalid();
    const user = await this.prisma.user.findUnique({ where: { id: claims.sub } });
    if (!user || user.status !== 'active') throw invalid();

    const secret = claims.enrol ?? (user.totpSecretEnc ? this.crypto.decrypt(user.totpSecretEnc, ENC.totp) : null);
    if (!secret) throw invalid();
    const step = verifyTotp(secret, code);
    if (step === null || (user.totpLastStep !== null && step <= user.totpLastStep)) throw invalid();

    // Atomic replay guard: only one request can claim this time step.
    const updated = await this.prisma.user.updateMany({
      where: { id: user.id, OR: [{ totpLastStep: null }, { totpLastStep: { lt: step } }] },
      data: {
        totpLastStep: step,
        ...(claims.enrol && !user.totpSecretEnc ? { totpSecretEnc: this.crypto.encrypt(claims.enrol, ENC.totp) } : {}),
      },
    });
    if (updated.count === 0) throw invalid();
    return user;
  }
}
