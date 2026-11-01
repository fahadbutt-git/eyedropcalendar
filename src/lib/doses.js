// Groups each day's doses by time, shared by the phone view, printed charts,
// calendar alarms and app notifications, so they always agree.
import { addDays } from "./dates.js";
import { dosesOnDay, modeOf } from "./regimen.js";
import { doseTimes } from "./times.js";

// Drops given together go in this order: solutions, then suspensions and
// emulsions, then gels, which need 10 minutes before anything else.
const ORDER = { solution: 0, suspension: 1, emulsion: 1, gel: 2 };

export const medOf = (formulary, entry) => formulary.find((m) => m.brand === entry.brand);
const bedtimeDrop = (entry, med) => !!med?.qhs && modeOf(entry) !== "taper";

// [{ time, items: [{ entry, index, dose, med }] }] sorted by time. `dose`
// numbers a drug's doses on that day from 0, which identifies each tick box.
export function doseGroups(entries, formulary, dayIndex, wake, bed) {
  const byTime = new Map();
  entries.forEach((entry, index) => {
    const med = medOf(formulary, entry);
    doseTimes(dosesOnDay(entry, dayIndex), wake, bed, bedtimeDrop(entry, med)).forEach((time, dose) => {
      if (!byTime.has(time)) byTime.set(time, []);
      byTime.get(time).push({ entry, index, dose, med });
    });
  });
  return [...byTime]
    .sort((a, b) => a[0] - b[0])
    .map(([time, items]) => ({
      time,
      items: items.sort((a, b) => (ORDER[a.med?.form] ?? 0) - (ORDER[b.med?.form] ?? 0) || a.index - b.index),
    }));
}

// The moment a dose is due. Times past midnight land on the next date.
export const doseMoment = (start, dayIndex, time) => {
  const d = addDays(start, dayIndex);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, time);
};

// Every dose time after `from`, up to `limit` reminders.
export function upcomingReminders(plan, from, limit) {
  const { entries, formulary, start, days, wake, bed } = plan;
  const out = [];
  const first = Math.max(0, Math.floor((from - start) / 864e5) - 1);
  for (let i = first; i < days && out.length < limit; i++) {
    for (const g of doseGroups(entries, formulary, i, wake, bed)) {
      const at = doseMoment(start, i, g.time);
      if (at > from && out.length < limit) out.push({ at, items: g.items });
    }
  }
  return out;
}

const ADVICE = { suspension: "Shake first.", gel: "Use it last, 10 minutes after other drops." };

// Notification text. `generic` hides drug names on the lock screen.
export const reminderText = (items, eyes, generic = false) => {
  if (generic) return { title: "Eye drop reminder", body: "Open Eye Drop Tracker to see which drops are due." };
  return {
    title: items.length === 1 ? `Time for ${items[0].entry.brand}` : `Time for ${items.length} eye drops`,
    body:
      items
        .map(({ entry: e, med }) =>
          [`${e.brand}: ${e.drops} drop${e.drops > 1 ? "s" : ""}, ${eyes[e.eye].long}.`, ADVICE[med?.form]].filter(Boolean).join(" ")
        )
        .join("\n") + (items.length > 1 ? "\nWait 5 minutes between drops, in this order." : ""),
  };
};
