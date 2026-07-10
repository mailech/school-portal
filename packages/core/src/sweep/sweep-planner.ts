import { DateTime } from 'luxon';
import { PaymentDueStatus } from '@app/types';
import type { DueEvent } from '../payment/state-machine';

export interface SweepSettings {
  reminderOffsetDays: number;
  overdueGraceDays: number;
  escalationOffsetDays: number;
  timezone: string;
}

export interface SweepCandidate {
  dueId: string;
  status: PaymentDueStatus;
  /** The installment due date (stored as timestamptz). */
  dueDate: Date;
  hasReminderLog: boolean;
  hasOverdueLog: boolean;
  hasEscalationLog: boolean;
}

export interface SweepAction {
  dueId: string;
  event: Extract<DueEvent, 'SEND_REMINDER' | 'MARK_OVERDUE' | 'ESCALATE'>;
  /** The status the executor expects to still see (optimistic precondition). */
  expectedStatus: PaymentDueStatus;
  reason: string;
}

const S = PaymentDueStatus;

/**
 * Pure planner: given the candidate dues, settings, and a frozen "today" in the
 * school timezone, returns the list of actions to apply. Performs no I/O and
 * reads no clock — which is exactly why every boundary is unit-testable and why
 * re-running the same day (with updated has*Log flags) converges to no actions.
 *
 * PAID and UNDER_REVIEW dues are never touched by the sweep.
 */
export function planSweep(
  candidates: SweepCandidate[],
  settings: SweepSettings,
  todayInZone: DateTime,
): SweepAction[] {
  const today = todayInZone.startOf('day');
  const actions: SweepAction[] = [];

  for (const c of candidates) {
    if (c.status === S.PAID || c.status === S.UNDER_REVIEW) continue;

    const dueStart = DateTime.fromJSDate(c.dueDate).setZone(settings.timezone).startOf('day');
    const daysUntilDue = Math.round(dueStart.diff(today, 'days').days);

    // 1) Pre-due reminder — unpaid, within the reminder window, not yet reminded.
    if (
      c.status === S.UPCOMING &&
      daysUntilDue >= 0 &&
      daysUntilDue <= settings.reminderOffsetDays &&
      !c.hasReminderLog
    ) {
      actions.push({
        dueId: c.dueId,
        event: 'SEND_REMINDER',
        expectedStatus: c.status,
        reason: `Due in ${daysUntilDue} day(s), within reminder window of ${settings.reminderOffsetDays}.`,
      });
      continue;
    }

    // 2) Overdue flip — due date + grace has passed and still unpaid.
    //    Status flip always happens; the overdue email is idempotent downstream.
    if (
      (c.status === S.UPCOMING || c.status === S.REMINDED) &&
      daysUntilDue < -settings.overdueGraceDays
    ) {
      actions.push({
        dueId: c.dueId,
        event: 'MARK_OVERDUE',
        expectedStatus: c.status,
        reason: `Overdue by ${-daysUntilDue} day(s) (grace ${settings.overdueGraceDays}).`,
      });
      continue;
    }

    // 3) Escalation — already overdue for escalationOffsetDays, not yet escalated.
    if (
      c.status === S.OVERDUE &&
      daysUntilDue <= -settings.escalationOffsetDays &&
      !c.hasEscalationLog
    ) {
      actions.push({
        dueId: c.dueId,
        event: 'ESCALATE',
        expectedStatus: c.status,
        reason: `Overdue by ${-daysUntilDue} day(s), past escalation offset ${settings.escalationOffsetDays}.`,
      });
      continue;
    }
  }

  return actions;
}
