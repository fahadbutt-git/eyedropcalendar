// Calendar file (RFC 5545) with an alarm at every dose time. Times are
// "floating", so they follow the phone's own time zone.
import { addDays } from "./dates.js";
import { EYES } from "./regimen.js";
import { doseGroups, reminderText } from "./doses.js";

const pad = (n) => String(n).padStart(2, "0");
const stamp = (d, min = 0) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T${pad(Math.floor(min / 60) % 24)}${pad(min % 60)}00`;
const esc = (s) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
const fold = (line) => line.match(/.{1,74}/g).join("\r\n ");

export function buildICS({ entries, formulary, start, days, wake, bed }) {
  const now = new Date();
  const created = stamp(now, now.getHours() * 60 + now.getMinutes());
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Eye Drop Tracker//EN", "CALSCALE:GREGORIAN", "X-WR-CALNAME:Eye drops"];
  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    for (const { time, items } of doseGroups(entries, formulary, i, wake, bed)) {
      const { title, body } = reminderText(items, EYES);
      lines.push(
        "BEGIN:VEVENT",
        `UID:${stamp(date, time)}-${i}@eyedroptracker.com`,
        `DTSTAMP:${created}`,
        `DTSTART:${stamp(date, time)}`,
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
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
