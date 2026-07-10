import { DateTime } from 'luxon';

/**
 * All time reads go through a ClockPort so the sweep is deterministic and
 * timezone-correct. The planner never calls the clock itself — it receives a
 * frozen `todayInZone`, which makes boundary behaviour trivially testable.
 */
export interface ClockPort {
  nowUtc(): Date;
  /** Start-of-day in the given IANA timezone (e.g. Asia/Kolkata). */
  startOfTodayInZone(timezone: string): DateTime;
}

export const CLOCK_PORT = Symbol('CLOCK_PORT');
