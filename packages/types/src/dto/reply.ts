import { z } from 'zod';
import { ReplyClassification, ReplyMatchMethod, PaymentDueStatus } from '../enums';

export const replyListQuerySchema = z.object({
  classification: z
    .enum([
      ReplyClassification.UNREVIEWED,
      ReplyClassification.IS_PAYMENT,
      ReplyClassification.NOT_PAYMENT,
    ])
    .optional(),
  onlyPendingReview: z.coerce.boolean().optional(),
});
export type ReplyListQuery = z.infer<typeof replyListQuerySchema>;

export const confirmPaymentSchema = z.object({
  paidAmount: z.number().nonnegative().optional(),
  note: z.string().trim().max(500).optional(),
});
export type ConfirmPaymentDto = z.infer<typeof confirmPaymentSchema>;

export const rejectReplySchema = z.object({
  note: z.string().trim().max(500).optional(),
});
export type RejectReplyDto = z.infer<typeof rejectReplySchema>;

export interface ReplyView {
  id: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: string;
  matchMethod: ReplyMatchMethod;
  classification: ReplyClassification;
  reviewedByName: string | null;
  reviewedAt: string | null;
  student: {
    id: string;
    name: string;
    regId: string;
    className: string;
  } | null;
  due: {
    id: string;
    installmentNumber: number;
    amount: number;
    status: PaymentDueStatus;
    dueDate: string;
  } | null;
}

// Dev-only endpoint payload to simulate an inbound parent reply.
export const simulateReplySchema = z.object({
  dueId: z.string().optional(),
  studentId: z.string().optional(),
  fromEmail: z.string().email().optional(),
  subject: z.string().max(200).optional(),
  body: z.string().max(5000).default('We have paid the fees, please find the receipt attached.'),
});
export type SimulateReplyDto = z.infer<typeof simulateReplySchema>;
