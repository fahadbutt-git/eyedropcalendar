// Calendar dates as local days, independent of time zone and daylight saving.

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
export const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function parseISO(s) {
  const [y, m, d] = String(s).split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function toISO(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function isValidISO(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(s))) return false;
  const d = parseISO(s);
  return toISO(d) === s;
}

export function addDays(date, n) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + n);
}

export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

// "Nov 4"
export const fmtShort = (d) => `${MONTHS[d.getMonth()].slice(0, 3)} ${d.getDate()}`;
// "November 4, 2026"
export const fmtLong = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
