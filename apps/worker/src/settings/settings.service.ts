import { Inject, Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@app/db';
import { DEFAULT_TEMPLATES } from '@app/core';
import { EmailType } from '@app/types';
import { PrismaService } from '../prisma/prisma.service';
import { WORKER_CONFIG, type WorkerConfig } from '../config/worker-config';

export interface EffectiveSettings {
  reminderOffsetDays: number;
  overdueGraceDays: number;
  escalationOffsetDays: number;
  timezone: string;
  currency: string;
  dailySweepCron: string;
}

@Injectable()
export class SettingsService {
  private readonly logger = new Logger('Settings');

  constructor(
    private readonly prisma: PrismaService,
    @Inject(WORKER_CONFIG) private readonly config: WorkerConfig,
  ) {}

  /** Reads the AppSetting singleton (DB wins), creating it from env defaults if
   *  missing. This is the runtime source of truth for offsets + timezone. */
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

  async getEffective(): Promise<EffectiveSettings> {
    const row = await this.upsertRace(() =>
      this.prisma.appSetting.upsert({
        where: { id: 'singleton' },
        update: {},
        create: {
          id: 'singleton',
          reminderOffsetDays: this.config.sweepDefaults.reminderOffsetDays,
          overdueGraceDays: this.config.sweepDefaults.overdueGraceDays,
          escalationOffsetDays: this.config.sweepDefaults.escalationOffsetDays,
          timezone: this.config.timezone,
          currency: this.config.currency,
          dailySweepCron: this.config.dailySweepCron,
        },
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

  /** Ensures the four automated email templates exist (idempotent). */
  async ensureTemplates(): Promise<void> {
    const types = [
      EmailType.PRE_DUE_REMINDER,
      EmailType.OVERDUE_NOTICE,
      EmailType.ESCALATION,
      EmailType.PAYMENT_RECEIVED,
    ] as const;
    for (const type of types) {
      const tpl = DEFAULT_TEMPLATES[type];
      await this.upsertRace(() =>
        this.prisma.emailTemplate.upsert({
          where: { type },
          update: {},
          create: {
            type,
            subject: tpl.subject,
            bodyHtml: tpl.bodyHtml,
            bodyText: tpl.bodyText,
          },
        }),
      );
    }
    this.logger.log('Email templates ensured');
  }
}
