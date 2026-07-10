import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@app/db';
import {
  canTransition,
  matchReply,
  normalizeEmail,
  transition,
  type InboundEmail,
} from '@app/core';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

@Injectable()
export class InboundProcessor {
  private readonly logger = new Logger('Inbound');

  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  /**
   * Ingests one parsed inbound email: dedupes by Message-ID, matches it to a due
   * (thread → sender → unmatched) using the pure matcher, stores the reply, and
   * flips a matched, non-terminal due to UNDER_REVIEW (yellow).
   */
  async processEmail(email: InboundEmail): Promise<'created' | 'deduped'> {
    const existing = await this.prisma.incomingReply.findUnique({
      where: { gmailMessageId: email.messageId },
      select: { id: true },
    });
    if (existing) return 'deduped';

    // Preload the data the pure matcher needs (its resolvers are synchronous).
    const threadIds = [email.inReplyTo, ...email.references].filter(
      (v): v is string => !!v,
    );
    const anchors = threadIds.length
      ? await this.prisma.emailLog.findMany({
          where: { providerMessageId: { in: threadIds }, paymentDueId: { not: null } },
          select: { providerMessageId: true, paymentDueId: true, studentId: true },
        })
      : [];
    const threadMap = new Map(
      anchors.map((a) => [a.providerMessageId as string, { dueId: a.paymentDueId as string, studentId: a.studentId }]),
    );

    const senderEmail = normalizeEmail(email.from);
    const senderDues = await this.prisma.paymentDue.findMany({
      where: { status: { not: 'PAID' }, student: { parentEmail: { equals: senderEmail, mode: 'insensitive' } } },
      select: { id: true, studentId: true, status: true, dueDate: true },
    });

    const match = matchReply(email, {
      resolveThread: (id) => threadMap.get(id) ?? null,
      resolveSender: () =>
        senderDues.map((c) => ({ dueId: c.id, studentId: c.studentId, status: c.status, dueDate: c.dueDate })),
    });

    const studentId = match.method !== 'UNMATCHED' ? match.studentId : undefined;
    const paymentDueId = match.method !== 'UNMATCHED' ? match.dueId : undefined;

    try {
      await this.prisma.$transaction(async (tx) => {
        await tx.incomingReply.create({
          data: {
            gmailMessageId: email.messageId,
            inReplyToMessageId: email.inReplyTo,
            referencesIds: email.references,
            fromEmail: email.from,
            subject: email.subject,
            snippet: email.text.replace(/\s+/g, ' ').trim().slice(0, 200),
            bodyText: email.text,
            receivedAt: email.receivedAt,
            matchMethod: match.method,
            classification: 'UNREVIEWED',
            studentId,
            paymentDueId,
          },
        });

        if (paymentDueId) {
          const due = await tx.paymentDue.findUnique({
            where: { id: paymentDueId },
            select: { status: true },
          });
          if (due && canTransition(due.status, 'REPLY_RECEIVED')) {
            const result = transition(due.status, 'REPLY_RECEIVED');
            await tx.paymentDue.updateMany({
              where: { id: paymentDueId, status: due.status },
              data: { status: result.status },
            });
            await this.audit.record(
              {
                actorType: 'SYSTEM',
                action: 'REPLY_RECEIVED',
                entityType: 'PaymentDue',
                entityId: paymentDueId,
                metadata: { from: due.status, to: result.status, method: match.method, fromEmail: email.from },
              },
              tx,
            );
          }
        }
      });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return 'deduped'; // raced another poll on the same Message-ID
      }
      throw err;
    }

    this.logger.log(
      `Inbound reply from ${email.from} matched via ${match.method}` +
        (paymentDueId ? ` -> due ${paymentDueId} set UNDER_REVIEW` : ' (unmatched, queued for triage)'),
    );
    return 'created';
  }
}
