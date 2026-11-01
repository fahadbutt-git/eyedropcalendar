// Pure scheduling logic: how many doses a regimen calls for on a given day,
// plain-language instructions, dose times, and safety checks.

export const FREQ_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
export const DROP_OPTIONS = [1, 2, 3];
export const EYES = {
  OD: { short: "OD", long: "right eye" },
  OS: { short: "OS", long: "left eye" },
  OU: { short: "OU", long: "both eyes" },
};

const FREQ_WORDS = {
  1: "once daily",
  2: "twice daily",
  3: "3 times daily",
  4: "4 times daily",
  5: "5 times daily",
  6: "6 times daily",
  8: "8 times daily",
};
export const freqWords = (n) => FREQ_WORDS[n] || `${n} times daily`;
export const freqAbbrev = (n) => ({ 1: "daily", 2: "BID", 3: "TID", 4: "QID" }[n] || `${n}x/day`);

// ── Dates (local, timezone safe) ────────────────────────────────────────────
export function parseISO(s) {
  const [y, m, dd] = s.split("-").map(Number);
  return new Date(y, m - 1, dd);
}
export function toISO(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
export function addDays(date, n) {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + n);
  return x;
}
export function daysBetween(a, b) {
  const ua = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const ub = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((ub - ua) / 86400000);
}

// ── Regimen model ───────────────────────────────────────────────────────────
// mode: "ongoing" | "duration" | "taper"
export function newSlot() {
  return {
    brand: "",
    freq: 2,
    drops: 1,
    mode: "ongoing",
    durationDays: 7,
    startDay: 1,
    steps: [],
  };
}

export function weeklyTaperFrom(freq, daysPerStep = 7) {
  const steps = [];
  for (let f = freq; f >= 1; f--) steps.push({ freq: f, days: daysPerStep });
  return steps;
}

export const TAPER_PRESETS = [
  { label: "Weekly, from current frequency", build: (f) => weeklyTaperFrom(Math.max(f, 2), 7) },
  { label: "4 weeks: QID, TID, BID, daily", build: () => weeklyTaperFrom(4, 7) },
  { label: "2 weeks: QID x4d, TID x4d, BID x3d, daily x3d", build: () => [
      { freq: 4, days: 4 }, { freq: 3, days: 4 }, { freq: 2, days: 3 }, { freq: 1, days: 3 },
    ] },
  { label: "Durezol: QID x14d, BID x14d", build: () => [{ freq: 4, days: 14 }, { freq: 2, days: 14 }] },
];

// Number of doses on day `dayIndex` (0 = schedule start date).
export function dosesOnDay(slot, dayIndex) {
  const d = dayIndex - (Math.max(1, slot.startDay || 1) - 1);
  if (d < 0) return 0;
  if (slot.mode === "duration") return d < slot.durationDays ? slot.freq : 0;
  if (slot.mode === "taper") {
    let acc = 0;
    for (const s of slot.steps) {
      acc += s.days;
      if (d < acc) return s.freq;
    }
    return 0;
  }
  return slot.freq;
}

// Last day index (inclusive) with doses, or null when ongoing.
export function lastDayIndex(slot) {
  const offset = Math.max(1, slot.startDay || 1) - 1;
  if (slot.mode === "duration") return offset + slot.durationDays - 1;
  if (slot.mode === "taper") return offset + slot.steps.reduce((a, s) => a + s.days, 0) - 1;
  return null;
}

export function totalDays(slot) {
  if (slot.mode === "duration") return slot.durationDays;
  if (slot.mode === "taper") return slot.steps.reduce((a, s) => a + s.days, 0);
  return null;
}

