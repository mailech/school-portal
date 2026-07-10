import { EmailType, PaymentDueStatus } from '@app/types';
import {
  transition,
  canTransition,
  isTerminal,
  InvalidStateTransitionError,
  type DueEvent,
} from './state-machine';

const S = PaymentDueStatus;
const E = EmailType;

describe('payment state machine', () => {
  describe('legal transitions', () => {
    const cases: Array<[PaymentDueStatus, DueEvent, PaymentDueStatus, EmailType | null]> = [
      [S.UPCOMING, 'SEND_REMINDER', S.REMINDED, E.PRE_DUE_REMINDER],
      [S.UPCOMING, 'MARK_OVERDUE', S.OVERDUE, E.OVERDUE_NOTICE],
      [S.REMINDED, 'MARK_OVERDUE', S.OVERDUE, E.OVERDUE_NOTICE],
      [S.OVERDUE, 'ESCALATE', S.OVERDUE, E.ESCALATION],
      [S.REMINDED, 'REPLY_RECEIVED', S.UNDER_REVIEW, null],
      [S.OVERDUE, 'REPLY_RECEIVED', S.UNDER_REVIEW, null],
      [S.UNDER_REVIEW, 'REPLY_RECEIVED', S.UNDER_REVIEW, null],
      [S.UNDER_REVIEW, 'CONFIRM_PAYMENT', S.PAID, E.PAYMENT_RECEIVED],
      [S.UNDER_REVIEW, 'REJECT_PAYMENT', S.OVERDUE, null],
      [S.OVERDUE, 'MANUAL_MARK_PAID', S.PAID, E.PAYMENT_RECEIVED],
      [S.UPCOMING, 'MANUAL_MARK_PAID', S.PAID, E.PAYMENT_RECEIVED],
      [S.REMINDED, 'MANUAL_MARK_PAID', S.PAID, E.PAYMENT_RECEIVED],
    ];

    it.each(cases)('%s + %s -> %s (email %s)', (from, event, expectedStatus, expectedEmail) => {
      const result = transition(from, event);
      expect(result.status).toBe(expectedStatus);
      expect(result.email).toBe(expectedEmail);
      expect(canTransition(from, event)).toBe(true);
    });
  });

  describe('illegal transitions throw', () => {
    const illegal: Array<[PaymentDueStatus, DueEvent]> = [
      // PAID is terminal for every event
      [S.PAID, 'SEND_REMINDER'],
      [S.PAID, 'MARK_OVERDUE'],
      [S.PAID, 'ESCALATE'],
      [S.PAID, 'REPLY_RECEIVED'],
      [S.PAID, 'CONFIRM_PAYMENT'],
      [S.PAID, 'REJECT_PAYMENT'],
      [S.PAID, 'MANUAL_MARK_PAID'],
      // reminder only from UPCOMING
      [S.REMINDED, 'SEND_REMINDER'],
      [S.OVERDUE, 'SEND_REMINDER'],
      // escalate only from OVERDUE
      [S.REMINDED, 'ESCALATE'],
      [S.UPCOMING, 'ESCALATE'],
      // confirm/reject only from UNDER_REVIEW
      [S.OVERDUE, 'CONFIRM_PAYMENT'],
      [S.REMINDED, 'REJECT_PAYMENT'],
      // overdue only from UPCOMING/REMINDED
      [S.UNDER_REVIEW, 'MARK_OVERDUE'],
    ];

    it.each(illegal)('%s + %s throws', (from, event) => {
      expect(() => transition(from, event)).toThrow(InvalidStateTransitionError);
      expect(canTransition(from, event)).toBe(false);
    });

    it('carries from/event/code on the error', () => {
      try {
        transition(S.PAID, 'MANUAL_MARK_PAID');
        fail('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(InvalidStateTransitionError);
        const e = err as InvalidStateTransitionError;
        expect(e.from).toBe(S.PAID);
        expect(e.event).toBe('MANUAL_MARK_PAID');
        expect(e.code).toBe('INVALID_STATE_TRANSITION');
      }
    });
  });

  describe('isTerminal', () => {
    it('only PAID is terminal', () => {
      expect(isTerminal(S.PAID)).toBe(true);
      for (const s of [S.UPCOMING, S.REMINDED, S.OVERDUE, S.UNDER_REVIEW]) {
        expect(isTerminal(s)).toBe(false);
      }
    });
  });
});
