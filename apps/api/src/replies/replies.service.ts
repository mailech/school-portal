import { Injectable } from '@nestjs/common';
import { Prisma } from '@app/db';
import type {
  ConfirmPaymentDto,
  DueActionResult,
  RejectReplyDto,
  ReplyListQuery,
  ReplyView,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { NotFoundError, ValidationError } from '../common/app-exception';
import { toReplyView } from '../common/mappers';
import { DuesActionsService } from '../dues/dues-actions.service';

const replyInclude = {
  reviewedBy: { select: { name: true } },
  student: { select: { id: true, name: true, regId: true, schoolClass: { select: { name: true } } } },
  paymentDue: { include: { installment: { select: { installmentNumber: true } } } },
} satisfies Prisma.IncomingReplyInclude;

@Injectable()
export class RepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly actions: DuesActionsService,
  ) {}

  async list(query: ReplyListQuery): Promise<ReplyView[]> {
    const where: Prisma.IncomingReplyWhereInput = {};
    if (query.classification) where.classification = query.classification;
    if (query.onlyPendingReview) {
      where.classification = 'UNREVIEWED';
      where.paymentDue = { status: 'UNDER_REVIEW' };
    }
    const replies = await this.prisma.incomingReply.findMany({
      where,
      include: replyInclude,
      orderBy: [{ classification: 'asc' }, { receivedAt: 'desc' }],
      take: 500,
    });
    return replies.map((r) => toReplyView(r));
  }

  private async loadLinkedDueId(replyId: string): Promise<string> {
    const reply = await this.prisma.incomingReply.findUnique({
      where: { id: replyId },
      select: { paymentDueId: true },
    });
    if (!reply) throw new NotFoundError('Reply not found.');
    if (!reply.paymentDueId) {
      throw new ValidationError('This reply is not linked to a payment due, so it cannot be actioned.');
    }
    return reply.paymentDueId;
  }

  async confirm(
    replyId: string,
    dto: ConfirmPaymentDto,
    actorId: string,
  ): Promise<DueActionResult> {
    const dueId = await this.loadLinkedDueId(replyId);
    return this.actions.applyTransition({
      dueId,
      event: 'CONFIRM_PAYMENT',
      actorId,
      paid: { amount: dto.paidAmount },
      auditAction: 'DUE_PAYMENT_CONFIRMED',
      metadata: { replyId, note: dto.note ?? null },
      within: async (tx) => {
        await tx.incomingReply.update({
          where: { id: replyId },
          data: { classification: 'IS_PAYMENT', reviewedByUserId: actorId, reviewedAt: new Date() },
        });
      },
    });
  }

  async reject(replyId: string, dto: RejectReplyDto, actorId: string): Promise<DueActionResult> {
    const dueId = await this.loadLinkedDueId(replyId);
    return this.actions.applyTransition({
      dueId,
      event: 'REJECT_PAYMENT',
      actorId,
      auditAction: 'DUE_PAYMENT_REJECTED',
      metadata: { replyId, note: dto.note ?? null },
      within: async (tx) => {
        await tx.incomingReply.update({
          where: { id: replyId },
          data: { classification: 'NOT_PAYMENT', reviewedByUserId: actorId, reviewedAt: new Date() },
        });
      },
    });
  }
}
