import { Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import type { ChangePasswordDto, CurrentUser, LoginDto } from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { UnauthorizedError, ValidationError } from '../common/app-exception';
import { PasswordService } from './password.service';
import { TokenService, type IssuedSession, type SessionMeta } from './token.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly tokens: TokenService,
    private readonly audit: AuditService,
  ) {}

  toCurrentUser(user: User): CurrentUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  }

  async login(
    dto: LoginDto,
    meta: SessionMeta,
  ): Promise<{ user: CurrentUser; session: IssuedSession }> {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    // Constant-ish failure path — same generic message whether user exists or not.
    if (!user || !user.isActive) {
      throw new UnauthorizedError('Invalid email or password.');
    }
    const ok = await this.password.verify(user.passwordHash, dto.password);
    if (!ok) {
      throw new UnauthorizedError('Invalid email or password.');
    }

    const session = await this.tokens.startSession(user, meta);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });
    await this.audit.record({
      userId: user.id,
      action: 'AUTH_LOGIN',
      entityType: 'User',
      entityId: user.id,
    });
    return { user: this.toCurrentUser(user), session };
  }

  async refresh(
    raw: string | undefined,
    meta: SessionMeta,
  ): Promise<{ user: CurrentUser; session: IssuedSession }> {
    if (!raw) throw new UnauthorizedError('No active session.');
    const { user, session } = await this.tokens.rotate(raw, meta);
    return { user: this.toCurrentUser(user), session };
  }

  async logout(raw: string | undefined, userId?: string): Promise<void> {
    await this.tokens.logout(raw);
    if (userId) {
      await this.audit.record({
        userId,
        action: 'AUTH_LOGOUT',
        entityType: 'User',
        entityId: userId,
      });
    }
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedError();
    const ok = await this.password.verify(user.passwordHash, dto.currentPassword);
    if (!ok) throw new ValidationError('Your current password is incorrect.');

    const passwordHash = await this.password.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, mustChangePassword: false },
    });
    // Invalidate all sessions so a compromised session cannot survive a reset.
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      userId,
      action: 'AUTH_PASSWORD_CHANGED',
      entityType: 'User',
      entityId: userId,
    });
  }
}
