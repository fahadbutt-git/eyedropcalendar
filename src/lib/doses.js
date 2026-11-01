// Groups each day's doses by time, shared by the phone view, calendar alarms
// and app notifications.
import { addDays } from "./dates.js";
import { dosesOnDay } from "./regimen.js";
import { doseTimes } from "./times.js";

// [{ time, items: [{ entry, index, dose }] }] sorted by time. `dose` numbers a
// drug's doses on that day from 0, which identifies each tick box.
export function doseGroups(entries, formulary, dayIndex, wake, bed) {
  const byTime = new Map();
  entries.forEach((entry, index) => {
    const qhs = !!formulary.find((m) => m.brand === entry.brand)?.qhs;
    doseTimes(dosesOnDay(entry, dayIndex), wake, bed, qhs).forEach((time, dose) => {
      if (!byTime.has(time)) byTime.set(time, []);
      byTime.get(time).push({ entry, index, dose });
    });
  });
  return [...byTime].sort((a, b) => a[0] - b[0]).map(([time, items]) => ({ time, items }));
}

// Every dose time from `from` onward, up to `limit` reminders.
export function upcomingReminders(plan, from, limit) {
  const { entries, formulary, start, days, wake, bed } = plan;
  const out = [];
  for (let i = 0; i < days && out.length < limit; i++) {
    const date = addDays(start, i);
    for (const g of doseGroups(entries, formulary, i, wake, bed)) {
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, g.time);
      if (at > from && out.length < limit) out.push({ at, items: g.items });
    }
  }
  return out;
}

export const reminderText = (items, eyes) => ({
  title: items.length === 1 ? `Time for ${items[0].entry.brand}` : `Time for ${items.length} eye drops`,
  body:
    items.map(({ entry: e }) => `${e.brand}: ${e.drops} drop${e.drops > 1 ? "s" : ""}, ${eyes[e.eye].long}`).join("\n") +
    (items.length > 1 ? "\nWait 5 minutes between drops." : ""),
});
