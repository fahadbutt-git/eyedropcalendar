import { addDays, daysBetween, lastDayIndex } from "./regimen.js";

export const DAY_INDEX_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// Date range the schedule must cover, and the calendar months it touches.
export function scheduleSpan(entries, monthsForOngoing, start) {
  const hasOngoing = entries.some((e) => e.mode === "ongoing");
  let lastIdx = 0;
  entries.forEach((e) => {
    const l = lastDayIndex(e);
    if (l != null) lastIdx = Math.max(lastIdx, l);
  });
  if (hasOngoing) {
    // Fill whole calendar months: end on the last day of the month, rolling to
    // the next month when the plan starts in the second half of a month.
    const extra = start.getDate() > 15 ? 0 : -1;
    const lastDay = new Date(start.getFullYear(), start.getMonth() + monthsForOngoing + extra + 1, 0);
    lastIdx = Math.max(lastIdx, daysBetween(start, lastDay));
  }
  const end = addDays(start, lastIdx);
  const months = [];
  let y = start.getFullYear();
  let m = start.getMonth();
  while (y < end.getFullYear() || (y === end.getFullYear() && m <= end.getMonth())) {
    months.push({ year: y, month: m });
    m++;
    if (m > 11) {
      m = 0;
      y++;
    }
  }
  return { days: lastIdx + 1, end, months, hasOngoing };
}
