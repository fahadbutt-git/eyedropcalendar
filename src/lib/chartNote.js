// Plain text for the clinic's chart note: the plan in prescription wording
// and the patient's plan link, so it can be reopened at the next visit.
import { addDays, fmtLong, parseISO } from "./dates.js";
import { lastDayIndex } from "./regimen.js";
import { fmtTime } from "./times.js";
import { sigText } from "./wording.js";
import { TERMS_VERSION } from "../config.js";

const minutes = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};

export function chartNote({ entries, formulary, start, wake, bed, link }) {
  const startDate = parseISO(start);
  const lines = entries.map((e, i) => {
    const med = formulary.find((m) => m.brand === e.brand);
    const name = med?.generic ? `${e.brand} (${med.generic})` : e.brand;
    return `${i + 1}. ${name}: ${sigText(e, !!med?.qhs, startDate)}`;
  });
  const ends = entries.map(lastDayIndex);
  const end = ends.includes(null) ? "" : ` to ${fmtLong(addDays(startDate, Math.max(...ends)))}`;
  return [
    `Eye drop plan, ${fmtLong(startDate)}${end}`,
    ...lines,
    `Dose times spread from ${fmtTime(minutes(wake))} to ${fmtTime(minutes(bed))}.`,
    `Prepared with Eye Drop Tracker under its clinic terms of ${TERMS_VERSION}.`,
    // Oscar does not wrap a long unbroken line, so a link of several hundred
    // characters would widen the whole encounter page. The link is written in
    // short lines, which every reader joins again, and ends with a bracket so
    // text written after it is never read as part of it.
    `Plan link (paste all of it into Eye Drop Tracker to change this plan):`,
    ...String(link).match(/.{1,64}/g),
    `(end of plan link)`,
  ].join("\n");
}