// Plain-language instruction (also used as the Rx sig).
export function sigText(slot, eye, qhs = false) {
  const drops = `${slot.drops} drop${slot.drops > 1 ? "s" : ""}`;
  const where = `in ${eye === "OU" ? "" : "the "}${EYES[eye].long} (${EYES[eye].short})`;
  const start = slot.startDay > 1 ? `Starting on day ${slot.startDay}, instill` : "Instill";
  if (slot.mode === "taper" && slot.steps.length) {
    const parts = slot.steps.map((s) => `${freqWords(s.freq)} for ${s.days} day${s.days > 1 ? "s" : ""}`);
    return `${start} ${drops} ${where} ${parts.join(", then ")}, then stop.`;
  }
  if (slot.mode === "duration") {
    const when = qhs && slot.freq === 1 ? "once daily at bedtime" : freqWords(slot.freq);
    return `${start} ${drops} ${where} ${when} for ${slot.durationDays} day${slot.durationDays > 1 ? "s" : ""}, then stop.`;
  }
  const when = qhs && slot.freq === 1 ? "once daily at bedtime" : freqWords(slot.freq);
  return `${start} ${drops} ${where} ${when}.`;
}

// Short plan used in calendar legends.
export function planShort(slot) {
  if (slot.mode === "taper" && slot.steps.length)
    return slot.steps.map((s) => `${freqAbbrev(s.freq)} x${s.days}d`).join(" → ");
  if (slot.mode === "duration") return `${freqAbbrev(slot.freq)} x${slot.durationDays}d`;
  return freqAbbrev(slot.freq);
}

// Merge identical regimens in both eyes into one OU entry.
const planKey = (s) =>
  JSON.stringify([s.brand, s.freq, s.drops, s.mode, s.durationDays, s.startDay, s.steps]);

export function mergeEyes(right, left) {
  const out = [];
  const usedLeft = new Set();
  right.filter((s) => s.brand).forEach((s) => {
    const li = left.findIndex((l, i) => !usedLeft.has(i) && l.brand && planKey(l) === planKey(s));
    if (li >= 0) {
      usedLeft.add(li);
      out.push({ ...s, eye: "OU" });
    } else out.push({ ...s, eye: "OD" });
  });
  left.forEach((l, i) => {
    if (l.brand && !usedLeft.has(i)) out.push({ ...l, eye: "OS" });
  });
  return out;
}

// ── Dose times ──────────────────────────────────────────────────────────────
const toMin = (hhmm) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export function fmtTime(min) {
  const h24 = Math.floor(min / 60) % 24;
  const m = min % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${String(m).padStart(2, "0")} ${h24 < 12 ? "AM" : "PM"}`;
}

// Evenly spaced dose times (minutes after midnight) within waking hours.
export function doseTimes(n, wake = "08:00", bed = "22:00", qhs = false) {
  const w = toMin(wake);
  let b = toMin(bed);
  if (b <= w) b += 24 * 60;
  if (n <= 0) return [];
  if (n === 1) return [qhs ? b : w];
  // Spread doses over at most 12 waking hours (8 AM, 12 PM, 4 PM, 8 PM for QID)
  const step = Math.min(12 * 60, b - w) / (n - 1);
  return Array.from({ length: n }, (_, i) => Math.round((w + i * step) / 30) * 30);
}

// ── Safety checks ───────────────────────────────────────────────────────────
// Returns warnings for duplicate drugs or duplicate drug classes in one eye.
export function regimenWarnings(slots, formulary, eyeLabel, classNames) {
  const warnings = [];
  const active = slots.filter((s) => s.brand);
  const seenBrand = {};
  active.forEach((s) => {
    if (seenBrand[s.brand]) warnings.push(`${s.brand} is listed twice for the ${eyeLabel}.`);
    seenBrand[s.brand] = true;
  });
  const byClass = {};
  active.forEach((s) => {
    const med = formulary.find((m) => m.brand === s.brand);
    (med?.cls || []).forEach((c) => {
      if (c === "OTHER" || c === "LUB") return;
      (byClass[c] ||= new Set()).add(s.brand);
    });
  });
  Object.entries(byClass).forEach(([c, set]) => {
    if (set.size > 1)
      warnings.push(
        `${[...set].join(" and ")} both contain a ${(classNames[c] || c).toLowerCase()} (${eyeLabel}).`
      );
  });
  return warnings;
}
