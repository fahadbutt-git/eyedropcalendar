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
    // The link stays last, so it is still read whole if Oscar runs lines together.
    `Plan link (paste into Eye Drop Tracker to change this plan): ${link}`,
  ].join("\n");
}
