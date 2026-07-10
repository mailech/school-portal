import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { QUEUE_NAMES, type SerializedInboundEmail } from '@app/core';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { AuditService } from '../audit/audit.service';
import { QueueService } from '../queue/queue.service';
import { OutboundService } from '../email/outbound.service';
import { SweepService } from '../sweep/sweep.service';
import { InboundProcessor } from '../inbound/inbound-processor.service';
import { InboundPollService } from '../inbound/inbound-poll.service';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';
import { dlqName } from '../queue/pgboss.setup';

interface OutboundJobData {
  emailLogId: string;
}

@Injectable()
export class WorkerRunner implements OnApplicationBootstrap {
  private readonly logger = new Logger('Runner');

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    private readonly audit: AuditService,
    private readonly queue: QueueService,
    private readonly outbound: OutboundService,
    private readonly sweep: SweepService,
    private readonly inboundProcessor: InboundProcessor,
    private readonly inboundPoll: InboundPollService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.settings.ensureTemplates();
    const boss = this.queue.getBoss();
    const effective = await this.settings.getEffective();

    // --- Consumers ----------------------------------------------------------
    await boss.work<OutboundJobData>(
      QUEUE_NAMES.OUTBOUND_EMAIL,
      { batchSize: 1 },
      async (jobs) => {
        for (const job of jobs) await this.outbound.send(job.data.emailLogId);
      },
    );

    await boss.work(QUEUE_NAMES.DAILY_SWEEP, { batchSize: 1 }, async () => {
      await this.sweep.run();
    });

    // Process a single inbound email (dev simulate-reply enqueues these).
    await boss.work<SerializedInboundEmail>(
      QUEUE_NAMES.PROCESS_INBOUND,
      { batchSize: 1 },
      async (jobs) => {
        for (const job of jobs) {
          await this.inboundProcessor.processEmail({
            messageId: job.data.messageId,
            inReplyTo: job.data.inReplyTo,
            references: job.data.references ?? [],
            from: job.data.from,
            subject: job.data.subject,
            text: job.data.text,
            receivedAt: new Date(job.data.receivedAtISO),
          });
        }
      },
    );

    // Real inbound polling (IMAP / Gmail), only if configured.
    await boss.work(QUEUE_NAMES.INBOUND_POLL, { batchSize: 1 }, async () => {
      await this.inboundPoll.poll();
    });

    // --- Dead-letter drains (permanent failures -> visible + audited) --------
    await boss.work<OutboundJobData>(dlqName(QUEUE_NAMES.OUTBOUND_EMAIL), async (jobs) => {
      for (const job of jobs) await this.onEmailDeadLettered(job.data.emailLogId);
    });
    await boss.work(dlqName(QUEUE_NAMES.DAILY_SWEEP), async (jobs) => {
      for (const job of jobs) {
        this.logger.error(`Daily sweep permanently failed: ${JSON.stringify(job.data)}`);
        await this.audit.record({
          actorType: 'SYSTEM',
          action: 'SWEEP_FAILED',
          entityType: 'System',
          entityId: 'daily-sweep',
          metadata: { job: job.id },
        });
      }
    });

    // --- Schedule the daily sweep (school timezone) -------------------------
    await this.queue.schedule('daily-sweep', effective.dailySweepCron, {} as never, effective.timezone);

    // --- Schedule inbound polling only when a real mailbox is configured ----
    const imapReady = this.config.email.provider === 'smtp_imap' && this.config.email.imap.enabled;
    const gmailReady =
      this.config.email.provider === 'gmail_api' && !!this.config.email.gmail.refreshToken;
    if (imapReady || gmailReady) {
      await this.queue.schedule(
        'inbound-poll',
        this.config.email.imap.pollCron,
        {} as never,
        effective.timezone,
      );
      this.logger.log(`Inbound polling scheduled (${this.config.email.provider}).`);
    } else {
      this.logger.log('Inbound polling disabled; using dev simulate-reply / manual triage.');
    }

    this.logger.log(
      `Consumers registered. Daily sweep scheduled at "${effective.dailySweepCron}" (${effective.timezone}).`,
    );
  }

  private async onEmailDeadLettered(emailLogId: string): Promise<void> {
    const log = await this.prisma.emailLog.findUnique({ where: { id: emailLogId } });
    if (!log || log.status === 'SENT') return;
    await this.prisma.emailLog.update({
      where: { id: emailLogId },
      data: { status: 'FAILED' },
    });
    await this.audit.record({
      actorType: 'SYSTEM',
      action: 'EMAIL_FAILED',
      entityType: 'EmailLog',
      entityId: emailLogId,
      metadata: { error: log.error, attempts: log.attempts },
    });
    this.logger.error(`Email ${emailLogId} moved to dead-letter and marked FAILED.`);
  }

  /**
   * Safety net: if an enqueue failed after a transaction committed, an EmailLog
   * can be left QUEUED with no job. Every 2 minutes, re-enqueue any QUEUED email
   * older than 60s. The outbound job is idempotent (SENT -> no-op), so this is
   * safe. A singletonKey prevents piling up duplicate active jobs.
   */
  @Interval(120_000)
  async reconcileQueuedEmails(): Promise<void> {
    const cutoff = new Date(Date.now() - 60_000);
    const stuck = await this.prisma.emailLog.findMany({
      where: { status: 'QUEUED', queuedAt: { lt: cutoff } },
      select: { id: true },
      take: 100,
    });
    if (stuck.length === 0) return;
    this.logger.warn(`Reconciler: re-enqueueing ${stuck.length} stuck email(s).`);
    for (const s of stuck) {
      await this.queue.enqueue(
        'outbound-email',
        { emailLogId: s.id },
        { singletonKey: `email:${s.id}`, singletonSeconds: 120 },
      );
    }
  }
}
