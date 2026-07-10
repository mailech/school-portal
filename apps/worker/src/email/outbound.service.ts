import { Inject, Injectable, Logger } from '@nestjs/common';
import { DateTime } from 'luxon';
import {
  EMAIL_PROVIDER_PORT,
  renderTemplate,
  type EmailProviderPort,
  type TemplateVars,
} from '@app/core';
import { EmailType, formatInr } from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

@Injectable()
export class OutboundService {
  private readonly logger = new Logger('Outbound');

  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @Inject(EMAIL_PROVIDER_PORT) private readonly provider: EmailProviderPort,
  ) {}

  /** Sends the email identified by an EmailLog id. Idempotent: an already-SENT
   *  log is a no-op (safe if a job is retried after a mid-send crash). Throws on
   *  send failure so pg-boss retries with backoff. */
  async send(emailLogId: string): Promise<void> {
    const log = await this.prisma.emailLog.findUnique({
      where: { id: emailLogId },
      include: { student: true },
    });
    if (!log) {
      this.logger.warn(`EmailLog ${emailLogId} not found; skipping.`);
      return;
    }
    if (log.status === 'SENT') return;

    // Resolve the due for context (paymentDueId, or meta.dueId for blasts).
    const dueId =
      log.paymentDueId ??
      (log.meta && typeof log.meta === 'object' && 'dueId' in log.meta
        ? String((log.meta as { dueId?: string }).dueId)
        : null);

    const due = dueId
      ? await this.prisma.paymentDue.findUnique({
          where: { id: dueId },
          include: {
            installment: { select: { installmentNumber: true } },
            student: { include: { schoolClass: { select: { name: true, section: true } } } },
          },
        })
      : null;

    const settings = await this.settings.getEffective();
    const templateType =
      log.type === EmailType.MANUAL_BLAST ? EmailType.OVERDUE_NOTICE : (log.type as EmailType);
    const template = await this.prisma.emailTemplate.findUnique({ where: { type: templateType } });
    if (!template) {
      throw new Error(`No email template configured for ${templateType}`);
    }

    const className = due
      ? `${due.student.schoolClass.name}${due.student.schoolClass.section ? ' ' + due.student.schoolClass.section : ''}`
      : '';
    const vars: TemplateVars = {
      studentName: log.student.name,
      parentName: log.student.parentName,
      className,
      installmentNumber: due ? due.installment.installmentNumber : '',
      amount: due ? formatInr(Number(due.amount)) : '',
      dueDate: due
        ? DateTime.fromJSDate(due.dueDate).setZone(settings.timezone).toFormat('dd LLL yyyy')
        : '',
    };

    // Manual "Email overdue" blasts get a distinct subject so Gmail doesn't
    // collapse them as an identical duplicate of the automated overdue notice.
    const subject =
      log.type === EmailType.MANUAL_BLAST
        ? renderTemplate('Reminder: overdue Installment {installmentNumber} for {studentName}', vars)
        : renderTemplate(template.subject, vars);
    const html = renderTemplate(template.bodyHtml, vars);
    const text = renderTemplate(template.bodyText, vars);

    // Thread automated notices onto the first email sent for this due so the
    // parent's reply threads back. Manual blasts are sent standalone (see above)
    // so their body is never hidden as a threaded duplicate.
    const headers: Record<string, string> = {};
    if (dueId && log.type !== EmailType.MANUAL_BLAST) {
      const anchor = await this.prisma.emailLog.findFirst({
        where: { paymentDueId: dueId, status: 'SENT', providerMessageId: { not: null } },
        orderBy: { sentAt: 'asc' },
        select: { providerMessageId: true },
      });
      if (anchor?.providerMessageId && anchor.providerMessageId !== log.providerMessageId) {
        headers['In-Reply-To'] = anchor.providerMessageId;
        headers['References'] = anchor.providerMessageId;
      }
    }

    try {
      const result = await this.provider.send({
        to: log.toEmail,
        subject,
        html,
        text,
        headers: Object.keys(headers).length ? headers : undefined,
        correlationId: log.id,
      });
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: {
          status: 'SENT',
          providerMessageId: result.providerMessageId,
          subject,
          sentAt: new Date(),
          attempts: { increment: 1 },
          error: null,
        },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await this.prisma.emailLog.update({
        where: { id: log.id },
        data: { attempts: { increment: 1 }, error: message.slice(0, 500) },
      });
      throw err; // let pg-boss retry with backoff
    }
  }
}
