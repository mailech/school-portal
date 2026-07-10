// String-literal enums that MIRROR the Prisma schema exactly (same string values),
// so backend Prisma enum values are structurally assignable to these — while the
// web app depends only on @app/types (never on Prisma / @app/db).

export const UserRole = {
  ADMIN: 'ADMIN',
  ACCOUNTANT: 'ACCOUNTANT',
  STUDENT: 'STUDENT',
  PARENT: 'PARENT',
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

/** Roles that can log into the staff portal in Phase 1. */
export const STAFF_ROLES: UserRole[] = [UserRole.ADMIN, UserRole.ACCOUNTANT];

export const PaymentDueStatus = {
  UPCOMING: 'UPCOMING',
  REMINDED: 'REMINDED',
  OVERDUE: 'OVERDUE',
  UNDER_REVIEW: 'UNDER_REVIEW',
  PAID: 'PAID',
} as const;
export type PaymentDueStatus = (typeof PaymentDueStatus)[keyof typeof PaymentDueStatus];

export const EmailType = {
  PRE_DUE_REMINDER: 'PRE_DUE_REMINDER',
  OVERDUE_NOTICE: 'OVERDUE_NOTICE',
  ESCALATION: 'ESCALATION',
  PAYMENT_RECEIVED: 'PAYMENT_RECEIVED',
  MANUAL_BLAST: 'MANUAL_BLAST',
} as const;
export type EmailType = (typeof EmailType)[keyof typeof EmailType];

export const EmailStatus = {
  QUEUED: 'QUEUED',
  SENT: 'SENT',
  FAILED: 'FAILED',
} as const;
export type EmailStatus = (typeof EmailStatus)[keyof typeof EmailStatus];

export const ReplyClassification = {
  UNREVIEWED: 'UNREVIEWED',
  IS_PAYMENT: 'IS_PAYMENT',
  NOT_PAYMENT: 'NOT_PAYMENT',
} as const;
export type ReplyClassification = (typeof ReplyClassification)[keyof typeof ReplyClassification];

export const ReplyMatchMethod = {
  THREAD: 'THREAD',
  SENDER: 'SENDER',
  UNMATCHED: 'UNMATCHED',
} as const;
export type ReplyMatchMethod = (typeof ReplyMatchMethod)[keyof typeof ReplyMatchMethod];

/** Names of durable background jobs (pg-boss queues). */
export const JobName = {
  DAILY_SWEEP: 'daily-sweep',
  OUTBOUND_EMAIL: 'outbound-email',
  INBOUND_POLL: 'inbound-poll',
  PROCESS_INBOUND: 'process-inbound',
} as const;
export type JobName = (typeof JobName)[keyof typeof JobName];

// --- UI status metadata (traffic-light system) ----------------------------
// `tone` maps to design tokens; `label` and `icon` ensure color is never the
// only signal (accessibility).
export type StatusTone = 'neutral' | 'info' | 'danger' | 'warning' | 'success';

export interface StatusMeta {
  label: string;
  tone: StatusTone;
  /** Lucide icon name used by the web app. */
  icon: string;
  description: string;
}

export const STATUS_META: Record<PaymentDueStatus, StatusMeta> = {
  UPCOMING: {
    label: 'Upcoming',
    tone: 'neutral',
    icon: 'circle-dashed',
    description: 'Due date is far off; nothing sent yet.',
  },
  REMINDED: {
    label: 'Reminded',
    tone: 'info',
    icon: 'bell',
    description: 'Pre-due reminder sent; not yet due, unpaid.',
  },
  OVERDUE: {
    label: 'Overdue',
    tone: 'danger',
    icon: 'alert-triangle',
    description: 'Due date passed, still unpaid.',
  },
  UNDER_REVIEW: {
    label: 'Under review',
    tone: 'warning',
    icon: 'mail-question',
    description: 'A parent reply arrived; awaiting accountant confirmation.',
  },
  PAID: {
    label: 'Paid',
    tone: 'success',
    icon: 'check-circle',
    description: 'Payment confirmed.',
  },
};

export const PAYMENT_DUE_STATUS_ORDER: PaymentDueStatus[] = [
  PaymentDueStatus.OVERDUE,
  PaymentDueStatus.UNDER_REVIEW,
  PaymentDueStatus.REMINDED,
  PaymentDueStatus.UPCOMING,
  PaymentDueStatus.PAID,
];
