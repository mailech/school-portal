import { DateTime } from 'luxon';
import type { ClockPort } from '../ports/clock.port';

export class SystemClock implements ClockPort {
  nowUtc(): Date {
    return new Date();
  }

  startOfTodayInZone(timezone: string): DateTime {
    return DateTime.now().setZone(timezone).startOf('day');
  }
}

/** A clock frozen at a fixed instant — used in tests and reproducible sweeps. */
export class FixedClock implements ClockPort {
  constructor(private readonly instant: Date) {}

  nowUtc(): Date {
    return this.instant;
  }

  startOfTodayInZone(timezone: string): DateTime {
    return DateTime.fromJSDate(this.instant).setZone(timezone).startOf('day');
  }
}
