export const ADMIN_TIME_ZONE = 'Africa/Cairo';

export interface AdminClockDisplay {
  date: string;
  time: string;
  dateTime: string;
}

/** Format the admin overview clock in Cairo time, independent of the browser's current time zone. */
export function formatAdminClock(now: Date, locale: string): AdminClockDisplay {
  const date = new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeZone: ADMIN_TIME_ZONE,
  }).format(now);
  const time = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
    timeZone: ADMIN_TIME_ZONE,
  }).format(now);

  return { date, time, dateTime: now.toISOString() };
}
