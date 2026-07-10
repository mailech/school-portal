import { z } from 'zod';
import { EmailStatus, EmailType } from '../enums';

export interface EmailLogView {
  id: string;
  studentId: string;
  studentName: string;
  paymentDueId: string | null;
  type: EmailType;
  toEmail: string;
  subject: string;
  status: EmailStatus;
  error: string | null;
  attempts: number;
  sentAt: string | null;
  createdAt: string;
}

export const emailLogQuerySchema = z.object({
  status: z
    .enum([EmailStatus.QUEUED, EmailStatus.SENT, EmailStatus.FAILED])
    .optional(),
  type: z
    .enum([
      EmailType.PRE_DUE_REMINDER,
      EmailType.OVERDUE_NOTICE,
      EmailType.ESCALATION,
      EmailType.PAYMENT_RECEIVED,
      EmailType.MANUAL_BLAST,
    ])
    .optional(),
  studentId: z.string().optional(),
});
export type EmailLogQuery = z.infer<typeof emailLogQuerySchema>;

// "Email all red students", optionally scoped to a class/installment.
export const manualBlastSchema = z.object({
  schoolClassId: z.string().optional(),
  academicYearId: z.string().optional(),
  installmentNumber: z.number().int().min(1).max(12).optional(),
  confirm: z.boolean().default(false),
});
export type ManualBlastDto = z.infer<typeof manualBlastSchema>;

export interface ManualBlastPreview {
  targetDueCount: number;
  targetStudentCount: number;
  committed: boolean;
  queued: number;
}
