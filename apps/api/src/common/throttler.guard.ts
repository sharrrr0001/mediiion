import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Rate-limit per device (httpOnly device cookie) rather than per IP: many patients share one clinic
 * Wi-Fi or mobile-carrier NAT, and AI spend must be capped per user (security checklist).
 * Requests without the cookie (first login) fall back to IP.
 */
@Injectable()
export class DeviceThrottlerGuard extends ThrottlerGuard {
  protected override async getTracker(req: Record<string, unknown>): Promise<string> {
    const cookies = req.cookies as Record<string, unknown> | undefined;
    const device = cookies?.mc_did;
    if (typeof device === 'string' && /^[0-9a-f-]{36}$/.test(device)) return `d:${device}`;
    return `ip:${String(req.ip ?? 'unknown')}`;
  }
}
