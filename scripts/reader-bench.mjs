// Measures how well the chart note reader does on several hundred made-up
// ophthalmology notes, each built with a known correct answer. Notes vary
// the drug name (brand, generic, misspelled), how the eye and frequency are
// written, durations, tapers, note styles and distracting text. Nothing here
// is a real patient.
//
//   node scripts/reader-bench.mjs            prints the summary
//   node scripts/reader-bench.mjs --write    also writes docs/reader-accuracy.md
//   node scripts/reader-bench.mjs --misses   lists every wrong answer
import { writeFileSync } from "node:fs";
import { parseNote } from "../src/lib/noteParser.js";
import { SEED_FORMULARY as F } from "../src/data/formulary.js";

// A small fixed random sequence, so every run builds the same notes.
let seed = 20261108;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (list) => list[Math.floor(rand() * list.length)];

const DRUGS = [
  // [brand on the list, names a note might use, usual frequency, kind]
  ["Xalatan", ["Xalatan", "latanoprost"], 1, "glaucoma"],
  ["Lumigan RC", ["Lumigan"], 1, "glaucoma"],
  ["Travatan Z", ["Travatan", "Travatan Z"], 1, "glaucoma"],
  ["Vyzulta", ["Vyzulta"], 1, "glaucoma"],
  ["Timoptic", ["Timoptic", "timolol 0.5%"], 2, "glaucoma"],
  ["Cosopt", ["Cosopt", "dorzolamide-timolol"], 2, "glaucoma"],
  ["Combigan", ["Combigan", "brimonidine-timolol"], 2, "glaucoma"],
  ["Alphagan-P", ["Alphagan P", "brimonidine 0.15%"], 3, "glaucoma"],
  ["Azopt", ["Azopt", "brinzolamide"], 3, "glaucoma"],
  ["Simbrinza", ["Simbrinza"], 2, "glaucoma"],
  ["Pred Forte", ["Pred Forte", "prednisolone acetate 1%"], 4, "steroid"],
  ["Durezol", ["Durezol", "difluprednate"], 2, "steroid"],
  ["Lotemax", ["Lotemax", "loteprednol"], 4, "steroid"],
  ["FML", ["FML", "fluorometholone"], 2, "steroid"],
  ["Vigamox", ["Vigamox", "moxifloxacin"], 3, "antibiotic"],
  ["Ocuflox", ["Ocuflox", "ofloxacin"], 4, "antibiotic"],
  ["Tobrex", ["Tobrex", "tobramycin"], 4, "antibiotic"],
  ["Maxitrol", ["Maxitrol"], 4, "antibiotic"],
  ["TobraDex", ["TobraDex", "Tobradex"], 4, "antibiotic"],
  ["Ilevro", ["Ilevro", "nepafenac 0.3%"], 1, "nsaid"],
  ["Acular", ["Acular", "ketorolac"], 4, "nsaid"],
  ["Restasis", ["Restasis"], 2, "dry eye"],
  ["Xiidra", ["Xiidra"], 2, "dry eye"],
  ["Pataday", ["Pataday"], 1, "allergy"],
];
const EYES = {
  OD: ["OD", "right eye", "RE", "in the right eye"],
  OS: ["OS", "left eye", "LE", "in the left eye"],
  OU: ["OU", "both eyes", "BE", "in both eyes"],
};
const FREQS = {
  1: ["daily", "qd", "once daily", "once a day", "qhs", "at bedtime"],
  2: ["BID", "bid", "twice daily", "twice a day", "b.i.d."],
  3: ["TID", "tid", "three times a day", "t.i.d."],
  4: ["QID", "qid", "four times a day", "q.i.d."],
};
const DURATIONS = [
  ["x 1 wk", 7], ["x1wk", 7], ["x 7 days", 7], ["for 7 days", 7], ["for one week", 7],
  ["x 2 weeks", 14], ["for two weeks", 14], ["x10d", 10], ["x 5 days", 5],
];
const LEADS = ["", "Start ", "Continue ", "Plan: ", "Rx: ", "Use ", "- "];
const FILLER = [
  "IOP 15 OD, 16 OS.", "Optic nerves stable.", "RTC 3 months.", "VA 20/25 OU.", "Discussed adherence.",
  "Gonioscopy open angles.", "Patient tolerating drops well.", "Follow up 6 weeks with IOP.", "No AC cells.", "Bleb diffuse.",
];

