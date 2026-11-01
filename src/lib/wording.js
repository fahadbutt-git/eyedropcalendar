// Instructions in words: the prescription sig (clinical wording) and the
// patient's version (plain language). Eyes are always written out in full.
import { addDays, fmtShort } from "./dates.js";
import { EYES, modeOf } from "./regimen.js";

const DAILY = { 1: "once daily", 2: "twice daily" };
const freqDaily = (n) => DAILY[n] || `${n} times daily`;
const freqADay = (n) => freqDaily(n).replace(" daily", " a day");
export const freqAbbrev = (n) => ({ 1: "daily", 2: "BID", 3: "TID", 4: "QID" })[n] || `${n}x/day`;

const plural = (n, word) => `${n} ${word}${n === 1 ? "" : "s"}`;

// Bedtime wording applies to a once-daily drop that is not part of a taper,
// which matches when the calendar, alarms and phone place it at bedtime.
export const atBedtime = (d, qhs) => !!qhs && modeOf(d) !== "taper" && d.freq === 1;

function plan(d, qhs, perDay, bedtime) {
  const mode = modeOf(d);
  if (mode === "taper")
    return d.steps.map((s) => `${perDay(s.freq)} for ${plural(s.days, "day")}`).join(", then ") + ", then stop";
  const base = atBedtime(d, qhs) ? bedtime : perDay(d.freq);
  return mode === "duration" ? `${base} for ${plural(d.durationDays, "day")}, then stop` : base;
}

const startDateOf = (d, startDate) => (d.startDay > 1 && startDate ? addDays(startDate, d.startDay - 1) : null);

function startPhrase(d, startDate, withYear) {
  if (!(d.startDay > 1)) return "";
  const date = startDateOf(d, startDate);
  if (!date) return `Starting on day ${d.startDay}`;
  return `Starting ${fmtShort(date)}${withYear ? `, ${date.getFullYear()}` : ""}`;
}

const where = (eye) => (eye === "OU" ? "both eyes" : `the ${EYES[eye].long}`);

// "Instill 1 drop in the left eye 4 times daily for 7 days, then stop."
export function sigText(d, qhs = false, startDate = null) {
  const start = startPhrase(d, startDate, true);
  const verb = start ? `${start}, instill` : "Instill";
  return `${verb} ${plural(d.drops, "drop")} in ${where(d.eye)} ${plan(d, qhs, freqDaily, "once daily at bedtime")}.`;
}

// "4 times a day for 7 days, then stop"
export const patientPlanText = (d, qhs = false) => plan(d, qhs, freqADay, "once a day at bedtime");

// "Starting Nov 4: 1 drop in the left eye, twice a day."
export function patientInstruction(d, qhs = false, startDate = null) {
  const start = startPhrase(d, startDate, false);
  return `${start ? `${start}: ` : ""}${plural(d.drops, "drop")} in ${where(d.eye)}, ${patientPlanText(d, qhs)}.`;
}

// "starting Nov 4", for use mid-sentence.
export const patientStartText = (d, startDate) => {
  const s = startPhrase(d, startDate, false);
  return s && s[0].toLowerCase() + s.slice(1);
};
