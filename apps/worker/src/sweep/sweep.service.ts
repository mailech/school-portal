import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@app/db';
import {
  SystemClock,
  planSweep,
  transition,
  type SweepAction,
  type SweepCandidate,
} from '@app/core';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';

export interface SweepSummary {
  candidates: number;
  actions: number;
  reminders: number;
  overdue: number;
  escalations: number;
  skipped: number;
}

@Injectable()
export class SweepService {
  private readonly logger = new Logger('Sweep');
  private readonly clock = new SystemClock();

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
  ) {}

  async run(): Promise<SweepSummary> {
    const settings = await this.settings.getEffective();
    const today = this.clock.startOfTodayInZone(settings.timezone);

    const dues = await this.prisma.paymentDue.findMany({
      where: { status: { in: ['UPCOMING', 'REMINDED', 'OVERDUE'] } },
      select: { id: true, status: true, dueDate: true },
    });

    const summary: SweepSummary = {
      candidates: dues.length,
      actions: 0,
      reminders: 0,
      overdue: 0,
      escalations: 0,
      skipped: 0,
    };
    if (dues.length === 0) {
      this.logger.log('Sweep: no candidate dues');
      return summary;
    }

    const dueIds = dues.map((d) => d.id);
    const logs = await this.prisma.emailLog.findMany({
      where: {
        paymentDueId: { in: dueIds },
        type: { in: ['PRE_DUE_REMINDER', 'OVERDUE_NOTICE', 'ESCALATION'] },
      },
      select: { paymentDueId: true, type: true },
    });
    const logSet = new Set(logs.map((l) => `${l.paymentDueId}:${l.type}`));

    const candidates: SweepCandidate[] = dues.map((d) => ({
      dueId: d.id,
      status: d.status,
      dueDate: d.dueDate,
      hasReminderLog: logSet.has(`${d.id}:PRE_DUE_REMINDER`),
      hasOverdueLog: logSet.has(`${d.id}:OVERDUE_NOTICE`),
      hasEscalationLog: logSet.has(`${d.id}:ESCALATION`),
    }));

    const actions = planSweep(candidates, settings, today);
    const emailLogIds: string[] = [];

    for (const action of actions) {
      try {
        const emailLogId = await this.execute(action);
        if (emailLogId) emailLogIds.push(emailLogId);
        if (action.event === 'SEND_REMINDER') summary.reminders++;
        else if (action.event === 'MARK_OVERDUE') summary.overdue++;
        else summary.escalations++;
        summary.actions++;
      } catch (err) {
        summary.skipped++;
        this.logger.warn(
          `Sweep action ${action.event} on due ${action.dueId} skipped: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }

    // Enqueue after all state changes have committed.
    for (const id of emailLogIds) {
      await this.queue.enqueue('outbound-email', { emailLogId: id });
    }

    this.logger.log(
      `Sweep: ${summary.actions}/${summary.candidates} actions ` +
        `(${summary.reminders} reminders, ${summary.overdue} overdue, ${summary.escalations} escalations, ${summary.skipped} skipped)`,
    );
    return summary;
  }

  /** Applies one sweep action atomically. Returns the EmailLog id to enqueue,
   *  or null if the email already existed / no email is needed. */
  private async execute(action: SweepAction): Promise<string | null> {
    const due = await this.prisma.paymentDue.findUnique({
      where: { id: action.dueId },
      include: { student: { select: { parentEmail: true } } },
    });
    if (!due) return null;
    // Stale plan: the due changed since planning (e.g. accountant acted). Skip.
    if (due.status !== action.expectedStatus) return null;

    const result = transition(due.status, action.event);
    let emailLogId: string | null = null;

    await this.prisma.$transaction(async (tx) => {
      const updated = await tx.paymentDue.updateMany({
        where: { id: due.id, status: due.status },
        data: { status: result.status },
      });
      if (updated.count === 0) return; // lost a race; skip

      if (result.email) {
        try {
          const log = await tx.emailLog.create({
            data: {
              studentId: due.studentId,
              paymentDueId: due.id,
              type: result.email,
              toEmail: due.student.parentEmail,
              subject: '',
              status: 'QUEUED',
            },
          });
          emailLogId = log.id;
        } catch (err) {
          // Unique (paymentDueId, type) -> already sent this notice; skip email.
          if (
            err instanceof Prisma.PrismaClientKnownRequestError &&
            err.code === 'P2002'
          ) {
            emailLogId = null;
          } else {
            throw err;
          }
        }
      }

      await this.audit.record(
        {
          actorType: 'SYSTEM',
          action: `SWEEP_${action.event}`,
          entityType: 'PaymentDue',
          entityId: due.id,
          metadata: { from: due.status, to: result.status, reason: action.reason },
        },
        tx,
      );
    });

    return emailLogId;
  }
}
