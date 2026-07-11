import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  listEmails(limit = 200) {
    return this.prisma.emailLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  listAudit(limit = 200) {
    return this.prisma.auditLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
