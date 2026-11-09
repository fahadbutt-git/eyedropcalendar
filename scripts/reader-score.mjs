// Scores the chart note reader against a set of made-up notes written by an
// independent reviewer, each with the answer a careful clinician would give.
//   node scripts/reader-score.mjs tests/fixtures/independent-notes-1.json [--misses]
import { readFileSync } from "node:fs";
import { parseNote } from "../src/lib/noteParser.js";
import { SEED_FORMULARY as F } from "../src/data/formulary.js";
const cases = JSON.parse(readFileSync(process.argv[2], "utf8"));
const t = { notes: 0, perfect: 0, drops: 0, found: 0, extra: 0, wrongEye: 0, wrongEyeUnflagged: 0, freqWrong: 0, courseWrong: 0, skipViolations: 0, hardNotes: 0, hardPerfect: 0, noDrop: 0, noDropClean: 0 };
const misses = [];
for (const c of cases) {
  t.notes++; if (c.hard) t.hardNotes++;
  const r = parseNote(c.note, F);
  let ok = true; const used = new Set(); const probs = [];
  for (const a of c.expected || []) {
    t.drops++;
    const i = r.drops.findIndex((d, j) => !used.has(j) && d.brand === a.brand);
    if (i < 0) { ok = false; probs.push(`missed ${a.brand}`); continue; }
    used.add(i); t.found++; const d = r.drops[i];
    if (d.eye !== a.eye) { ok = false; t.wrongEye++; const fl = d.flags.some((f) => /eye/i.test(f)); if (!fl) t.wrongEyeUnflagged++; probs.push(`${a.brand} eye ${d.eye} not ${a.eye}${fl ? " (flagged)" : " (NOT flagged)"}`); }
    if (a.mode === "taper") {
      const steps = (d.steps || []).map((s) => `${s.freq}x${s.days}`).join(",");
      if (d.mode !== "taper" || (a.steps && steps !== a.steps)) { ok = false; t.courseWrong++; probs.push(`${a.brand} taper ${d.mode} ${steps || d.freq} not ${a.steps}`); }
    } else {
      if (d.freq !== a.freq) { ok = false; t.freqWrong++; probs.push(`${a.brand} ${d.freq}/day not ${a.freq}${d.flags.length ? " (flagged)" : ""}`); }
      if (a.mode === "duration" && (d.mode !== "duration" || (a.days && d.durationDays !== a.days))) { ok = false; t.courseWrong++; probs.push(`${a.brand} ${d.mode} ${d.durationDays ?? ""} not ${a.days} days`); }
      if (a.mode === "ongoing" && d.mode !== "ongoing") { ok = false; t.courseWrong++; probs.push(`${a.brand} read as ${d.mode} ${d.durationDays ?? ""}, should be ongoing`); }
    }
  }
  const extra = r.drops.filter((_, j) => !used.has(j));
  if (extra.length) { ok = false; t.extra += extra.length; probs.push(`added ${extra.map((d) => d.brand).join(", ")}`); }
  for (const s of c.should_skip || []) if (r.drops.some((d, j) => !used.has(j) && (d.brand.toLowerCase().includes(String(s).toLowerCase().split(" ")[0]) ))) t.skipViolations++;
  if (!(c.expected || []).length) { t.noDrop++; if (!r.drops.length) t.noDropClean++; }
  if (ok) { t.perfect++; if (c.hard) t.hardPerfect++; } else misses.push({ id: c.id, style: c.style, hard: c.hard, note: c.note, probs, flags: r.drops.map((d) => `${d.brand}: ${d.flags.join(" | ")}`).filter((x) => !x.endsWith(": ")), unknown: r.unknown });
}
console.log(JSON.stringify(t));
if (process.argv[3] === "--misses") for (const m of misses) console.log(`\n#${m.id} [${m.style}]${m.hard ? " HARD" : ""}: ${m.probs.join("; ")}\n  NOTE: ${m.note.replace(/\n/g, " / ").slice(0, 400)}${m.unknown?.length ? "\n  unknown: " + m.unknown.join(",") : ""}`);
