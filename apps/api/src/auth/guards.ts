import { CanActivate, ExecutionContext, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@medicos/shared';
import { AppError } from '../common/errors';
import { ENV, type Env } from '../config/env';
import { PrismaService } from '../config/core.module';
import { IS_PUBLIC, ROLES_KEY, type AuthedRequest } from './decorators';
import { ACCESS_COOKIE } from './cookies';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF defence for cookie auth: state-changing requests from a browser must come from a known origin.
 * (Cookies are also SameSite=Strict.) Requests without an Origin header are non-browser clients.
 */
@Injectable()
export class OriginGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    if (SAFE_METHODS.has(req.method)) return true;
    const origin = req.headers.origin;
    if (!origin || this.env.WEB_ORIGINS.includes(origin)) return true;
    throw new AppError(HttpStatus.FORBIDDEN, 'BAD_ORIGIN', 'Request origin not allowed.');
  }
}

interface AccessClaims {
  sub: string;
  role: Role;
  sid: string;
}

/** Global auth guard — deny by default unless the route is @Public(). */
@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    if (isPublic) return true;

    const req = ctx.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[ACCESS_COOKIE];
    if (typeof token !== 'string' || !token) throw this.unauthenticated();

    let claims: AccessClaims;
    try {
      claims = await this.jwt.verifyAsync<AccessClaims>(token);
    } catch {
      throw this.unauthenticated();
    }

    // Session check makes logout immediate (not "valid until JWT expiry").
    const session = await this.prisma.session.findUnique({
      where: { id: claims.sid },
      select: { revokedAt: true, userId: true, user: { select: { status: true, role: true } } },
    });
    if (!session || session.revokedAt || session.userId !== claims.sub || session.user.status !== 'active') {
      throw this.unauthenticated();
    }

    req.user = { id: claims.sub, role: session.user.role, sessionId: claims.sid };

    const roles = this.reflector.getAllAndOverride<Role[] | undefined>(ROLES_KEY, [ctx.getHandler(), ctx.getClass()]);
    if (roles && !roles.includes(req.user.role)) {
      throw new AppError(HttpStatus.FORBIDDEN, 'FORBIDDEN', 'You do not have access to this.');
    }
    return true;
  }

  private unauthenticated() {
    return new AppError(HttpStatus.UNAUTHORIZED, 'UNAUTHENTICATED', 'Please log in again.');
  }
}
