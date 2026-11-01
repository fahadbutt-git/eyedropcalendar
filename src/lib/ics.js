// Builds an .ics calendar file with a reminder for every dose time.
// Drops due at the same time are grouped into one reminder.
import { addDays, dosesOnDay, doseTimes, EYES, fmtTime } from "./regimen.js";

const pad = (n) => String(n).padStart(2, "0");
const stamp = (date, min) =>
  `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(
    Math.floor(min / 60) % 24
  )}${pad(min % 60)}00`;
const esc = (s) => s.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");

// Fold long lines per RFC 5545
const fold = (line) => {
  const out = [];
  let s = line;
  while (s.length > 74) {
    out.push(s.slice(0, 74));
    s = " " + s.slice(74);
  }
  out.push(s);
  return out.join("\r\n");
};

export function buildICS({ entries, formulary, start, days, wake, bed }) {
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Eye Drop Tracker//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Eye drops",
  ];
  const now = new Date();
  const dtstamp = stamp(now, now.getHours() * 60 + now.getMinutes()) + "";
  let uid = 0;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);
    const byTime = new Map();
    entries.forEach((e) => {
      const n = dosesOnDay(e, i);
      if (!n) return;
      const qhs = !!formulary.find((m) => m.brand === e.brand)?.qhs;
      doseTimes(n, wake, bed, qhs).forEach((t) => {
        if (!byTime.has(t)) byTime.set(t, []);
        byTime.get(t).push(e);
      });
    });
    [...byTime.entries()]
      .sort((a, b) => a[0] - b[0])
      .forEach(([t, list]) => {
        const items = list.map(
          (e) => `${e.brand}, ${e.drops} drop${e.drops > 1 ? "s" : ""}, ${EYES[e.eye].long}`
        );
        const summary =
          list.length === 1 ? `Eye drop: ${list[0].brand}` : `Eye drops (${list.length}): ${list.map((e) => e.brand).join(", ")}`;
        const desc =
          `${fmtTime(t)}\n` +
          items.join("\n") +
          (list.length > 1 ? "\n\nWait 5 minutes between different drops." : "");
        lines.push(
          "BEGIN:VEVENT",
          `UID:edt-${toKey(date)}-${t}-${uid++}@eyedroptracker`,
          `DTSTAMP:${dtstamp}`,
          `DTSTART:${stamp(date, t)}`,
          `DTEND:${stamp(date, t + 10)}`,
          fold(`SUMMARY:${esc(summary)}`),
          fold(`DESCRIPTION:${esc(desc)}`),
          "BEGIN:VALARM",
          "ACTION:DISPLAY",
          fold(`DESCRIPTION:${esc(summary)}`),
          "TRIGGER:PT0M",
          "END:VALARM",
          "END:VEVENT"
        );
      });
  }
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

const toKey = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;

export function downloadFile(name, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
