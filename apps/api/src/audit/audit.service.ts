import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/db';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditEntry {
  userId?: string | null;
  actorType?: 'USER' | 'SYSTEM';
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Prisma.InputJsonValue;
}

/** Thin wrapper so every mutation records who/what/when. Accepts an optional
 *  transaction client so the audit row commits atomically with the change. */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry, tx?: Prisma.TransactionClient): Promise<void> {
    const client = tx ?? this.prisma;
    await client.auditLog.create({
      data: {
        userId: entry.userId ?? null,
        actorType: entry.actorType ?? 'USER',
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata,
      },
    });
  }
}