// A typing slip: two letters swapped, one dropped, or one changed.
function misspell(word) {
  if (word.length < 6 || /\s|-|\d/.test(word)) return null;
  const i = 2 + Math.floor(rand() * (word.length - 3));
  const kind = Math.floor(rand() * 3);
  if (kind === 0) return word.slice(0, i) + word[i + 1] + word[i] + word.slice(i + 2);
  if (kind === 1) return word.slice(0, i) + word.slice(i + 1);
  const vowels = "aeiou";
  const c = vowels.includes(word[i]) ? vowels[(vowels.indexOf(word[i]) + 1) % 5] : word[i];
  return c === word[i] ? null : word.slice(0, i) + c + word.slice(i + 1);
}

// One drop written out, with the answer it should give.
function order({ drug, eye, freq, duration, taper, typo }) {
  const [brand, names] = drug;
  let name = pick(names);
  let typed = null;
  if (typo) {
    const slip = misspell(name);
    if (slip) {
      typed = slip;
      name = slip;
    }
  }
  const e = pick(EYES[eye]);
  const gtt = rand() < 0.3 ? "1 gtt " : "";
  let text;
  let answer;
  if (taper) {
    const steps = [4, 3, 2, 1].map((f, i) => `${i ? "then " : ""}${pick(FREQS[f])} ${pick(["x 1 wk", "x1wk", "for one week", "for a week"])}`);
    text = `${name} ${gtt}${e} ${steps.join(" ")} then stop`;
    answer = { brand, eye, mode: "taper", steps: "4x7,3x7,2x7,1x7" };
  } else if (duration) {
    text = `${name} ${gtt}${pick(FREQS[freq])} ${e} ${duration[0]}`;
    answer = { brand, eye, mode: "duration", freq, days: duration[1] };
  } else {
    text = rand() < 0.5 ? `${name} ${gtt}${pick(FREQS[freq])} ${e}` : `${name} ${gtt}${e} ${pick(FREQS[freq])}`;
    answer = { brand, eye, mode: "ongoing", freq };
  }
  return { text, answer, typed };
}

