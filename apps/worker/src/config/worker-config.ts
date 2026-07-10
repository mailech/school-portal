import { z } from 'zod';

const boolish = (def: boolean) =>
  z
    .enum(['true', 'false', '1', '0'])
    .transform((v) => v === 'true' || v === '1')
    .or(z.boolean())
    .default(def);

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  TZ_DEFAULT: z.string().default('Asia/Kolkata'),
  CURRENCY: z.string().default('INR'),
  DATABASE_URL: z.string().url(),

  PGBOSS_SCHEMA: z.string().default('pgboss'),
  PGBOSS_ARCHIVE_COMPLETED_AFTER_SEC: z.coerce.number().int().default(86400),
  PGBOSS_DELETE_AFTER_DAYS: z.coerce.number().int().default(7),

  REMINDER_OFFSET_DAYS: z.coerce.number().int().default(10),
  OVERDUE_GRACE_DAYS: z.coerce.number().int().default(0),
  ESCALATION_OFFSET_DAYS: z.coerce.number().int().default(10),
  DAILY_SWEEP_CRON: z.string().default('0 6 * * *'),

  EMAIL_PROVIDER: z.enum(['smtp_imap', 'gmail_api']).default('smtp_imap'),
  MAIL_TRANSPORT: z.enum(['dev', 'smtp']).default('dev'),
  MAIL_FROM: z.string().default('School Fees Office <fees@school.test>'),
  MAIL_REPLY_TO: z.string().optional(),

  SMTP_HOST: z.string().default('127.0.0.1'),
  SMTP_PORT: z.coerce.number().int().default(1025),
  SMTP_USER: z.string().optional(),
  SMTP_PASS: z.string().optional(),
  SMTP_SECURE: boolish(false),

  IMAP_ENABLED: boolish(false),
  IMAP_HOST: z.string().optional(),
  IMAP_PORT: z.coerce.number().int().default(993),
  IMAP_USER: z.string().optional(),
  IMAP_PASS: z.string().optional(),
  IMAP_TLS: boolish(true),
  IMAP_POLL_CRON: z.string().default('*/2 * * * *'),
  IMAP_MAILBOX: z.string().default('INBOX'),

  GMAIL_CLIENT_ID: z.string().optional(),
  GMAIL_CLIENT_SECRET: z.string().optional(),
  GMAIL_REFRESH_TOKEN: z.string().optional(),
  GMAIL_USER: z.string().optional(),
  GMAIL_TOPIC: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

export interface WorkerConfig {
  nodeEnv: Env['NODE_ENV'];
  isProd: boolean;
  timezone: string;
  currency: string;
  databaseUrl: string;
  queue: { schema: string; archiveCompletedAfterSec: number; deleteAfterDays: number };
  sweepDefaults: { reminderOffsetDays: number; overdueGraceDays: number; escalationOffsetDays: number };
  dailySweepCron: string;
  email: {
    provider: Env['EMAIL_PROVIDER'];
    transport: Env['MAIL_TRANSPORT'];
    from: string;
    replyTo?: string;
    smtp: { host: string; port: number; user?: string; pass?: string; secure: boolean };
    imap: {
      enabled: boolean;
      host?: string;
      port: number;
      user?: string;
      pass?: string;
      tls: boolean;
      pollCron: string;
      mailbox: string;
    };
    gmail: {
      clientId?: string;
      clientSecret?: string;
      refreshToken?: string;
      user?: string;
      topic?: string;
    };
  };
}

export const WORKER_CONFIG = Symbol('WORKER_CONFIG');

export function loadWorkerConfig(source: NodeJS.ProcessEnv = process.env): WorkerConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.') || '(root)'}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid worker environment:\n${issues}`);
  }
  const e = parsed.data;
  return {
    nodeEnv: e.NODE_ENV,
    isProd: e.NODE_ENV === 'production',
    timezone: e.TZ_DEFAULT,
    currency: e.CURRENCY,
    databaseUrl: e.DATABASE_URL,
    queue: {
      schema: e.PGBOSS_SCHEMA,
      archiveCompletedAfterSec: e.PGBOSS_ARCHIVE_COMPLETED_AFTER_SEC,
      deleteAfterDays: e.PGBOSS_DELETE_AFTER_DAYS,
    },
    sweepDefaults: {
      reminderOffsetDays: e.REMINDER_OFFSET_DAYS,
      overdueGraceDays: e.OVERDUE_GRACE_DAYS,
      escalationOffsetDays: e.ESCALATION_OFFSET_DAYS,
    },
    dailySweepCron: e.DAILY_SWEEP_CRON,
    email: {
      provider: e.EMAIL_PROVIDER,
      transport: e.MAIL_TRANSPORT,
      from: e.MAIL_FROM,
      replyTo: e.MAIL_REPLY_TO,
      smtp: {
        host: e.SMTP_HOST,
        port: e.SMTP_PORT,
        user: e.SMTP_USER,
        pass: e.SMTP_PASS,
        secure: e.SMTP_SECURE,
      },
      imap: {
        enabled: e.IMAP_ENABLED,
        host: e.IMAP_HOST,
        port: e.IMAP_PORT,
        user: e.IMAP_USER,
        pass: e.IMAP_PASS,
        tls: e.IMAP_TLS,
        pollCron: e.IMAP_POLL_CRON,
        mailbox: e.IMAP_MAILBOX,
      },
      gmail: {
        clientId: e.GMAIL_CLIENT_ID,
        clientSecret: e.GMAIL_CLIENT_SECRET,
        refreshToken: e.GMAIL_REFRESH_TOKEN,
        user: e.GMAIL_USER,
        topic: e.GMAIL_TOPIC,
      },
    },
  };
}
