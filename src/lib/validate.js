// Checks data that comes from outside the app (a phone link, an imported
// formulary file, browser storage) before it is used. Anything malformed is
// rejected or brought into range, so a bad file or link cannot break a page or
// produce an unsafe schedule.
import { CAP_COLOURS, DRUG_CLASSES } from "../data/formulary.js";
import { DROP_OPTIONS, FREQ_OPTIONS } from "./regimen.js";

const text = (v, max = 120) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const intIn = (v, min, max, fallback) => (Number.isInteger(v) && v >= min && v <= max ? v : fallback);

export function cleanMed(m, id) {
  if (!m || typeof m !== "object") return null;
  const brand = text(m.brand, 60);
  if (!brand) return null;
  return {
    id,
    brand,
    generic: text(m.generic),
    cls: Array.isArray(m.cls) ? m.cls.filter((c) => c in DRUG_CLASSES).slice(0, 4) : [],
    freq: oneOf(m.freq, FREQ_OPTIONS, 2),
    drops: oneOf(m.drops, DROP_OPTIONS, 1),
    lu: text(m.lu, 12),
    cap: oneOf(m.cap, Object.keys(CAP_COLOURS), ""),
    form: oneOf(m.form, ["solution", "suspension", "gel"], "solution"),
    qhs: m.qhs === true,
  };
}

// Returns a clean list, or null when the input is not a formulary at all.
export function cleanFormulary(list) {
  if (!Array.isArray(list) || list.length > 500) return null;
  const seen = new Set();
  const out = [];
  for (const m of list) {
    const clean = cleanMed(m, out.length + 1);
    if (clean && !seen.has(clean.brand.toLowerCase())) {
      seen.add(clean.brand.toLowerCase());
      out.push(clean);
    }
  }
  return out.length ? out : null;
}

const MAX_DAYS = 365;

export function cleanEntry(e) {
  const mode = oneOf(e.mode, ["ongoing", "duration", "taper"], null);
  const steps = Array.isArray(e.steps)
    ? e.steps.slice(0, 10).map((s) => ({ freq: oneOf(s?.freq, FREQ_OPTIONS, null), days: intIn(s?.days, 1, MAX_DAYS, null) }))
    : [];
  if (!text(e.brand, 60) || !mode || !["OD", "OS", "OU"].includes(e.eye)) return null;
  if (steps.some((s) => s.freq == null || s.days == null)) return null;
  return {
    brand: text(e.brand, 60),
    eye: e.eye,
    drops: oneOf(e.drops, DROP_OPTIONS, 1),
    mode,
    freq: oneOf(e.freq, FREQ_OPTIONS, 1),
    durationDays: intIn(e.durationDays, 1, MAX_DAYS, 7),
    startDay: intIn(e.startDay, 1, MAX_DAYS, 1),
    steps: mode === "taper" ? steps : [],
  };
}

export const isClockTime = (s) => /^([01]\d|2[0-3]):[0-5]\d$/.test(String(s));