function makeCases() {
  const cases = [];
  const eyeOf = () => pick(["OD", "OS", "OU"]);
  // Single glaucoma or chronic drops.
  for (let i = 0; i < 140; i++) {
    const drug = pick(DRUGS.filter((d) => ["glaucoma", "dry eye", "allergy"].includes(d[3])));
    const o = order({ drug, eye: eyeOf(), freq: drug[2], typo: rand() < 0.15 });
    cases.push({ kind: "single chronic", note: `${pick(FILLER)} ${pick(LEADS)}${o.text}. ${pick(FILLER)}`, answers: [o.answer], typos: o.typed ? [o.typed] : [] });
  }
  // Short courses.
  for (let i = 0; i < 80; i++) {
    const drug = pick(DRUGS.filter((d) => ["antibiotic", "nsaid", "steroid"].includes(d[3])));
    const o = order({ drug, eye: eyeOf(), freq: drug[2], duration: pick(DURATIONS), typo: rand() < 0.15 });
    cases.push({ kind: "short course", note: `${pick(LEADS)}${o.text}. ${pick(FILLER)}`, answers: [o.answer], typos: o.typed ? [o.typed] : [] });
  }
  // Post-op: antibiotic course plus steroid taper.
  for (let i = 0; i < 60; i++) {
    const eye = pick(["OD", "OS"]);
    const ab = order({ drug: pick(DRUGS.filter((d) => d[3] === "antibiotic" && !["Maxitrol", "TobraDex"].includes(d[0]))), eye, freq: 4, duration: [pick(["x 1 wk", "x1wk", "for 7 days"]), 7] });
    const st = order({ drug: pick(DRUGS.filter((d) => ["Pred Forte", "Lotemax"].includes(d[0]))), eye, taper: true, typo: rand() < 0.1 });
    const head = pick([`POD1 CE/IOL ${eye}.`, `s/p phaco ${eye}.`, `Post-op day 1 ${eye === "OD" ? "right" : "left"} eye.`]);
    cases.push({ kind: "post-op", note: `${head} ${ab.text}. ${st.text}. ${pick(FILLER)}`, answers: [ab.answer, st.answer], typos: st.typed ? [st.typed] : [] });
  }
  // Two or three glaucoma drops, sometimes with different eyes.
  for (let i = 0; i < 70; i++) {
    const n = 2 + Math.floor(rand() * 2);
    const chosen = [];
    while (chosen.length < n) {
      const d = pick(DRUGS.filter((x) => x[3] === "glaucoma"));
      if (!chosen.includes(d)) chosen.push(d);
    }
    const orders = chosen.map((d) => order({ drug: d, eye: eyeOf(), freq: d[2] }));
    const join = pick([". ", ", ", "\n- ", "; "]);
    cases.push({ kind: "multiple glaucoma", note: `${pick(FILLER)}${join === "\n- " ? "\n- " : " "}${orders.map((o) => o.text).join(join)}.`, answers: orders.map((o) => o.answer), typos: [] });
  }
  // Distractors that must be left out: stopped, past, allergy, lubricants.
  for (let i = 0; i < 50; i++) {
    const keep = pick(DRUGS.filter((d) => d[3] === "glaucoma"));
    let old = pick(DRUGS.filter((d) => d[3] === "glaucoma" && d !== keep));
    const o = order({ drug: keep, eye: eyeOf(), freq: keep[2] });
    const oldName = old[1][0];
    const distractor = pick([
      `Stop ${oldName} (hyperemia).`,
      `Previously on ${oldName}.`,
      `Allergic to ${oldName}.`,
      `Failed ${oldName} in the past.`,
      `ATs QID PRN OU.`,
      `Artificial tears as needed.`,
    ]);
    cases.push({ kind: "distractor", note: `${distractor} ${pick(["Start ", "Continue ", ""])}${o.text}.`, answers: [o.answer], typos: [] });
  }
  return cases;
}

