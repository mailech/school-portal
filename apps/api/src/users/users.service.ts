import { Injectable } from '@nestjs/common';
import type { User } from '@app/db';
import type {
  CreateStaffDto,
  ResetStaffPasswordDto,
  UpdateStaffDto,
  UserView,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { PasswordService } from '../auth/password.service';
import { ConflictError, NotFoundError, ValidationError } from '../common/app-exception';

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly password: PasswordService,
    private readonly audit: AuditService,
  ) {}

  private toView(user: User): UserView {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      mustChangePassword: user.mustChangePassword,
      lastLoginAt: user.lastLoginAt ? user.lastLoginAt.toISOString() : null,
      createdAt: user.createdAt.toISOString(),
    };
  }

  async list(): Promise<UserView[]> {
    const users = await this.prisma.user.findMany({
      where: { role: { in: ['ADMIN', 'ACCOUNTANT'] } },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return users.map((u) => this.toView(u));
  }

  async create(dto: CreateStaffDto, actorId: string): Promise<UserView> {
    const existing = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existing) throw new ConflictError('A user with this email already exists.');

    const passwordHash = await this.password.hash(dto.password);
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        role: dto.role,
        passwordHash,
        mustChangePassword: true,
      },
    });
    await this.audit.record({
      userId: actorId,
      action: 'USER_CREATED',
      entityType: 'User',
      entityId: user.id,
      metadata: { email: user.email, role: user.role },
    });
    return this.toView(user);
  }

  async update(id: string, dto: UpdateStaffDto, actorId: string): Promise<UserView> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found.');

    // Guard: do not allow removing the last active admin.
    if ((dto.role && dto.role !== 'ADMIN') || dto.isActive === false) {
      if (user.role === 'ADMIN') {
        const activeAdmins = await this.prisma.user.count({
          where: { role: 'ADMIN', isActive: true },
        });
        if (activeAdmins <= 1) {
          throw new ValidationError('At least one active administrator must remain.');
        }
      }
    }

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        name: dto.name,
        role: dto.role,
        isActive: dto.isActive,
      },
    });
    // Disabling an account revokes its sessions immediately.
    if (dto.isActive === false) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await this.audit.record({
      userId: actorId,
      action: 'USER_UPDATED',
      entityType: 'User',
      entityId: id,
      metadata: { ...dto },
    });
    return this.toView(updated);
  }

  async resetPassword(id: string, dto: ResetStaffPasswordDto, actorId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundError('User not found.');

    const passwordHash = await this.password.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, mustChangePassword: true },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.record({
      userId: actorId,
      action: 'USER_PASSWORD_RESET',
      entityType: 'User',
      entityId: id,
    });
  }
}
