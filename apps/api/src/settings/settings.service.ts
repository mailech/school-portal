import { Injectable, type OnApplicationBootstrap } from '@nestjs/common';
import { Prisma } from '@app/db';
import { DEFAULT_TEMPLATES } from '@app/core';
import {
  EmailType,
  type EmailTemplateView,
  type SettingsView,
  type UpdateSettingsDto,
  type UpdateTemplateDto,
} from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const AUTOMATED_TEMPLATE_TYPES = [
  EmailType.PRE_DUE_REMINDER,
  EmailType.OVERDUE_NOTICE,
  EmailType.ESCALATION,
  EmailType.PAYMENT_RECEIVED,
] as const;

@Injectable()
export class SettingsService implements OnApplicationBootstrap {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    // Ensure the settings row + default templates exist so admin screens work.
    await this.get();
    await this.ensureTemplates();
  }

  /** Runs an upsert that may race with the sibling process (API + worker boot
   *  together). On a concurrent-create collision (P2002) the row now exists, so
   *  retrying once takes the update path and succeeds. */
  private async upsertRace<T>(op: () => Promise<T>): Promise<T> {
    try {
      return await op();
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return await op();
      }
      throw err;
    }
  }

  async get(): Promise<SettingsView> {
    const row = await this.upsertRace(() =>
      this.prisma.appSetting.upsert({
        where: { id: 'singleton' },
        update: {},
        create: { id: 'singleton' },
      }),
    );
    return {
      reminderOffsetDays: row.reminderOffsetDays,
      overdueGraceDays: row.overdueGraceDays,
      escalationOffsetDays: row.escalationOffsetDays,
      timezone: row.timezone,
      currency: row.currency,
      dailySweepCron: row.dailySweepCron,
    };
  }

  async update(dto: UpdateSettingsDto, actorId: string): Promise<SettingsView> {
    await this.prisma.appSetting.upsert({
      where: { id: 'singleton' },
      update: { ...dto, updatedByUserId: actorId },
      create: { id: 'singleton', ...dto },
    });
    await this.audit.record({
      userId: actorId,
      action: 'SETTINGS_UPDATED',
      entityType: 'AppSetting',
      entityId: 'singleton',
      metadata: { ...dto },
    });
    return this.get();
  }

  async ensureTemplates(): Promise<void> {
    for (const type of AUTOMATED_TEMPLATE_TYPES) {
      const tpl = DEFAULT_TEMPLATES[type];
      await this.upsertRace(() =>
        this.prisma.emailTemplate.upsert({
          where: { type },
          update: {},
          create: { type, subject: tpl.subject, bodyHtml: tpl.bodyHtml, bodyText: tpl.bodyText },
        }),
      );
    }
  }

  async listTemplates(): Promise<EmailTemplateView[]> {
    await this.ensureTemplates();
    const rows = await this.prisma.emailTemplate.findMany({
      where: { type: { in: AUTOMATED_TEMPLATE_TYPES as unknown as EmailType[] } },
    });
    const order = AUTOMATED_TEMPLATE_TYPES as readonly EmailType[];
    return rows
      .map((r) => ({
        type: r.type,
        subject: r.subject,
        bodyHtml: r.bodyHtml,
        bodyText: r.bodyText,
        updatedAt: r.updatedAt.toISOString(),
      }))
      .sort((a, b) => order.indexOf(a.type) - order.indexOf(b.type));
  }

  async updateTemplate(
    type: EmailType,
    dto: UpdateTemplateDto,
    actorId: string,
  ): Promise<EmailTemplateView> {
    const row = await this.prisma.emailTemplate.update({
      where: { type },
      data: { ...dto, updatedByUserId: actorId },
    });
    await this.audit.record({
      userId: actorId,
      action: 'TEMPLATE_UPDATED',
      entityType: 'EmailTemplate',
      entityId: type,
    });
    return {
      type: row.type,
      subject: row.subject,
      bodyHtml: row.bodyHtml,
      bodyText: row.bodyText,
      updatedAt: row.updatedAt.toISOString(),
    };
  }
}