const sameEye = (a, b) => a === b;
function score(cases) {
  const tally = { notes: cases.length, drops: 0, found: 0, extra: 0, eyeRight: 0, wrongEye: 0, freqRight: 0, freqTotal: 0, courseRight: 0, courseTotal: 0, perfect: 0, flagged: 0, typos: 0, typosFound: 0 };
  const byKind = {};
  const misses = [];
  for (const c of cases) {
    const r = parseNote(c.note, F);
    let ok = true;
    const used = new Set();
    for (const a of c.answers) {
      tally.drops++;
      const i = r.drops.findIndex((d, j) => !used.has(j) && d.brand === a.brand);
      if (i < 0) {
        ok = false;
        misses.push({ kind: c.kind, note: c.note, problem: `missed ${a.brand}` });
        continue;
      }
      used.add(i);
      const d = r.drops[i];
      tally.found++;
      if (d.flags.length) tally.flagged++;
      if (sameEye(d.eye, a.eye)) tally.eyeRight++;
      else {
        tally.wrongEye++;
        ok = false;
        misses.push({ kind: c.kind, note: c.note, problem: `${a.brand} eye ${d.eye}, should be ${a.eye}${d.flags.length ? " (flagged)" : " (not flagged)"}` });
      }
      if (a.mode === "taper") {
        tally.courseTotal++;
        const steps = d.steps?.map((s) => `${s.freq}x${s.days}`).join(",");
        if (d.mode === "taper" && steps === a.steps) tally.courseRight++;
        else {
          ok = false;
          misses.push({ kind: c.kind, note: c.note, problem: `${a.brand} taper read as ${d.mode} ${steps || d.freq}` });
        }
      } else {
        tally.freqTotal++;
        if (d.freq === a.freq) tally.freqRight++;
        else {
          ok = false;
          misses.push({ kind: c.kind, note: c.note, problem: `${a.brand} ${d.freq} a day, should be ${a.freq}` });
        }
        if (a.mode === "duration") {
          tally.courseTotal++;
          if (d.mode === "duration" && d.durationDays === a.days) tally.courseRight++;
          else {
            ok = false;
            misses.push({ kind: c.kind, note: c.note, problem: `${a.brand} course ${d.mode} ${d.durationDays}, should be ${a.days} days` });
          }
        }
      }
    }
    const extra = r.drops.filter((_, j) => !used.has(j));
    if (extra.length) {
      tally.extra += extra.length;
      ok = false;
      misses.push({ kind: c.kind, note: c.note, problem: `added ${extra.map((d) => d.brand).join(", ")}` });
    }
    for (const t of c.typos) {
      tally.typos++;
      if (r.drops.some((d) => d.flags.some((f) => f.includes(`"${t}"`)))) tally.typosFound++;
    }
    if (ok) tally.perfect++;
    byKind[c.kind] = byKind[c.kind] || { notes: 0, perfect: 0 };
    byKind[c.kind].notes++;
    if (ok) byKind[c.kind].perfect++;
  }
  return { tally, byKind, misses };
}

const pct = (a, b) => (b ? `${((100 * a) / b).toFixed(1)}%` : "n/a");
const { tally: t, byKind, misses } = score(makeCases());
const lines = [
  `| Measure | Result |`,
  `| --- | --- |`,
  `| Notes | ${t.notes} |`,
  `| Notes read fully right | ${t.perfect} (${pct(t.perfect, t.notes)}) |`,
  `| Drops found | ${t.found} of ${t.drops} (${pct(t.found, t.drops)}) |`,
  `| Drops added that were not ordered | ${t.extra} |`,
  `| Eye right | ${pct(t.eyeRight, t.found)} |`,
  `| Wrong eye | ${t.wrongEye} |`,
  `| Frequency right | ${pct(t.freqRight, t.freqTotal)} |`,
  `| Course or taper right | ${pct(t.courseRight, t.courseTotal)} |`,
  `| Misspellings read and flagged | ${t.typosFound} of ${t.typos} |`,
];
const kinds = ["| Note type | Notes | Read fully right |", "| --- | --- | --- |", ...Object.entries(byKind).map(([k, v]) => `| ${k} | ${v.notes} | ${pct(v.perfect, v.notes)} |`)];
console.log([...lines, "", ...kinds].join("\n"));
if (process.argv.includes("--misses")) for (const m of misses) console.log(`\n[${m.kind}] ${m.problem}\n  ${m.note.replace(/\n/g, " / ")}`);
if (process.argv.includes("--write"))
  writeFileSync(
    new URL("../docs/reader-accuracy.md", import.meta.url),
    `# Chart note reader accuracy\n\nMeasured on ${t.notes} made-up ophthalmology notes, each built with a known correct answer, by scripts/reader-bench.mjs. The notes vary drug names (brand, generic and misspelled), how the eye and frequency are written, durations, tapers, note styles, and distracting text such as stopped drugs, allergies and artificial tears. No real patient notes are used.\n\n${lines.join("\n")}\n\n${kinds.join("\n")}\n\nEvery drop read from a chart is still shown with what was assumed, and ticked by the clinician before anything is printed. Wrong-eye errors are counted on their own because they matter most.\n`
  );
