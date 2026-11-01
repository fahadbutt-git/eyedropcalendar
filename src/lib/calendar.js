import { addDays, daysBetween } from "./dates.js";
import { lastDayIndex } from "./regimen.js";

// Days the schedule covers. Finite courses run to their last dose. Ongoing
// drops fill whole calendar months, rolling into the next month when the plan
// starts in the second half of a month.
export function scheduleSpan(entries, monthsForOngoing, start) {
  const hasOngoing = entries.some((e) => lastDayIndex(e) == null);
  let last = Math.max(0, ...entries.map((e) => lastDayIndex(e) ?? 0));
  if (hasOngoing) {
    const extra = start.getDate() > 15 ? 0 : -1;
    const monthEnd = new Date(start.getFullYear(), start.getMonth() + monthsForOngoing + extra + 1, 0);
    last = Math.max(last, daysBetween(start, monthEnd));
  }
  const end = addDays(start, last);
  const months = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  return { days: last + 1, end, months, hasOngoing };
}
