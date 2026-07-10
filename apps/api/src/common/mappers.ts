import type {
  DueDetailView,
  EmailLogView,
  PaymentDueStatus,
  ReplyView,
  EmailStatus,
  EmailType,
  ReplyClassification,
  ReplyMatchMethod,
} from '@app/types';

// Prisma Decimal is structurally { toString() } and works with Number().
type Money = number | string | { toString(): string } | null;
const num = (v: Money): number | null => (v === null || v === undefined ? null : Number(v));

export interface DueRow {
  id: string;
  studentId: string;
  amount: Money;
  status: string;
  dueDate: Date;
  paidAmount: Money;
  paidAt: Date | null;
  installment: { installmentNumber: number };
  markedPaidBy?: { name: string } | null;
}

export function toDueDetailView(d: DueRow): DueDetailView {
  return {
    id: d.id,
    studentId: d.studentId,
    installmentNumber: d.installment.installmentNumber,
    amount: Number(d.amount),
    status: d.status as PaymentDueStatus,
    dueDate: d.dueDate.toISOString(),
    paidAmount: num(d.paidAmount),
    paidAt: d.paidAt ? d.paidAt.toISOString() : null,
    markedPaidByName: d.markedPaidBy?.name ?? null,
  };
}

export interface EmailLogRow {
  id: string;
  studentId: string;
  paymentDueId: string | null;
  type: string;
  toEmail: string;
  subject: string;
  status: string;
  error: string | null;
  attempts: number;
  sentAt: Date | null;
  createdAt: Date;
}

export function toEmailLogView(l: EmailLogRow, studentName: string): EmailLogView {
  return {
    id: l.id,
    studentId: l.studentId,
    studentName,
    paymentDueId: l.paymentDueId,
    type: l.type as EmailType,
    toEmail: l.toEmail,
    subject: l.subject,
    status: l.status as EmailStatus,
    error: l.error,
    attempts: l.attempts,
    sentAt: l.sentAt ? l.sentAt.toISOString() : null,
    createdAt: l.createdAt.toISOString(),
  };
}

export interface ReplyRow {
  id: string;
  fromEmail: string;
  subject: string;
  snippet: string;
  bodyText: string;
  receivedAt: Date;
  matchMethod: string;
  classification: string;
  reviewedAt: Date | null;
  reviewedBy?: { name: string } | null;
  student?: { id: string; name: string; regId: string; schoolClass: { name: string } } | null;
  paymentDue?:
    | {
        id: string;
        amount: Money;
        status: string;
        dueDate: Date;
        installment: { installmentNumber: number };
      }
    | null;
}

export function toReplyView(r: ReplyRow): ReplyView {
  return {
    id: r.id,
    fromEmail: r.fromEmail,
    subject: r.subject,
    snippet: r.snippet,
    bodyText: r.bodyText,
    receivedAt: r.receivedAt.toISOString(),
    matchMethod: r.matchMethod as ReplyMatchMethod,
    classification: r.classification as ReplyClassification,
    reviewedByName: r.reviewedBy?.name ?? null,
    reviewedAt: r.reviewedAt ? r.reviewedAt.toISOString() : null,
    student: r.student
      ? {
          id: r.student.id,
          name: r.student.name,
          regId: r.student.regId,
          className: r.student.schoolClass.name,
        }
      : null,
    due: r.paymentDue
      ? {
          id: r.paymentDue.id,
          installmentNumber: r.paymentDue.installment.installmentNumber,
          amount: Number(r.paymentDue.amount),
          status: r.paymentDue.status as PaymentDueStatus,
          dueDate: r.paymentDue.dueDate.toISOString(),
        }
      : null,
  };
}
