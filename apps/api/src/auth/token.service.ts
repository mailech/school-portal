import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@app/db';
import type { UserRole } from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { PasswordService } from './password.service';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { UnauthorizedError } from '../common/app-exception';
import { parseDurationMs } from '../common/duration';
import type { JwtRefreshPayload } from './types';

export interface SessionMeta {
  userAgent?: string;
  ip?: string;
}

export interface IssuedSession {
  accessToken: string;
  refreshToken: string;
}

type AccessUser = Pick<User, 'id' | 'email' | 'role'>;

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  createAccessToken(user: AccessUser): string {
    return this.jwt.sign(
      { sub: user.id, email: user.email, role: user.role as UserRole, type: 'access' as const },
      { secret: this.config.jwt.accessSecret, expiresIn: this.config.jwt.accessTtl as unknown as number },
    );
  }

  /** Creates a fresh session (login): new family + access + refresh. */
  async startSession(user: AccessUser, meta: SessionMeta): Promise<IssuedSession> {
    const family = randomUUID();
    const accessToken = this.createAccessToken(user);
    const { raw: refreshToken } = await this.issueRefreshToken(user.id, family, meta);
    return { accessToken, refreshToken };
  }

  private async issueRefreshToken(
    userId: string,
    family: string,
    meta: SessionMeta,
  ): Promise<{ raw: string; id: string }> {
    const expiresAt = new Date(Date.now() + parseDurationMs(this.config.jwt.refreshTtl));
    const record = await this.prisma.refreshToken.create({
      data: {
        userId,
        family,
        tokenHash: 'pending',
        expiresAt,
        userAgent: meta.userAgent?.slice(0, 255),
        ip: meta.ip?.slice(0, 64),
      },
    });
    const raw = this.jwt.sign(
      { sub: userId, jti: record.id, family, type: 'refresh' as const },
      { secret: this.config.jwt.refreshSecret, expiresIn: this.config.jwt.refreshTtl as unknown as number },
    );
    const tokenHash = await this.password.hash(raw);
    await this.prisma.refreshToken.update({ where: { id: record.id }, data: { tokenHash } });
    return { raw, id: record.id };
  }

  private verifyRefreshPayload(raw: string): JwtRefreshPayload {
    try {
      const payload = this.jwt.verify<JwtRefreshPayload>(raw, {
        secret: this.config.jwt.refreshSecret,
      });
      if (payload.type !== 'refresh') throw new Error('wrong token type');
      return payload;
    } catch {
      throw new UnauthorizedError('Your session is invalid or has expired.');
    }
  }

  /**
   * Rotates a refresh token. Detects reuse of an already-rotated token and, in
   * that case, revokes the entire token family (theft response).
   */
  async rotate(
    raw: string,
    meta: SessionMeta,
  ): Promise<{ user: User; session: IssuedSession }> {
    const payload = this.verifyRefreshPayload(raw);
    const record = await this.prisma.refreshToken.findUnique({
      where: { id: payload.jti },
      include: { user: true },
    });
    if (!record) throw new UnauthorizedError('Your session has expired. Please sign in again.');

    if (record.revokedAt) {
      // A revoked (already-rotated) token is being reused -> revoke the family.
      await this.revokeFamily(record.family);
      throw new UnauthorizedError('Your session was revoked. Please sign in again.');
    }
    if (record.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedError('Your session has expired. Please sign in again.');
    }
    const matches = await this.password.verify(record.tokenHash, raw);
    if (!matches) {
      await this.revokeFamily(record.family);
      throw new UnauthorizedError('Your session is invalid. Please sign in again.');
    }
    if (!record.user.isActive) {
      throw new UnauthorizedError('This account has been disabled.');
    }

    const { raw: newRaw, id: newId } = await this.issueRefreshToken(
      record.userId,
      record.family,
      meta,
    );
    // Mark the old token rotated and link the chain.
    await this.prisma.refreshToken.update({
      where: { id: record.id },
      data: { revokedAt: new Date(), replacedById: newId },
    });

    const accessToken = this.createAccessToken(record.user);
    return { user: record.user, session: { accessToken, refreshToken: newRaw } };
  }

  async revokeFamily(family: string): Promise<void> {
    await this.prisma.refreshToken.updateMany({
      where: { family, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async logout(raw: string | undefined): Promise<void> {
    if (!raw) return;
    try {
      const payload = this.verifyRefreshPayload(raw);
      await this.revokeFamily(payload.family);
    } catch {
      // already invalid — nothing to revoke
    }
  }
}
