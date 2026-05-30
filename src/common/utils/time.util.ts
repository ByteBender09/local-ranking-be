// Time helpers anchored to Vietnam local time (UTC+7, no DST).
//
// Business rules in this app think in *Vietnam calendar days* and *Vietnam
// calendar months* — e.g. "one check-in per venue per day" and "saved venues
// reset on the 1st of each month". Server clocks run in UTC, so we shift by a
// fixed offset to reason about the wall-clock day/month a user actually sees.

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;

/** YYYY-MM-DD of the given instant in Vietnam local time. */
export function vnDayKey(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

/** True when both instants fall on the same Vietnam calendar day. */
export function isSameVnDay(a: Date, b: Date): boolean {
  return vnDayKey(a) === vnDayKey(b);
}

/**
 * The next monthly-reset instant: the 1st of next month at 00:00 Vietnam time,
 * returned as a UTC `Date`. Used both by the saved-venues cron and to tell the
 * client when their saved list will be cleared.
 */
export function nextMonthlyResetAt(now: Date = new Date()): Date {
  const vn = new Date(now.getTime() + VN_OFFSET_MS);
  const year = vn.getUTCFullYear();
  const month = vn.getUTCMonth(); // 0-based, evaluated in VN local time
  const firstOfNextMonthVnMidnightUtc =
    Date.UTC(year, month + 1, 1, 0, 0, 0) - VN_OFFSET_MS;
  return new Date(firstOfNextMonthVnMidnightUtc);
}
