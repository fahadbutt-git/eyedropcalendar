// Calendar file (RFC 5545) with an alarm at every dose time. Times are
// "floating", so they follow the phone's own time zone. Finite courses are
// written day by day. Ongoing drops become daily repeating events with no
// end date, so a glaucoma drop never silently stops.
import { EYES, dosesOnDay, lastDayIndex } from "./regimen.js";
import { doseGroups, doseMoment, reminderText } from "./doses.js";
import { daysBetween } from "./dates.js";

const pad = (n) => String(n).padStart(2, "0");
const RENEW_DAYS = 182;
const local = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const utc = (d) => d.toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
const esc = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");

// Lines are folded at 75 bytes without splitting a character.
function fold(line) {
  const enc = new TextEncoder();
  const out = [];
  let cur = "";
  let bytes = 0;
  for (const ch of Array.from(line)) {
    const n = enc.encode(ch).length;
    if (bytes + n > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = "";
      bytes = 0;
    }
    cur += ch;
    bytes += n;
  }
  out.push(cur);
  return out.join("\r\n ");
}

function event(lines, { uid, at, items, stamp, until, generic, text }) {
  const { title, body } = text || reminderText(items, EYES, generic);
  lines.push("BEGIN:VEVENT", `UID:${uid}@eyedroptracker.com`, `DTSTAMP:${stamp}`, `DTSTART:${local(at)}`);
  if (until) lines.push(`RRULE:FREQ=DAILY;UNTIL=${local(until)}`);
  lines.push(
    "DURATION:PT10M",
    fold(`SUMMARY:${esc(title)}`),
    fold(`DESCRIPTION:${esc(body)}`),
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    fold(`DESCRIPTION:${esc(title)}`),
    "TRIGGER:PT0M",
    "END:VALARM",
    "END:VEVENT"
  );
}

// Event IDs in a calendar file, so the next file can cancel any that the
// new plan no longer has.
export const eventIds = (ics) => [...ics.matchAll(/^UID:(.+)@eyedroptracker\.com\r?$/gm)].map((m) => m[1]);

export function buildICS({ entries, formulary, start, wake, bed, id = "plan", from = new Date(), generic = false, cancel = [] }) {
  const stamp = utc(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Eye Drop Tracker//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Eye drops"];
  // Start one day back, because a dose after midnight belongs to the day
  // before, then skip anything already past. Event IDs depend only on the plan
  // and the dose, so downloading the file again updates the same events.
  const first = Math.max(0, daysBetween(start, from) - 1);
  const ongoing = entries.filter((e) => lastDayIndex(e) == null);
  const dayByDayEnd = Math.max(-1, ...entries.map((e) => lastDayIndex(e) ?? -1));

  // Day by day while any finite course runs (ongoing drops included).
  for (let i = first; i <= dayByDayEnd; i++) {
    for (const { time, items } of doseGroups(entries, formulary, i, wake, bed)) {
      const at = doseMoment(start, i, time);
      if (at >= from) event(lines, { uid: `${id}-${i}-${time}`, at, items, stamp, generic });
    }
  }
  // Then each ongoing drop repeats daily from the day after the last course,
  // or from its own start. This does not depend on the download date.
  const repeatFrom = new Map();
  ongoing.forEach((e) => {
    let i = dayByDayEnd + 1;
    while (!dosesOnDay(e, i)) i++;
    if (!repeatFrom.has(i)) repeatFrom.set(i, []);
    repeatFrom.get(i).push(e);
  });
  // Repeating alarms run for six months from the download, then a final
  // alert asks the patient to add them again, so alarms from an old plan
  // cannot carry on for ever.
  const until = new Date(from.getFullYear(), from.getMonth(), from.getDate() + RENEW_DAYS, 23, 59);
  for (const [i, list] of repeatFrom) {
    for (const { time, items } of doseGroups(list, formulary, i, wake, bed))
      event(lines, { uid: `${id}-r${i}-${time}`, at: doseMoment(start, i, time), items, stamp, until, generic });
  }
  if (repeatFrom.size) {
    const renew = new Date(until.getFullYear(), until.getMonth(), until.getDate() - 7, 12, 0);
    event(lines, {
      uid: `${id}-renew`,
      at: renew,
      stamp,
      text: {
        title: "Renew your eye drop alarms",
        body: "Your drop alarms stop in one week. Open your plan from the clinic link and add the alarms again.",
      },
    });
  }
  // Alarms from the last file that this plan no longer has are cancelled.
  // Calendars that honour cancelled events remove them. The screen also
  // explains how to remove them by hand.
  for (const uid of cancel)
    lines.push("BEGIN:VEVENT", `UID:${uid}@eyedroptracker.com`, `DTSTAMP:${stamp}`, `DTSTART:${local(from)}`, "STATUS:CANCELLED", "SUMMARY:Cancelled eye drop alarm", "END:VEVENT");
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
