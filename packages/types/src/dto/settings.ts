import { z } from 'zod';
import { EmailType } from '../enums';

export const updateSettingsSchema = z.object({
  reminderOffsetDays: z.number().int().min(0).max(120).optional(),
  overdueGraceDays: z.number().int().min(0).max(120).optional(),
  escalationOffsetDays: z.number().int().min(0).max(365).optional(),
  timezone: z.string().trim().min(1).optional(),
  currency: z.string().trim().min(1).max(8).optional(),
  dailySweepCron: z
    .string()
    .trim()
    .regex(/^(\S+\s+){4}\S+$/, 'Must be a 5-field cron expression')
    .optional(),
});
export type UpdateSettingsDto = z.infer<typeof updateSettingsSchema>;

export interface SettingsView {
  reminderOffsetDays: number;
  overdueGraceDays: number;
  escalationOffsetDays: number;
  timezone: string;
  currency: string;
  dailySweepCron: string;
}

const templateTypeEnum = z.enum([
  EmailType.PRE_DUE_REMINDER,
  EmailType.OVERDUE_NOTICE,
  EmailType.ESCALATION,
  EmailType.PAYMENT_RECEIVED,
]);

export const updateTemplateSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  bodyHtml: z.string().min(1).max(20000),
  bodyText: z.string().min(1).max(20000),
});
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;

export const templateParamSchema = z.object({ type: templateTypeEnum });

export interface EmailTemplateView {
  type: EmailType;
  subject: string;
  bodyHtml: string;
  bodyText: string;
  updatedAt: string;
}

/** Variables available in every template. */
export const TEMPLATE_VARIABLES = [
  'studentName',
  'className',
  'installmentNumber',
  'amount',
  'dueDate',
  'parentName',
] as const;
export type TemplateVariable = (typeof TEMPLATE_VARIABLES)[number];
