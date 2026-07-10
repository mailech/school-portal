import { z } from 'zod';
import { positiveAmountSchema } from './common';
import { PaymentDueStatus } from '../enums';

const statusEnum = z.enum([
  PaymentDueStatus.UPCOMING,
  PaymentDueStatus.REMINDED,
  PaymentDueStatus.OVERDUE,
  PaymentDueStatus.UNDER_REVIEW,
  PaymentDueStatus.PAID,
]);

export const duesBoardQuerySchema = z.object({
  academicYearId: z.string().optional(),
  schoolClassId: z.string().optional(),
  section: z.string().optional(),
  status: statusEnum.optional(),
  installmentNumber: z.coerce.number().int().min(1).max(12).optional(),
  search: z.string().trim().max(120).optional(),
});
export type DuesBoardQuery = z.infer<typeof duesBoardQuerySchema>;

export interface DueCell {
  dueId: string;
  installmentNumber: number;
  amount: number;
  status: PaymentDueStatus;
  dueDate: string;
  paidAmount: number | null;
  paidAt: string | null;
  hasPendingReply: boolean;
}

/** One row per student, with a cell per installment — the register layout. */
export interface DuesBoardRow {
  studentId: string;
  studentName: string;
  regId: string;
  className: string;
  section: string | null;
  parentEmail: string;
  cells: DueCell[];
}

export interface DuesBoardResponse {
  rows: DuesBoardRow[];
  installmentColumns: number[];
  counts: Record<PaymentDueStatus, number>;
  totalDues: number;
}

export const markPaidSchema = z.object({
  paidAmount: positiveAmountSchema.optional(),
  paidAt: z.coerce.date().optional(),
  note: z.string().trim().max(500).optional(),
});
export type MarkPaidDto = z.infer<typeof markPaidSchema>;

export interface DueDetailView {
  id: string;
  studentId: string;
  installmentNumber: number;
  amount: number;
  status: PaymentDueStatus;
  dueDate: string;
  paidAmount: number | null;
  paidAt: string | null;
  markedPaidByName: string | null;
}
