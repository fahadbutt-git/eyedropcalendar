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

// The dose day the patient is living in. A dose day starts 6 hours before
// its first dose, so a 12:30 AM bedtime dose or a night shift's 8 AM dose
// still belongs to the day it was planned on.
const LEAD = 6 * 60;
const wakeMinutes = (wake) => {
  const [h, m] = String(wake || "08:00").split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
};
export function doseDayIndex(start, now, wake) {
  const shifted = new Date(now.getTime() - (wakeMinutes(wake) - LEAD) * 60000);
  const a = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const b = new Date(shifted.getFullYear(), shifted.getMonth(), shifted.getDate());
  return Math.round((b - a) / 864e5);
}
// Minutes since midnight of that dose day's date (can pass 1440).
export const minutesInto = (start, dayIndex, now) => Math.round((now - doseMoment(start, dayIndex, 0)) / 60000);

// The dose to put in front of the patient. A dose is due from its time on.
// When a later dose of the same drug is already due, the earlier one is
// missed and is not prompted, so two doses are never offered back to back.
// Doses more than an hour away are shown as "next" without a button.
export const SOON = 60;
export function nextDose(items, isDone, minutes) {
  const missed = new Set();
  for (const it of items) {
    if (isDone(it) || it.time > minutes) continue;
    const later = items.some((o) => o.entry === it.entry && o.time > it.time && o.time <= minutes);
    if (later) missed.add(it);
  }
  const open = items.filter((it) => !isDone(it) && !missed.has(it));
  const due = open.find((it) => it.time <= minutes);
  if (due) return { item: due, state: "due", missed };
  const soon = open.find((it) => it.time <= minutes + SOON);
  if (soon) return { item: soon, state: "soon", missed };
  return { item: open[0] || null, state: open[0] ? "later" : "none", missed };
}
