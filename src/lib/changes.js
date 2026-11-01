// Plain-language notes about when drops start, change or stop between two
// days of a plan. Shared by the printed daily chart and the phone view.
import { WEEKDAYS, addDays, fmtShort } from "./dates.js";
import { dosesOnDay, lastDayIndex } from "./regimen.js";

const timesADay = (n) => (n === 1 ? "once a day" : `${n} times a day`);
export const dayName = (d) => `${WEEKDAYS[d.getDay()]} ${fmtShort(d)}`;

export function changeNotes(entries, start, first, last, { thisWeek = true } = {}) {
  const notes = [];
  entries.forEach((e) => {
    for (let i = first; i <= last; i++) {
      const n = dosesOnDay(e, i);
      const prev = i > 0 ? dosesOnDay(e, i - 1) : 0;
      const when = dayName(addDays(start, i));
      // The last dose is noted in the week it happens, not the week after.
      if (n && !dosesOnDay(e, i + 1) && lastDayIndex(e) === i) notes.push(`${e.brand}: last dose ${when}`);
      if (n === prev || !n || (i === 0 && !prev && i === first)) continue;
      if (!prev) notes.push(`${e.brand} starts ${when}`);
      else if (i === first && thisWeek) notes.push(`${e.brand} ${timesADay(n)} this week`);
      else notes.push(`From ${when}: ${e.brand} ${timesADay(n)}`);
    }
  });
  return notes;
}
