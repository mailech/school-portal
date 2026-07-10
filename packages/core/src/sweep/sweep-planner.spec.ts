import { DateTime } from 'luxon';
import { PaymentDueStatus } from '@app/types';
import { planSweep, type SweepCandidate, type SweepSettings } from './sweep-planner';

const S = PaymentDueStatus;
const TZ = 'Asia/Kolkata';

const settings: SweepSettings = {
  reminderOffsetDays: 10,
  overdueGraceDays: 0,
  escalationOffsetDays: 10,
  timezone: TZ,
};

// "Today" frozen at 2026-07-07 in Asia/Kolkata.
const today = DateTime.fromISO('2026-07-07T09:00:00', { zone: TZ });

/** Build a due date N days from today (in the school zone), returned as a JS Date. */
function dueInDays(n: number): Date {
  return today.startOf('day').plus({ days: n }).toJSDate();
}

function candidate(partial: Partial<SweepCandidate> & Pick<SweepCandidate, 'status' | 'dueDate'>): SweepCandidate {
  return {
    dueId: 'due-1',
    hasReminderLog: false,
    hasOverdueLog: false,
    hasEscalationLog: false,
    ...partial,
  };
}

describe('planSweep', () => {
  it('sends a reminder exactly at the reminder window edge (10 days out)', () => {
    const actions = planSweep([candidate({ status: S.UPCOMING, dueDate: dueInDays(10) })], settings, today);
    expect(actions).toHaveLength(1);
    expect(actions[0].event).toBe('SEND_REMINDER');
  });

  it('sends a reminder inside the window (catch-up, 5 days out)', () => {
    const actions = planSweep([candidate({ status: S.UPCOMING, dueDate: dueInDays(5) })], settings, today);
    expect(actions[0].event).toBe('SEND_REMINDER');
  });

  it('does NOT send a reminder before the window (11 days out)', () => {
    const actions = planSweep([candidate({ status: S.UPCOMING, dueDate: dueInDays(11) })], settings, today);
    expect(actions).toHaveLength(0);
  });

  it('does NOT re-send a reminder when one was already sent', () => {
    const actions = planSweep(
      [candidate({ status: S.UPCOMING, dueDate: dueInDays(5), hasReminderLog: true })],
      settings,
      today,
    );
    expect(actions).toHaveLength(0);
  });

  it('flips to OVERDUE the day after the due date (grace 0)', () => {
    const actions = planSweep([candidate({ status: S.REMINDED, dueDate: dueInDays(-1) })], settings, today);
    expect(actions[0].event).toBe('MARK_OVERDUE');
  });

  it('does NOT flip overdue on the due date itself (grace 0)', () => {
    const actions = planSweep([candidate({ status: S.UPCOMING, dueDate: dueInDays(0) })], settings, today);
    // due today -> still in reminder window, not overdue
    expect(actions[0].event).toBe('SEND_REMINDER');
  });

  it('respects overdue grace days', () => {
    const graced: SweepSettings = { ...settings, overdueGraceDays: 3 };
    // 2 days overdue but grace is 3 -> no action
    expect(planSweep([candidate({ status: S.REMINDED, dueDate: dueInDays(-2) })], graced, today)).toHaveLength(0);
    // 4 days overdue, beyond grace -> overdue
    expect(planSweep([candidate({ status: S.REMINDED, dueDate: dueInDays(-4) })], graced, today)[0].event).toBe(
      'MARK_OVERDUE',
    );
  });

  it('escalates once at the escalation offset and not before', () => {
    // 9 days overdue -> not yet (offset 10)
    expect(planSweep([candidate({ status: S.OVERDUE, dueDate: dueInDays(-9) })], settings, today)).toHaveLength(0);
    // 10 days overdue -> escalate
    const actions = planSweep([candidate({ status: S.OVERDUE, dueDate: dueInDays(-10) })], settings, today);
    expect(actions[0].event).toBe('ESCALATE');
  });

  it('does NOT re-escalate when already escalated', () => {
    const actions = planSweep(
      [candidate({ status: S.OVERDUE, dueDate: dueInDays(-20), hasEscalationLog: true })],
      settings,
      today,
    );
    expect(actions).toHaveLength(0);
  });

  it('never touches PAID or UNDER_REVIEW dues', () => {
    const actions = planSweep(
      [
        candidate({ status: S.PAID, dueDate: dueInDays(-30) }),
        candidate({ status: S.UNDER_REVIEW, dueDate: dueInDays(-30) }),
      ],
      settings,
      today,
    );
    expect(actions).toHaveLength(0);
  });

  it('is idempotent: re-running after logs are set yields no actions', () => {
    // After a first run, a reminded+overdue+escalated due has all logs set and
    // its status advanced — nothing new to do.
    const settled = candidate({
      status: S.OVERDUE,
      dueDate: dueInDays(-15),
      hasReminderLog: true,
      hasOverdueLog: true,
      hasEscalationLog: true,
    });
    expect(planSweep([settled], settings, today)).toHaveLength(0);
  });

  it('handles a due that missed several sweeps (upcoming but long overdue) by flipping overdue', () => {
    const actions = planSweep([candidate({ status: S.UPCOMING, dueDate: dueInDays(-40) })], settings, today);
    expect(actions[0].event).toBe('MARK_OVERDUE');
  });
});
