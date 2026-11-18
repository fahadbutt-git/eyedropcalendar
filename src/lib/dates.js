// Calendar dates as local days, independent of time zone and daylight saving.
// Dates are stored as "YYYY-MM-DD" strings and handled as local midnight.

// Every date is written in Canadian and US English the same way, whatever the
// browser's language, so a printed calendar always matches its prescription.
const format = (options) => new Intl.DateTimeFormat("en-US", options).format;

export function parseISO(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export const todayISO = () => toISO(new Date());

export function isValidISO(s) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(s)) && toISO(parseISO(s)) === s;
}

export const addDays = (date, n) => new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);

export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

// "Sun", the column headings of a calendar week.
export const fmtWeekday = format({ weekday: "short" });
export const WEEKDAYS = Array.from({ length: 7 }, (_, i) => fmtWeekday(new Date(2026, 0, 4 + i)));
// "November 2026"
export const fmtMonth = format({ month: "long", year: "numeric" });
// "Nov 4"
export const fmtShort = format({ month: "short", day: "numeric" });
// "Nov 4, 2026"
export const fmtMedium = format({ month: "short", day: "numeric", year: "numeric" });
// "November 4, 2026"
export const fmtLong = format({ month: "long", day: "numeric", year: "numeric" });
// "Nov 4 to Nov 17, 2026"
export const fmtRange = (a, b) => `${fmtShort(a)} to ${fmtMedium(b)}`;
