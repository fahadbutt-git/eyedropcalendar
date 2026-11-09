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
  assert.match(flagged(r, "Pred Forte"), /heading it sits under/);
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

test("a taper named without steps is never invented", () => {
  const r = parseNote("Durezol taper OD.", F);
  assert.deepEqual(brief(r), [["Durezol", "OD", 4, "ongoing", 1]]);
  assert.match(flagged(r, "Durezol"), /Choose the taper steps/);
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
  assert.deepEqual(parseNote("Patient doing well. RTC 6 months.", F), { drops: [], skipped: [], unknown: [] });
  assert.deepEqual(parseNote("", F), { drops: [], skipped: [], unknown: [] });
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

test("ordinary words are never read as an eye", () => {
  assert.equal(parseNote("Pred Forte to be used QID OS x1wk then BID x1wk.", F).drops[0].eye, "OS");
  assert.equal(parseNote("Xalatan qhs OS, re-check IOP in 4 weeks.", F).drops[0].eye, "OS");
  assert.equal(parseNote("Timoptic BID left, call right away if pain.", F).drops[0].eye, "OS");
});

test("two eyes named for one drop are flagged", () => {
  assert.match(flagged(parseNote("Xalatan qhs OD OS.", F), "Xalatan"), /more than one eye/);
});

test("OD with no frequency is flagged, since it can mean once daily", () => {
  const r = parseNote("Latanoprost OD.", F);
  assert.equal(r.drops[0].eye, "OD");
  assert.match(flagged(r, "Xalatan"), /once daily as well as right eye/);
  assert.doesNotMatch(flagged(parseNote("Xalatan qhs OD.", F), "Xalatan"), /once daily/);
});

test("a current drop is kept when the sentence also mentions the past", () => {
  assert.deepEqual(brief(parseNote("Allergic conjunctivitis: start Pataday daily OU.", F)).map((d) => d[0]), ["Pataday"]);
  assert.deepEqual(brief(parseNote("s/p failed trab OS, continue Cosopt BID OS.", F)).map((d) => d[0]), ["Cosopt"]);
  const r = parseNote("Allergic to Xalatan. Lumigan qhs OU.", F);
  assert.deepEqual(r.drops.map((d) => d.brand), ["Lumigan RC"]);
  assert.ok(r.skipped.some((s) => s.name === "Xalatan"));
});

test("hourly drops are left off the calendar for the clinician to write by hand", () => {
  const r = parseNote("Vigamox q1h OS. Pred Forte QID OS.", F);
  assert.deepEqual(r.drops.map((d) => d.brand), ["Pred Forte"]);
  assert.match(r.skipped.find((s) => s.name === "Vigamox").why, /by hand/);
});

test("a strength in the note that differs from the drug chosen is flagged", () => {
  assert.match(flagged(parseNote("Atropine 0.01% qhs OU.", F), "Atropine"), /^Strength: the note says 0\.01%/m);
  assert.doesNotMatch(flagged(parseNote("Atropine 1% BID OD.", F), "Atropine"), /Strength/);
  assert.doesNotMatch(flagged(parseNote("Xalatan 0.005% qhs OU.", F), "Xalatan"), /Strength/);
});

test("ophthalmology note styles from the pre-pilot scenarios", () => {
  // "at bedtime" is not artificial tears.
  assert.deepEqual(parseNote("Lumigan once daily in both eyes at bedtime", F).skipped, []);
  // A taper written in words.
  assert.deepEqual(brief(parseNote("Pred Forte four times a day in the right eye for one week then three times a day for a week then twice a day for a week then once a day for a week.", F)), [["Pred Forte", "OD", 4, "taper", "4x7,3x7,2x7,1x7"]]);
  // Eye headings above a list.
  assert.deepEqual(brief(parseNote("OD:\n- Vigamox QID x 1 wk\nOS:\n- Xalatan qhs", F)).map((d) => [d[0], d[1]]), [["Vigamox", "OD"], ["Xalatan", "OS"]]);
  // The strength written picks the product, with either spelling.
  assert.equal(parseNote("Alphagan 0.15% TID OU", F).drops[0].brand, "Alphagan-P");
  assert.equal(parseNote("Alphagan P TID OU", F).drops[0].brand, "Alphagan-P");
});

test("misspelled drug names beside a dose are read and flagged", () => {
  const r = parseNote("Xalatn qhs OU. Combigen BID OS.", F);
  assert.deepEqual(r.drops.map((d) => [d.brand, d.eye]), [["Xalatan", "OU"], ["Combigan", "OS"]]);
  assert.match(r.drops[0].flags[0], /The note says "Xalatn", read as Xalatan/);
  assert.equal(parseNote("latanaprost 1 gtt qhs OU", F).drops[0].brand, "Xalatan");
});

test("ordinary words are never corrected into drugs", () => {
  for (const note of ["Patient stable. Follow up in four months. Pressure stable OU.", "Return daily for drops check OD.", "Lumigan qhs OU, return in 3 months, pressure stable"])
    assert.ok(parseNote(note, F).drops.every((d) => !d.flags.some((f) => /Check the spelling/.test(f))), note);
});

test("unknown words in a drug's place are listed, not dropped silently", () => {
  const r = parseNote("Gtts: Vgmx 1 gtt QID OD x7d; Pred Forte QID OD", F);
  assert.deepEqual(r.drops.map((d) => d.brand), ["Pred Forte"]);
  assert.deepEqual(r.unknown, ["Vgmx"]);
});

test("notes from the independent review are read safely", () => {
  // A different plan for each eye keeps both.
  assert.deepEqual(brief(parseNote("Bilateral post-op inflammation.\nPred Forte QID OD. Pred Forte TID OS.", F)).map((d) => [d[0], d[1], d[2]]), [["Pred Forte", "OD", 4], ["Pred Forte", "OS", 3]]);
  // The same plan in each eye is one plan for both.
  assert.deepEqual(brief(parseNote("OD: Xalatan qhs, Azopt TID\nOS: Xalatan qhs", F)).map((d) => [d[0], d[1]]), [["Xalatan", "OU"], ["Azopt", "OD"]]);
  assert.equal(parseNote("Lumigan RC qhs OD, same in fellow eye.", F).drops[0].eye, "OU");
  // Mentioned but not ordered.
  for (const note of [
    "Sulfa allergy (rash), avoid CAIs incl. dorzolamide.",
    "Allergy: latanoprost (hyperemia).",
    "Consider adding Azopt if IOP remains high at next visit.",
    "Cycloplegic refraction today: Cyclogyl 1% instilled OU x2 in clinic.",
    "Started prednisone 60 mg PO daily.",
    "Pt reports Cosopt was stopped by outside ophthalmologist last year.",
  ])
    assert.deepEqual(parseNote(note, F).drops, [], note);
  assert.deepEqual(parseNote("IOP above target OS on timolol.\nD/C timolol OS. Start Azopt TID OS.", F).drops.map((d) => d.brand), ["Azopt"]);
  assert.deepEqual(parseNote("Change latanoprost to preservative-free Monoprost qhs OU.", F).drops.map((d) => d.brand), ["Monoprost"]);
  // The post-op eye from the header, and a taper carried onto the next line.
  assert.equal(parseNote("POD1 phaco/PCIOL OD.\nPred Forte QID x 1 wk, then TID x 1 wk, BID x 1 wk, daily x 1 wk, then stop.", F).drops[0].eye, "OD");
  assert.equal(parseNote("Pred Forte left eye four times a day for one week, then three times a day for one week,\nthen twice a day for one week, then once a day for one week, then stop.", F).drops[0].steps.length, 4);
  // Shorthand and older notation.
  assert.equal(parseNote("Polytrim 1 gtt OU QID x 7 days.", F).drops[0].brand, "Polytrimethoprim");
  assert.equal(parseNote("TobraDex ung OS hs x 5/7", F).drops[0].durationDays, 5);
  assert.equal(parseNote("rx vigamox 1gtt od qid x7d", F).drops[0].eye, "OD");
});

test("drops for someone else, for later or ruled out are not added", () => {
  for (const note of [
    "Pt's husband is on Xalatan for glaucoma (seen separately). No drops required.",
    "Plan phaco/IOL OD Dec 3. Post-op drops (Vigamox, Pred Forte, Ilevro) to start day of surgery per protocol.",
    "If mucopurulent discharge, may use Polytrim OD qid x 7 days.",
    "Pt allergic to neomycin -> no Maxitrol.",
    "Pt stopped all drops on own 2 mo ago (Xalatan OU). No drops for now.",
    "s/p SLT OD today. Pre-tx Iopidine given.",
    "ALLERGIES: sulfa (rash); timolol (bronchospasm, asthma)",
    "Cont rest.",
  ])
    assert.deepEqual(parseNote(note, F).drops, [], note);
  // A plan to start now is still read.
  assert.equal(parseNote("Will start latanoprost 0.005% one drop in both eyes at bedtime.", F).drops[0].brand, "Xalatan");
});

test("misspelled and shortened names are recognised, and only in dosing context", () => {
  const read = (note) => parseNote(note, F).drops.map((d) => d.brand);
  assert.deepEqual(read("Azop OU tid, cont"), ["Azopt"]);
  assert.deepEqual(read("dorzolamid-timolol OD bid"), ["Cosopt"]);
  assert.deepEqual(read("Lumigan RC OU qhs; Alfagan P OU tid"), ["Lumigan RC", "Alphagan-P"]);
  assert.deepEqual(read("Vigamax OD qid x1 wk, Pred Fort OD qid x1 wk"), ["Vigamox", "Pred Forte"]);
  assert.deepEqual(read("cipro gtts LE qid x 5 days"), ["Ciloxan"]);
  assert.deepEqual(read("Erythro oint OU qhs x 2 wks"), ["Erythromycin Ointment"]);
  assert.deepEqual(read("Xalitin qhs OU"), ["Xalatan"]);
  // Not close to any drug, or not beside a dose: never a drug.
  assert.deepEqual(read("Zorbax qid OU"), []);
  assert.deepEqual(parseNote("Zorbax qid OU", F).unknown, ["Zorbax"]);
  assert.deepEqual(read("Prednisone 40 mg PO daily"), []);
  assert.deepEqual(read("Discussed Xalatn options at length"), []);
});
