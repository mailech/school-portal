import type { UserRole } from '@app/types';

export interface JwtAccessPayload {
  sub: string;
  email: string;
  role: UserRole;
  type: 'access';
}

export interface JwtRefreshPayload {
  sub: string;
  jti: string; // RefreshToken.id
  family: string;
  type: 'refresh';
}

/** The authenticated principal attached to every request by the JWT strategy. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  mustChangePassword: boolean;
}

export const ACCESS_COOKIE = 'access_token';
export const REFRESH_COOKIE = 'refresh_token';
