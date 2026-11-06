// Chart note reading. Every note here is made up.
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseNote, parseRxList } from "../src/lib/noteParser.js";
import { SEED_FORMULARY as F } from "../src/data/formulary.js";

const brief = (r) => r.drops.map((d) => [d.brand, d.eye, d.freq, d.mode, d.mode === "taper" ? d.steps.map((s) => `${s.freq}x${s.days}`).join(",") : d.mode === "duration" ? d.durationDays : d.startDay]);
const flagged = (r, brand) => r.drops.find((d) => d.brand === brand).flags.join(" ");

test("a postoperative taper with a fixed course and a glaucoma drop", () => {
  const r = parseNote(
    `1. Right trab POW2. Pred Forte q2h x1wk then QID x1wk then TID x1wk then BID x1wk then stop. Moxi QID OD x1wk.
2. Left POAG. Continue Xalatan qhs OS.`,
    F
  );
  assert.deepEqual(brief(r), [
    ["Pred Forte", "OD", 8, "taper", "8x7,4x7,3x7,2x7"],
    ["Vigamox", "OD", 4, "duration", 7],
    ["Xalatan", "OS", 1, "ongoing", 1],
  ]);
  assert.match(flagged(r, "Pred Forte"), /numbered problem/);
  assert.match(flagged(r, "Pred Forte"), /Every 2 hours/);
  assert.match(flagged(r, "Vigamox"), /not used more than 3 times/);
  assert.equal(flagged(r, "Xalatan"), "");
});

test("a list shares the eye written after it", () => {
  const r = parseNote("IOP 17 on 0/2 (brimonidine, dorzolamide left).", F);
  assert.deepEqual(brief(r), [
    ["Alphagan", "OS", 2, "ongoing", 1],
    ["Dorzolamide", "OS", 3, "ongoing", 1],
  ]);
  assert.match(flagged(r, "Alphagan"), /more than one strength/);
  assert.match(flagged(r, "Alphagan"), /taken from the list/);
  assert.match(flagged(r, "Dorzolamide"), /no frequency/);
});

test("a taper that carries on becomes a second row, and PRN drops are left out", () => {
  const r = parseNote("2. Left tube exposure, repaired. Restart Maxidex BID for 8 days then decrease to QD until further instructions. Use Prolensa PRN.", F);
  assert.deepEqual(brief(r), [
    ["Maxidex", "OS", 2, "taper", "2x8"],
    ["Maxidex", "OS", 1, "ongoing", 9],
  ]);
  assert.match(r.drops[1].flags[0], /no end date/);
  assert.deepEqual(r.skipped, [{ name: "Prolensa", why: "as needed, so it is not on the calendar" }]);
});

test("past use, allergies, stopped drops and pills are listed but not added", () => {
  const r = parseNote("Previously on Combigan, allergic. d/c Lumigan. Start Cosopt 1 gtt BID OU. Diamox 250 QID. ATs QID.", F);
  assert.deepEqual(brief(r), [["Cosopt", "OU", 2, "ongoing", 1]]);
  const why = Object.fromEntries(r.skipped.map((s) => [s.name, s.why]));
  assert.match(why.Combigan, /past use/);
  assert.match(why["Lumigan RC"], /stopped/);
  assert.match(why.Diamox, /by mouth/);
  assert.match(why.ATs, /lubricant/);
});

test("combination names and strengths pick the right product", () => {
  const r = parseNote("Dorzolamide-timolol BID OU. Brimonidine 0.15% TID OS. Latanoprost qhs OU.", F);
  assert.deepEqual(brief(r).map((x) => x[0]), ["Cosopt", "Alphagan-P", "Xalatan"]);
  assert.equal(flagged(r, "Alphagan-P"), "");
});

test("a taper named without steps uses a weekly taper and says so", () => {
  const r = parseNote("Durezol taper OD.", F);
  assert.deepEqual(brief(r), [["Durezol", "OD", 4, "taper", "4x7,3x7,2x7,1x7"]]);
  assert.match(flagged(r, "Durezol"), /weekly taper/);
});

test("decimals and dotted abbreviations do not split a sentence", () => {
  const r = parseNote("Timolol 0.5% b.i.d. OU. Vigamox t.i.d. OD x 5 days.", F);
  assert.deepEqual(brief(r), [
    ["Timoptic", "OU", 2, "ongoing", 1],
    ["Vigamox", "OD", 3, "duration", 5],
  ]);
});

test("a drop written twice is kept once, with the clearer wording", () => {
  const r = parseNote("IOP 16 on 0/1 (latanoprost left).\n2. Left POAG. Continue Xalatan qhs OS.", F);
  assert.deepEqual(brief(r), [["Xalatan", "OS", 1, "ongoing", 1]]);
  assert.equal(flagged(r, "Xalatan"), "");
});

test("Eye Drop Tracker's own chart note reads back as the same plan", async () => {
  const { chartNote } = await import("../src/lib/chartNote.js");
  const entries = [
    { brand: "Xalatan", eye: "OS", drops: 1, mode: "ongoing", freq: 1, durationDays: 7, startDay: 1, steps: [] },
    { brand: "Pred Forte", eye: "OD", drops: 1, mode: "taper", freq: 4, durationDays: 7, startDay: 1, steps: [{ freq: 8, days: 7 }, { freq: 4, days: 7 }, { freq: 2, days: 7 }] },
    { brand: "Vigamox", eye: "OD", drops: 1, mode: "duration", freq: 3, durationDays: 7, startDay: 1, steps: [] },
  ];
  const note = chartNote({ entries, formulary: F, start: "2026-11-05", wake: "08:00", bed: "22:00", link: "https://eyedroptracker.com/#/p/x" });
  const r = parseNote(note, F);
  assert.deepEqual(brief(r), [
    ["Xalatan", "OS", 1, "ongoing", 1],
    ["Pred Forte", "OD", 8, "taper", "8x7,4x7,2x7"],
    ["Vigamox", "OD", 3, "duration", 7],
  ]);
  assert.ok(r.drops.every((d) => !d.flags.some((f) => /eye|frequency|strength/.test(f))), JSON.stringify(r.drops.map((d) => d.flags)));
});

test("a note with no drops gives nothing", () => {
  assert.deepEqual(parseNote("Patient doing well. RTC 6 months.", F), { drops: [], skipped: [] });
  assert.deepEqual(parseNote("", F), { drops: [], skipped: [] });
});

test("Oscar Rx entries read the same way, skipping archived and PRN", () => {
  const r = parseRxList(
    [
      { brandName: "XALATAN", instructions: "1 gtt OU qhs" },
      { genericName: "MOXIFLOXACIN", instructions: "1 drop OD QID x 7 days" },
      { brandName: "PROLENSA", prn: true, instructions: "OD daily" },
      { brandName: "LUMIGAN", archived: "true", instructions: "OU qhs" },
      { brandName: "TIMOPTIC", archived: "false", prn: "false", instructions: "1 gtt OU BID" },
    ],
    F
  );
  assert.deepEqual(brief(r), [
    ["Xalatan", "OU", 1, "ongoing", 1],
    ["Vigamox", "OD", 4, "duration", 7],
    ["Timoptic", "OU", 2, "ongoing", 1],
  ]);
});
