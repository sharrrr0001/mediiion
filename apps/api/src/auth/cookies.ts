import type { CookieOptions, Response } from 'express';
import type { Env } from '../config/env';

export const ACCESS_COOKIE = 'mc_at';
export const REFRESH_COOKIE = 'mc_rt';
export const DEVICE_COOKIE = 'mc_did';

export const ACCESS_TTL_SECONDS = 15 * 60;
export const REFRESH_TTL_DAYS = 30;

function base(env: Env): CookieOptions {
  return { httpOnly: true, sameSite: 'strict', secure: env.NODE_ENV === 'production' };
}

export function setAuthCookies(res: Response, env: Env, access: string, refresh: string) {
  res.cookie(ACCESS_COOKIE, access, { ...base(env), path: '/', maxAge: ACCESS_TTL_SECONDS * 1000 });
  res.cookie(REFRESH_COOKIE, refresh, {
    ...base(env),
    path: env.REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TTL_DAYS * 86400 * 1000,
  });
}

export function setDeviceCookie(res: Response, env: Env, deviceId: string) {
  res.cookie(DEVICE_COOKIE, deviceId, { ...base(env), path: '/', maxAge: 400 * 86400 * 1000 });
}

export function clearAuthCookies(res: Response, env: Env) {
  res.clearCookie(ACCESS_COOKIE, { ...base(env), path: '/' });
  res.clearCookie(REFRESH_COOKIE, { ...base(env), path: env.REFRESH_COOKIE_PATH });
}
