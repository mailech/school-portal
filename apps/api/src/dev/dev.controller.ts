import { randomUUID } from 'node:crypto';
import { Body, Controller, HttpCode, Inject, Post } from '@nestjs/common';
import {
  QUEUE_PORT,
  type QueuePort,
  type SerializedInboundEmail,
} from '@app/core';
import { UserRole, simulateReplySchema, type SimulateReplyDto } from '@app/types';
import { APP_CONFIG, type AppConfig } from '../config/app-config';
import { Roles } from '../common/decorators';
import { zBody } from '../common/zod-validation.pipe';
import { NotFoundError } from '../common/app-exception';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Development-only helpers, gated by DEV_ENDPOINTS_ENABLED. Lets the demo run the
 * sweep and simulate an inbound parent reply with only Postgres (no mail server).
 * Every handler 404s when dev endpoints are disabled (production).
 */
@Roles(UserRole.ADMIN)
@Controller('dev')
export class DevController {
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
    private readonly prisma: PrismaService,
  ) {}

  private assertEnabled(): void {
    if (!this.config.devEndpointsEnabled) throw new NotFoundError('Not found.');
  }

  @Post('run-sweep')
  @HttpCode(200)
  async runSweep(): Promise<{ queued: boolean }> {
    this.assertEnabled();
    await this.queue.enqueue(
      'daily-sweep',
      { runDateISO: new Date().toISOString() },
      { singletonKey: `manual-sweep:${Date.now()}` },
    );
    return { queued: true };
  }

  @Post('simulate-reply')
  @HttpCode(200)
  async simulateReply(
    @Body(zBody(simulateReplySchema)) dto: SimulateReplyDto,
  ): Promise<{ queued: boolean; dueId: string; via: string }> {
    this.assertEnabled();

    const due = dto.dueId
      ? await this.prisma.paymentDue.findUnique({
          where: { id: dto.dueId },
          include: { student: true },
        })
      : await this.prisma.paymentDue.findFirst({
          where: {
            status: { in: ['OVERDUE', 'REMINDED'] },
            ...(dto.studentId ? { studentId: dto.studentId } : {}),
          },
          include: { student: true },
          orderBy: { dueDate: 'asc' },
        });
    if (!due) throw new NotFoundError('No suitable due found to reply to.');

    // Prefer threading onto a real sent email so it matches via THREAD.
    const anchor = await this.prisma.emailLog.findFirst({
      where: { paymentDueId: due.id, providerMessageId: { not: null } },
      orderBy: { sentAt: 'asc' },
      select: { providerMessageId: true },
    });

    const email: SerializedInboundEmail = {
      messageId: `<sim-${randomUUID()}@parent.test>`,
      inReplyTo: anchor?.providerMessageId ?? undefined,
      references: anchor?.providerMessageId ? [anchor.providerMessageId] : [],
      from: dto.fromEmail ?? due.student.parentEmail,
      subject: dto.subject ?? `Re: Fees for ${due.student.name}`,
      text: dto.body,
      receivedAtISO: new Date().toISOString(),
    };
    await this.queue.enqueue('process-inbound', email);

    return { queued: true, dueId: due.id, via: anchor ? 'thread' : 'sender' };
  }
}
