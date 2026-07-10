import type { CookieOptions, Response } from 'express';
import type { AppConfig } from '../config/app-config';
import { parseDurationMs } from '../common/duration';
import { ACCESS_COOKIE, REFRESH_COOKIE } from './types';

function baseOptions(config: AppConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookie.secure,
    sameSite: config.cookie.sameSite,
    domain: config.cookie.domain,
    path: '/',
  };
}

export function setAuthCookies(
  res: Response,
  config: AppConfig,
  tokens: { accessToken: string; refreshToken: string },
): void {
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    ...baseOptions(config),
    // Cookie outlives the JWT: the token's own 15-min expiry enforces security
    // and drives silent refresh; the cookie persisting lets route guards work.
    maxAge: parseDurationMs(config.jwt.refreshTtl),
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    ...baseOptions(config),
    // Refresh cookie is only sent to the refresh/logout endpoints.
    path: `/${config.api.globalPrefix}/auth`,
    maxAge: parseDurationMs(config.jwt.refreshTtl),
  });
}

export function clearAuthCookies(res: Response, config: AppConfig): void {
  res.clearCookie(ACCESS_COOKIE, { ...baseOptions(config) });
  res.clearCookie(REFRESH_COOKIE, {
    ...baseOptions(config),
    path: `/${config.api.globalPrefix}/auth`,
  });
}
