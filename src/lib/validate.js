// Checks data that comes from outside the app (a phone link, an imported
// formulary file, browser storage) before it is used. A phone link is
// rejected outright if any value is out of range, so a damaged or altered
// link can never show a different regimen. Stored data is repaired instead.
import { CAP_COLOURS, DRUG_CLASSES, FORMS } from "../data/formulary.js";
import { DROP_OPTIONS, FREQ_OPTIONS } from "./regimen.js";
import { isClockTime } from "./times.js";

export { isClockTime };
export const MAX_DROPS = 12;
const MAX_DAYS = 365;

// Text is trimmed, limited in length, and stripped of control and invisible
// formatting characters (such as right-to-left overrides).
const text = (v, max = 120) =>
  typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, max) : "";
const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const intIn = (v, min, max, fallback) => (Number.isInteger(v) && v >= min && v <= max ? v : fallback);
const has = (obj, key) => typeof key === "string" && Object.hasOwn(obj, key);

// LU codes are three digit Ontario Drug Benefit codes. Older formulary files
// stored one code as a string.
const cleanLU = (v) =>
  [...new Set((Array.isArray(v) ? v : [v]).map((c) => text(String(c ?? ""), 4)).filter((c) => /^\d{3}$/.test(c)))].slice(0, 6);

export function cleanMed(m, id) {
  if (!m || typeof m !== "object") return null;
  const brand = text(m.brand, 60);
  if (!brand) return null;
  return {
    id,
    brand,
    generic: text(m.generic),
    cls: Array.isArray(m.cls) ? m.cls.filter((c) => has(DRUG_CLASSES, c)).slice(0, 4) : [],
    freq: oneOf(m.freq, FREQ_OPTIONS, 2),
    drops: oneOf(m.drops, DROP_OPTIONS, 1),
    lu: cleanLU(m.lu),
    cap: has(CAP_COLOURS, m.cap) ? m.cap : "",
    form: oneOf(m.form, FORMS, "solution"),
    qhs: m.qhs === true,
    maxFreq: FREQ_OPTIONS.includes(m.maxFreq) ? m.maxFreq : null,
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

// With `strict`, any out-of-range value rejects the whole entry (phone links).
// Without it, values are brought back into range (the clinician's own tab).
export function cleanEntry(e, { strict = false } = {}) {
  if (!e || typeof e !== "object") return null;
  const pick = (ok, v, fallback) => (ok ? v : strict ? undefined : fallback);
  const mode = oneOf(e.mode, ["ongoing", "duration", "taper"], null);
  const brand = text(e.brand, 60);
  if (!brand || !mode || !["OD", "OS", "OU"].includes(e.eye)) return null;
  const steps = Array.isArray(e.steps)
    ? e.steps.slice(0, 10).map((s) => ({ freq: oneOf(s?.freq, FREQ_OPTIONS, null), days: intIn(s?.days, 1, MAX_DAYS, null) }))
    : [];
  if (mode === "taper" && steps.some((s) => s.freq == null || s.days == null)) return null;
  if (strict && mode === "taper" && !steps.length) return null;
  if (steps.reduce((n, s) => n + (s.days || 0), 0) > MAX_DAYS) return null;
  const out = {
    brand,
    eye: e.eye,
    drops: pick(DROP_OPTIONS.includes(e.drops), e.drops, 1),
    mode,
    freq: pick(FREQ_OPTIONS.includes(e.freq), e.freq, 1),
    durationDays: pick(intIn(e.durationDays, 1, MAX_DAYS, null) != null, e.durationDays, 7),
    startDay: pick(intIn(e.startDay, 1, MAX_DAYS, null) != null, e.startDay, 1),
    steps: mode === "taper" ? steps : [],
  };
  return Object.values(out).includes(undefined) ? null : out;
}
