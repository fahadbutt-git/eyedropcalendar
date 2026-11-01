// Calendar file (RFC 5545) with an alarm at every dose time. Times are
// "floating", so they follow the phone's own time zone. Finite courses are
// written day by day. Ongoing drops become daily repeating events with no
// end date, so a glaucoma drop never silently stops.
import { EYES, dosesOnDay, lastDayIndex } from "./regimen.js";
import { doseGroups, doseMoment, reminderText } from "./doses.js";
import { daysBetween } from "./dates.js";

const pad = (n) => String(n).padStart(2, "0");
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

function event(lines, { uid, at, items, stamp, rrule, generic }) {
  const { title, body } = reminderText(items, EYES, generic);
  lines.push("BEGIN:VEVENT", `UID:${uid}@eyedroptracker.com`, `DTSTAMP:${stamp}`, `DTSTART:${local(at)}`);
  if (rrule) lines.push("RRULE:FREQ=DAILY");
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

export function buildICS({ entries, formulary, start, wake, bed, id = "plan", from = new Date(), generic = false }) {
  const stamp = utc(new Date());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Eye Drop Tracker//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Eye drops"];
  const first = Math.max(0, daysBetween(start, from));
  const ongoing = entries.filter((e) => lastDayIndex(e) == null);
  const dayByDayEnd = Math.max(-1, ...entries.map((e) => lastDayIndex(e) ?? -1));

  // Day by day while any finite course runs (ongoing drops included).
  for (let i = first; i <= dayByDayEnd; i++) {
    for (const { time, items } of doseGroups(entries, formulary, i, wake, bed))
      event(lines, { uid: `${id}-${i}-${time}`, at: doseMoment(start, i, time), items, stamp, generic });
  }
  // Then each ongoing drop repeats daily from its first remaining day.
  const repeatFrom = new Map();
  ongoing.forEach((e) => {
    let i = Math.max(first, dayByDayEnd + 1);
    while (!dosesOnDay(e, i)) i++;
    if (!repeatFrom.has(i)) repeatFrom.set(i, []);
    repeatFrom.get(i).push(e);
  });
  for (const [i, list] of repeatFrom) {
    for (const { time, items } of doseGroups(list, formulary, i, wake, bed))
      event(lines, { uid: `${id}-r${i}-${time}`, at: doseMoment(start, i, time), items, stamp, rrule: true, generic });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
