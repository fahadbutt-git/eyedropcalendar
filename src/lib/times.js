// Suggested dose times, in minutes after midnight.

const toMinutes = (hhmm) => {
  const [h, m] = String(hhmm).split(":").map(Number);
  return h * 60 + m;
};

export function fmtTime(min) {
  const h24 = Math.floor(min / 60) % 24;
  const h12 = h24 % 12 || 12;
  return `${h12}:${String(min % 60).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

// Doses are spaced evenly over at most 12 waking hours, so twice a day is
// 8 AM and 8 PM and four times a day is 8 AM, 12 PM, 4 PM and 8 PM.
// A once-daily bedtime drop goes at bedtime.
export function doseTimes(n, wake = "08:00", bed = "22:00", qhs = false) {
  if (n <= 0) return [];
  const w = toMinutes(wake);
  let b = toMinutes(bed);
  if (b <= w) b += 24 * 60;
  if (n === 1) return [qhs ? b : w];
  const step = Math.min(12 * 60, b - w) / (n - 1);
  const unit = n > 4 ? 15 : 30;
  return Array.from({ length: n }, (_, i) => Math.round((w + i * step) / unit) * unit);
}
