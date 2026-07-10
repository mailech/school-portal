import { Inject, Injectable } from '@nestjs/common';
import { Prisma } from '@app/db';
import {
  QUEUE_PORT,
  transition,
  type DueEvent,
  type QueuePort,
} from '@app/core';
import {
  PaymentDueStatus,
  type DueActionResult,
  type ManualBlastDto,
  type ManualBlastPreview,
  type MarkPaidDto,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ConflictError, NotFoundError } from '../common/app-exception';

export interface ApplyTransitionOptions {
  dueId: string;
  event: DueEvent;
  actorId: string | null;
  actorType?: 'USER' | 'SYSTEM';
  paid?: { amount?: number; at?: Date };
  auditAction: string;
  metadata?: Prisma.InputJsonValue;
  /** Extra work to run inside the same transaction (e.g. update a reply). */
  within?: (tx: Prisma.TransactionClient, due: { id: string; studentId: string }) => Promise<void>;
}

@Injectable()
export class DuesActionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    @Inject(QUEUE_PORT) private readonly queue: QueuePort,
  ) {}

  /**
   * The single choke point for accountant/system-driven due changes. Loads the
   * due, runs the pure state machine, applies the change with an optimistic
   * status precondition (compare-and-set) so two accountants can't both win,
   * records an EmailLog + audit atomically, then enqueues the email post-commit.
   */
  async applyTransition(opts: ApplyTransitionOptions): Promise<DueActionResult> {
    const due = await this.prisma.paymentDue.findUnique({
      where: { id: opts.dueId },
      include: { student: { select: { parentEmail: true } } },
    });
    if (!due) throw new NotFoundError('Payment due not found.');

    const result = transition(due.status, opts.event); // throws typed error if illegal
    const goesPaid = result.status === PaymentDueStatus.PAID;

    let emailLogId: string | undefined;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentDue.updateMany({
        where: { id: due.id, status: due.status }, // compare-and-set
        data: {
          status: result.status,
          ...(goesPaid
            ? {
                paidAmount: opts.paid?.amount ?? Number(due.amount),
                paidAt: opts.paid?.at ?? new Date(),
                markedPaidByUserId: opts.actorId,
              }
            : {}),
        },
      });
      if (updated.count === 0) {
        throw new ConflictError(
          'This due was just updated by someone else. Refresh and try again.',
        );
      }

      if (result.email) {
        // Idempotent on (paymentDueId, type): if a prior log exists, re-queue it.
        const log = await tx.emailLog.upsert({
          where: { paymentDueId_type: { paymentDueId: due.id, type: result.email } },
          create: {
            studentId: due.studentId,
            paymentDueId: due.id,
            type: result.email,
            toEmail: due.student.parentEmail,
            subject: '',
            status: 'QUEUED',
          },
          update: { status: 'QUEUED', error: null, subject: '', sentAt: null },
        });
        emailLogId = log.id;
      }

      if (opts.within) await opts.within(tx, { id: due.id, studentId: due.studentId });

      await this.audit.record(
        {
          userId: opts.actorId,
          actorType: opts.actorType ?? 'USER',
          action: opts.auditAction,
          entityType: 'PaymentDue',
          entityId: due.id,
          metadata: { from: due.status, to: result.status, ...(opts.metadata as object) },
        },
        tx,
      );
    });

    if (emailLogId) {
      // Enqueue only after commit so the worker never reads an uncommitted row.
      await this.queue.enqueue('outbound-email', { emailLogId });
    }

    return { dueId: due.id, status: result.status };
  }

  markPaid(dueId: string, dto: MarkPaidDto, actorId: string): Promise<DueActionResult> {
    return this.applyTransition({
      dueId,
      event: 'MANUAL_MARK_PAID',
      actorId,
      paid: { amount: dto.paidAmount, at: dto.paidAt },
      auditAction: 'DUE_MARK_PAID',
      metadata: { note: dto.note ?? null, manual: true },
    });
  }

  /**
   * "Email all overdue students", optionally scoped to a class/year/installment.
   * Without `confirm`, returns a preview count. With `confirm`, queues a
   * MANUAL_BLAST email per overdue due (paymentDueId is null so repeat blasts are
   * allowed; the target due is recorded in `meta`).
   */
  async emailOverdue(dto: ManualBlastDto, actorId: string): Promise<ManualBlastPreview> {
    const studentWhere: Prisma.StudentWhereInput = {};
    if (dto.schoolClassId) studentWhere.schoolClassId = dto.schoolClassId;
    if (dto.academicYearId) studentWhere.academicYearId = dto.academicYearId;

    const where: Prisma.PaymentDueWhereInput = {
      status: PaymentDueStatus.OVERDUE,
      ...(Object.keys(studentWhere).length ? { student: studentWhere } : {}),
      ...(dto.installmentNumber
        ? { installment: { installmentNumber: dto.installmentNumber } }
        : {}),
    };

    const dues = await this.prisma.paymentDue.findMany({
      where,
      include: { student: { select: { id: true, parentEmail: true } } },
    });
    const targetStudentCount = new Set(dues.map((d) => d.studentId)).size;

    if (!dto.confirm) {
      return { targetDueCount: dues.length, targetStudentCount, committed: false, queued: 0 };
    }

    const emailLogIds: string[] = [];
    for (const due of dues) {
      const log = await this.prisma.emailLog.create({
        data: {
          studentId: due.studentId,
          paymentDueId: null,
          type: 'MANUAL_BLAST',
          toEmail: due.student.parentEmail,
          subject: '',
          status: 'QUEUED',
          meta: { dueId: due.id },
        },
      });
      emailLogIds.push(log.id);
    }
    for (const id of emailLogIds) {
      await this.queue.enqueue('outbound-email', { emailLogId: id });
    }

    await this.audit.record({
      userId: actorId,
      action: 'MANUAL_BLAST',
      entityType: 'PaymentDue',
      entityId: dto.schoolClassId ?? 'all',
      metadata: { queued: emailLogIds.length, scope: { ...dto } },
    });

    return {
      targetDueCount: dues.length,
      targetStudentCount,
      committed: true,
      queued: emailLogIds.length,
    };
  }
}
