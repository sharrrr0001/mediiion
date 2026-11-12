import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes, randomUUID } from 'node:crypto';
import { BIDX } from '@medicos/db';
import type { Role } from '@medicos/shared';
import { AppError } from '../common/errors';
import { CRYPTO, PrismaService, type FieldCrypto } from '../config/core.module';
import { ACCESS_TTL_SECONDS, REFRESH_TTL_DAYS } from './cookies';

export interface IssuedTokens {
  accessToken: string;
  refreshToken: string;
  sessionId: string;
}

/**
 * Short-lived JWT access tokens + opaque rotating refresh tokens (stored hashed).
 * Reusing an already-rotated refresh token revokes the whole session family (token theft signal).
 * Refresh tokens are bound to the device cookie.
 */
@Injectable()
export class SessionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(CRYPTO) private readonly crypto: FieldCrypto,
  ) {}

  private hashToken(token: string) {
    return this.crypto.blindIndex(token, BIDX.token);
  }

  private async issue(user: { id: string; role: Role }, familyId: string, deviceId: string, userAgent?: string) {
    const refreshToken = randomBytes(32).toString('base64url');
    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        familyId,
        refreshTokenHash: this.hashToken(refreshToken),
        deviceIdHash: this.hashToken(deviceId),
        userAgent: userAgent?.slice(0, 200),
        expiresAt: new Date(Date.now() + REFRESH_TTL_DAYS * 86400 * 1000),
      },
    });
    const accessToken = await this.jwt.signAsync(
      { sub: user.id, role: user.role, sid: session.id },
      { expiresIn: ACCESS_TTL_SECONDS },
    );
    return { accessToken, refreshToken, sessionId: session.id };
  }

  create(user: { id: string; role: Role }, deviceId: string, userAgent?: string): Promise<IssuedTokens> {
    return this.issue(user, randomUUID(), deviceId, userAgent);
  }

  async rotate(refreshToken: string, deviceId: string, userAgent?: string): Promise<IssuedTokens> {
    const unauth = new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Please log in again.');
    const session = await this.prisma.session.findUnique({
      where: { refreshTokenHash: this.hashToken(refreshToken) },
      include: { user: { select: { id: true, role: true, status: true } } },
    });
    if (!session) throw unauth;

    const reused = session.rotatedAt !== null || session.revokedAt !== null;
    const wrongDevice = !this.crypto.safeEqual(session.deviceIdHash, this.hashToken(deviceId));
    if (reused || wrongDevice) {
      await this.revokeFamily(session.familyId);
      throw unauth;
    }
    if (session.expiresAt.getTime() <= Date.now() || session.user.status !== 'active') throw unauth;

    // Mark rotated atomically so two parallel refreshes cannot both succeed.
    const marked = await this.prisma.session.updateMany({
      where: { id: session.id, rotatedAt: null, revokedAt: null },
      data: { rotatedAt: new Date(), lastUsedAt: new Date() },
    });
    if (marked.count === 0) throw unauth;

    return this.issue(session.user, session.familyId, deviceId, userAgent);
  }

  async revokeFamily(familyId: string) {
    await this.prisma.session.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: new Date() } });
  }

  async revokeSession(sessionId: string) {
    const s = await this.prisma.session.findUnique({ where: { id: sessionId }, select: { familyId: true } });
    if (s) await this.revokeFamily(s.familyId);
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
  }
}
