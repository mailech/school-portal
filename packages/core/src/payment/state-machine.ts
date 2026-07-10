import { EmailType, PaymentDueStatus } from '@app/types';

/**
 * The full set of events that can drive a PaymentDue through its lifecycle.
 * Every status change in the system flows through `transition()` — the same
 * function is used by the API (accountant actions) and the worker (daily sweep),
 * so the rules can never diverge.
 */
export type DueEvent =
  | 'SEND_REMINDER' // pre-due reminder sent
  | 'MARK_OVERDUE' // due date passed, unpaid
  | 'ESCALATE' // escalation notice (stays overdue)
  | 'REPLY_RECEIVED' // a parent reply arrived
  | 'CONFIRM_PAYMENT' // accountant confirmed the reply is a payment
  | 'REJECT_PAYMENT' // accountant rejected the reply
  | 'MANUAL_MARK_PAID'; // accountant marked paid directly (paid at office)

export interface TransitionResult {
  status: PaymentDueStatus;
  /** The email that this transition should trigger, if any. */
  email: EmailType | null;
}

export class InvalidStateTransitionError extends Error {
  readonly code = 'INVALID_STATE_TRANSITION';
  constructor(
    public readonly from: PaymentDueStatus,
    public readonly event: DueEvent,
  ) {
    super(`Cannot apply event "${event}" to a due in status "${from}".`);
    this.name = 'InvalidStateTransitionError';
  }
}

const S = PaymentDueStatus;
const E = EmailType;

interface Rule {
  from: PaymentDueStatus[];
  to: PaymentDueStatus;
  email: EmailType | null;
}

/**
 * Single source of truth for allowed transitions. `from` lists every status the
 * event is legal in. PAID is terminal — it appears in no `from` list, so any
 * event applied to a PAID due throws.
 */
const TRANSITIONS: Record<DueEvent, Rule> = {
  SEND_REMINDER: { from: [S.UPCOMING], to: S.REMINDED, email: E.PRE_DUE_REMINDER },
  MARK_OVERDUE: { from: [S.UPCOMING, S.REMINDED], to: S.OVERDUE, email: E.OVERDUE_NOTICE },
  ESCALATE: { from: [S.OVERDUE], to: S.OVERDUE, email: E.ESCALATION },
  REPLY_RECEIVED: {
    from: [S.UPCOMING, S.REMINDED, S.OVERDUE, S.UNDER_REVIEW],
    to: S.UNDER_REVIEW,
    email: null,
  },
  CONFIRM_PAYMENT: { from: [S.UNDER_REVIEW], to: S.PAID, email: E.PAYMENT_RECEIVED },
  REJECT_PAYMENT: { from: [S.UNDER_REVIEW], to: S.OVERDUE, email: null },
  MANUAL_MARK_PAID: {
    from: [S.UPCOMING, S.REMINDED, S.OVERDUE, S.UNDER_REVIEW],
    to: S.PAID,
    email: E.PAYMENT_RECEIVED,
  },
};

/**
 * Applies `event` to a due currently in `from`. Returns the next status and the
 * email (if any) the caller must enqueue. Throws `InvalidStateTransitionError`
 * for any illegal transition — callers catch this and return a typed conflict.
 */
export function transition(from: PaymentDueStatus, event: DueEvent): TransitionResult {
  const rule = TRANSITIONS[event];
  if (!rule || !rule.from.includes(from)) {
    throw new InvalidStateTransitionError(from, event);
  }
  return { status: rule.to, email: rule.email };
}

/** Non-throwing guard: is this event legal from the given status? */
export function canTransition(from: PaymentDueStatus, event: DueEvent): boolean {
  const rule = TRANSITIONS[event];
  return !!rule && rule.from.includes(from);
}

/** PAID is the only terminal status. */
export function isTerminal(status: PaymentDueStatus): boolean {
  return status === S.PAID;
}
