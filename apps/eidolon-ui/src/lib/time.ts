/**
 * Eidolon time formatting — pinned to Romanian civil time (Europe/Bucharest).
 *
 * Sven's operators, agents, and physical world (47Dynamics, VM4) all live in
 * Romania. Server-side rendering (Next.js node runtime) defaults to whatever
 * TZ is set on the host (typically UTC on VM4), so timestamps must be
 * explicitly localised — never trust the host TZ for user-facing output.
 *
 * EET (UTC+02:00) Oct–Mar, EEST (UTC+03:00) Apr–Oct. Intl handles DST.
 */

export const EIDOLON_TIMEZONE = 'Europe/Bucharest';
export const EIDOLON_LOCALE = 'ro-RO';

const TIME_FMT = new Intl.DateTimeFormat(EIDOLON_LOCALE, {
  timeZone: EIDOLON_TIMEZONE,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

const DATETIME_FMT = new Intl.DateTimeFormat(EIDOLON_LOCALE, {
  timeZone: EIDOLON_TIMEZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  hour12: false,
});

/** Format an ISO/epoch input as HH:MM:SS in Bucharest civil time. */
export function formatBucharestTime(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '--:--:--';
  return TIME_FMT.format(d);
}

/** Format an ISO/epoch input as YYYY-MM-DD HH:MM:SS in Bucharest civil time. */
export function formatBucharestDateTime(input: string | number | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return '----';
  return DATETIME_FMT.format(d);
}
