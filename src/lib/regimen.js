// The drop model and how many doses each drop needs on a given day.
//
// A drop: { id, brand, eye: "OD" | "OS" | "OU", freq, drops,
//           mode: "ongoing" | "duration" | "taper", durationDays, startDay, steps }
// Day indexes count from 0 on the schedule start date. startDay is 1-based.

export const FREQ_OPTIONS = [1, 2, 3, 4, 5, 6, 8];
export const DROP_OPTIONS = [1, 2, 3];
// Eyes are always written out in full. OD, OS and OU are on the ISMP list of
// error-prone abbreviations, so they are only used as internal keys.
export const EYES = {
  OD: { label: "Right eye", long: "right eye", short: "Right" },
  OS: { label: "Left eye", long: "left eye", short: "Left" },
  OU: { label: "Both eyes", long: "both eyes", short: "Both" },
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

// One week at each supported frequency from `from` down to once a day. It
// never starts above the current frequency and never skips to an
// unsupported one (there is no 7 times a day).
const weekly = (from) =>
  FREQ_OPTIONS.filter((f) => f <= from)
    .reverse()
    .map((freq) => ({ freq, days: 7 }));

export const TAPER_PRESETS = [
  { label: "Weekly, from current frequency", build: (f) => weekly(f) },
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
  { label: "Durezol: QID x14d, then BID x14d (adjust to response)", build: () => [{ freq: 4, days: 14 }, { freq: 2, days: 14 }] },
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

// Entries keep the order the drops were entered in, so drop 3 on screen is
// number 3 on the calendar and the prescription.
export function toEntries(drops) {
  const list = drops.filter((d) => d.brand).map((d) => ({ ...d, mode: modeOf(d) }));
  const used = new Set();
  const out = [];
  list.forEach((d, i) => {
    if (used.has(i)) return;
    const other = d.eye === "OD" ? "OS" : d.eye === "OS" ? "OD" : null;
    const match = other ? list.findIndex((x, j) => j > i && !used.has(j) && x.eye === other && planKey(x) === planKey(d)) : -1;
    if (match >= 0) used.add(match);
    out.push(match >= 0 ? { ...d, eye: "OU" } : d);
  });
  return out;
}
