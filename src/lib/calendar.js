import { addDays, daysBetween } from "./dates.js";
import { lastDayIndex } from "./regimen.js";

// Days a printed schedule covers. Finite courses run to their last dose.
// Ongoing drops are printed for a whole number of calendar months from the
// start date, so "1 month" from Nov 15 runs to Dec 14.
export function scheduleSpan(entries, monthsForOngoing, start) {
  const hasOngoing = entries.some((e) => lastDayIndex(e) == null);
  let last = Math.max(0, ...entries.map((e) => lastDayIndex(e) ?? 0));
  if (hasOngoing) {
    const months = Math.min(3, Math.max(1, Math.round(Number(monthsForOngoing)) || 1));
    const lastOfTarget = new Date(start.getFullYear(), start.getMonth() + months + 1, 0).getDate();
    const same = new Date(start.getFullYear(), start.getMonth() + months, Math.min(start.getDate(), lastOfTarget));
    const end = addDays(same, -1);
    last = Math.max(last, daysBetween(start, end));
  }
  const end = addDays(start, last);
  const months = [];
  for (let d = new Date(start.getFullYear(), start.getMonth(), 1); d <= end; d = new Date(d.getFullYear(), d.getMonth() + 1, 1))
    months.push({ year: d.getFullYear(), month: d.getMonth() });
  return { days: last + 1, end, months, hasOngoing };
}

// Index of the last day with any dose, or null when a drop is ongoing. The
// phone view uses this: an ongoing glaucoma drop never "finishes".
export function courseLastDay(entries) {
  const ends = entries.map(lastDayIndex);
  return ends.some((e) => e == null) ? null : Math.max(0, ...ends);
}
