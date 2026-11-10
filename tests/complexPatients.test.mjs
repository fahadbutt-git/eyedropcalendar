// Harder charts: years of notes, several eye conditions at once, and Oscar's
// ophthalmology Eye Form, where today's Plan, Impression and Current Hx are
// separate boxes. The patients are the stand-in's made-up ones.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNote } from "../src/lib/noteParser.js";
import { SEED_FORMULARY as F } from "../src/data/formulary.js";
import { COMPLEX } from "../oscar/standin/complex.mjs";

const [LONG, MULTI, KAI, YEARS] = COMPLEX;
const brief = (r) => r.drops.map((d) => [d.brand, d.eye, d.freq, d.mode, d.mode === "taper" ? d.steps.map((s) => `${s.freq}x${s.days}`).join(",") : d.mode === "duration" ? d.durationDays : ""]);
const skipped = (r) => r.skipped.map((s) => s.name).sort();
// The Eye Form's boxes, as the extension joins them: each under its title.
const eyeForm = (f) =>
  [["Plan", f.plan], ["Impression", f.impression], ["Current Hx", f.current]]
    .filter(([, t]) => t.trim())
    .map(([l, t]) => `${l}:\n${t}`)
    .join("\n\n");

test("five eye conditions at once: each drop in its own eye, two tapers of one drop kept apart", () => {
  const r = parseNote(eyeForm(MULTI.eyeform), F);
  assert.deepEqual(brief(r), [
    ["Lumigan RC", "OU", 1, "ongoing", ""],
    ["Pred Forte", "OS", 4, "taper", "4x7,3x7,2x7,1x7"],
    ["Vigamox", "OD", 4, "duration", 7],
    ["Pred Forte", "OD", 4, "taper", "4x7,2x14"],
    ["Pataday", "OU", 1, "ongoing", ""],
  ]);
  assert.deepEqual(skipped(r), ["Cyclogyl", "Systane"]);
});

test("an Eye Form plan reads only today's plan, not drops named in the impression's diagnosis list", () => {
  const r = parseNote(eyeForm(KAI.eyeform), F);
  assert.deepEqual(brief(r), [["Xalatan", "OU", 1, "ongoing", ""]]);
});

test("an Eye Meds list keeps current drops and leaves out the discontinued ones", () => {
  const r = parseNote(LONG.eyeform.meds.join("\n"), F);
  assert.deepEqual(brief(r).map((d) => d.slice(0, 3)), [["Lumigan RC", "OU", 1], ["Cosopt", "OU", 2]]);
  assert.deepEqual(skipped(r), ["Alphagan-P", "Xalatan"]);
});

test("six years of visits: the newest plan names the current drops, older plans the drops of their time", () => {
  const plans = LONG.notes.filter((n, i) => i % 3 === 2);
  const newest = parseNote(plans.at(-1).text, F);
  assert.deepEqual(brief(newest).map((d) => d[0]), ["Lumigan RC", "Cosopt"]);
  // A switch names the new drop and leaves out the old one.
  const sw = parseNote(plans.find((n) => /Switch/.test(n.text)).text, F);
  assert.deepEqual(brief(sw).map((d) => d[0]).sort(), ["Cosopt", "Lumigan RC"]);
  // "Continue same" names nothing, so it is never mistaken for a plan.
  assert.equal(parseNote("Continue same. RTC 4 months.", F).drops.length, 0);
  // The standard encounter's one-note-per-visit history reads the same way.
  assert.deepEqual(brief(parseNote(YEARS.notes.at(-1).text, F)).map((d) => d[0]), ["Lumigan RC", "Cosopt"]);
});

test("a drop not sold in Canada is reported as not recognised, so it can be added by hand", () => {
  const r = parseNote("Plan:\nContinue Lumigan qhs OU. Stop Cosopt. Start Rhopressa qhs OU.", F);
  assert.deepEqual(brief(r).map((d) => d[0]), ["Lumigan RC"]);
  assert.deepEqual(skipped(r), ["Cosopt"]);
  assert.deepEqual(r.unknown, ["Rhopressa"]);
});
