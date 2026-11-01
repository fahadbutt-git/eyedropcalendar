// Suggested dose times, in minutes after midnight of the dose day. A time of
// 1440 or more falls after midnight, on the next calendar date.

export const isClockTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

export function fmtTime(min) {
  const h24 = Math.floor(min / 60) % 24;
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(min % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

const MIN_DAY = 6 * 60;
const MAX_SPREAD = 12 * 60;

// Doses are spaced evenly over at most 12 waking hours, so twice a day is
// 8 AM and 8 PM and four times a day is 8 AM, 12 PM, 4 PM and 8 PM. A once
// daily bedtime drop goes at bedtime. A waking day shorter than 6 hours is
// treated as 6 hours, so two doses never land at the same time.
export function doseTimes(n, wake = "08:00", bed = "22:00", qhs = false) {
  if (n <= 0) return [];
  const w = toMinutes(isClockTime(wake) ? wake : "08:00");
  let b = toMinutes(isClockTime(bed) ? bed : "22:00");
  if (b <= w) b += 24 * 60;
  if (n === 1) return [qhs ? b : w];
  const step = Math.min(MAX_SPREAD, Math.max(MIN_DAY, b - w)) / (n - 1);
  const unit = n > 4 ? 15 : 30;
  return Array.from({ length: n }, (_, i) => Math.round((w + i * step) / unit) * unit);
}
