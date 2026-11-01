// The drop model and how many doses each drop needs on a given day.
//
// A drop: { id, brand, eye: "OD" | "OS" | "OU", freq, drops,
//           mode: "ongoing" | "duration" | "taper", durationDays, startDay, steps }
// Day indexes count from 0 on the schedule start date. startDay is 1-based.

export const FREQ_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
export const DROP_OPTIONS = [1, 2, 3];
export const EYES = {
  OD: { short: "OD", long: "right eye" },
  OS: { short: "OS", long: "left eye" },
  OU: { short: "OU", long: "both eyes" },
};

let counter = 0;
export function newSlot(eye = "OU") {
  counter += 1;
  return {
    id: `d${Date.now().toString(36)}${counter}`,
    brand: "",
    eye,
    freq: 2,
    drops: 1,
    mode: "ongoing",
    durationDays: 7,
    startDay: 1,
    steps: [],
  };
}

const weekly = (from) => Array.from({ length: from }, (_, i) => ({ freq: from - i, days: 7 }));

export const TAPER_PRESETS = [
  { label: "Weekly, from current frequency", build: (f) => weekly(Math.max(f, 2)) },
  { label: "4 weeks: QID, TID, BID, daily", build: () => weekly(4) },
  {
    label: "2 weeks: QID x4d, TID x4d, BID x3d, daily x3d",
    build: () => [
      { freq: 4, days: 4 },
      { freq: 3, days: 4 },
      { freq: 2, days: 3 },
      { freq: 1, days: 3 },
    ],
  },
  { label: "Durezol: QID x14d, BID x14d", build: () => [{ freq: 4, days: 14 }, { freq: 2, days: 14 }] },
];

// A taper with no steps yet behaves as ongoing.
export const modeOf = (d) => (d.mode === "taper" && !d.steps?.length ? "ongoing" : d.mode);
const offsetOf = (d) => Math.max(1, d.startDay || 1) - 1;
const taperDays = (d) => d.steps.reduce((sum, s) => sum + s.days, 0);

export function dosesOnDay(d, dayIndex) {
  const day = dayIndex - offsetOf(d);
  if (day < 0) return 0;
  const mode = modeOf(d);
  if (mode === "duration") return day < d.durationDays ? d.freq : 0;
  if (mode === "taper") {
    let end = 0;
    for (const s of d.steps) {
      end += s.days;
      if (day < end) return s.freq;
    }
    return 0;
  }
  return d.freq;
}

// Length of the course in days, or null when ongoing.
export function totalDays(d) {
  const mode = modeOf(d);
  if (mode === "duration") return d.durationDays;
  if (mode === "taper") return taperDays(d);
  return null;
}

// Last day index with doses, or null when ongoing.
export function lastDayIndex(d) {
  const total = totalDays(d);
  return total == null ? null : offsetOf(d) + total - 1;
}

// Turns the drop list into schedule entries. A right eye and a left eye drop
// with the same drug and plan are shown once, as both eyes.
const planKey = (d) =>
  JSON.stringify([d.brand, d.freq, d.drops, modeOf(d), d.durationDays, d.startDay, modeOf(d) === "taper" ? d.steps : []]);

export function toEntries(drops) {
  const list = drops.filter((d) => d.brand).map((d) => ({ ...d, mode: modeOf(d) }));
  const lefts = list.filter((d) => d.eye === "OS");
  const used = new Set();
  const out = [];
  list
    .filter((d) => d.eye !== "OS")
    .forEach((d) => {
      const match = d.eye === "OD" ? lefts.findIndex((l, i) => !used.has(i) && planKey(l) === planKey(d)) : -1;
      if (match >= 0) used.add(match);
      out.push({ ...d, eye: match >= 0 ? "OU" : d.eye });
    });
  lefts.forEach((l, i) => !used.has(i) && out.push(l));
  return out;
}
