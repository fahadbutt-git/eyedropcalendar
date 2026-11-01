// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { toEntries, newSlot, dosesOnDay, lastDayIndex, sigText, patientInstruction, doseTimes, fmtTime, dropWarnings } from "../src/lib/regimen.js";
import { SEED_FORMULARY, DRUG_CLASSES } from "../src/data/formulary.js";
import { scheduleSpan } from "../src/lib/calendar.js";
import { buildICS } from "../src/lib/ics.js";
import { encodeRegimen, decodeRegimen } from "../src/lib/share.js";

const s = (o) => ({ ...newSlot(), ...o });
const taper = [{ freq: 4, days: 7 }, { freq: 3, days: 7 }, { freq: 2, days: 7 }, { freq: 1, days: 7 }];

test("matching right and left drops combine into both eyes", () => {
  const e = toEntries([s({ brand: "Xalatan", eye: "OD", freq: 1 }), s({ brand: "Xalatan", eye: "OS", freq: 1 }), s({ brand: "" })]);
  assert.equal(e.length, 1);
  assert.equal(e[0].eye, "OU");
});

test("different plans in each eye stay separate", () => {
  const e = toEntries([s({ brand: "Timoptic", eye: "OD", freq: 2 }), s({ brand: "Timoptic", eye: "OS", freq: 1 })]);
  assert.deepEqual(e.map((x) => x.eye), ["OD", "OS"]);
});

test("taper doses step down and stop", () => {
  const pf = s({ brand: "Pred Forte", eye: "OS", mode: "taper", steps: taper });
  assert.deepEqual([0, 6, 7, 13, 14, 20, 21, 27, 28].map((d) => dosesOnDay(pf, d)), [4, 4, 3, 3, 2, 2, 1, 1, 0]);
  assert.equal(lastDayIndex(pf), 27);
});

test("a taper with no steps behaves as ongoing", () => {
  const e = toEntries([s({ brand: "Atropine", freq: 3, mode: "taper", steps: [] })]);
  assert.equal(e[0].mode, "ongoing");
  assert.equal(dosesOnDay(e[0], 100), 3);
});

test("fixed course and delayed start", () => {
  const v = s({ brand: "Vigamox", freq: 4, mode: "duration", durationDays: 7, startDay: 3 });
  assert.deepEqual([1, 2, 8, 9].map((d) => dosesOnDay(v, d)), [0, 4, 4, 0]);
});

test("sig and patient wording", () => {
  const x = s({ brand: "Xalatan", eye: "OU", freq: 1 });
  assert.equal(sigText(x, "OU", true), "Instill 1 drop in both eyes (OU) once daily at bedtime.");
  assert.equal(patientInstruction(x, true), "1 drop in both eyes, once a day at bedtime.");
  const pf = s({ brand: "Pred Forte", eye: "OS", mode: "taper", steps: taper.slice(0, 2) });
  assert.equal(sigText(pf, "OS"), "Instill 1 drop in the left eye (OS) 4 times daily for 7 days, then 3 times daily for 7 days, then stop.");
  const late = s({ brand: "Combigan", eye: "OD", startDay: 3 });
  assert.equal(sigText(late, "OD", false, new Date(2026, 10, 2)), "Starting Nov 4, instill 1 drop in the right eye (OD) twice daily.");
});

test("dose times", () => {
  const t = (n, qhs) => doseTimes(n, "08:00", "22:00", qhs).map(fmtTime).join(", ");
  assert.equal(t(1), "8:00 AM");
  assert.equal(t(1, true), "10:00 PM");
  assert.equal(t(2), "8:00 AM, 8:00 PM");
  assert.equal(t(3), "8:00 AM, 2:00 PM, 8:00 PM");
  assert.equal(t(4), "8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM");
});

test("duplicate class warning per eye", () => {
  const w = dropWarnings([s({ brand: "Cosopt", eye: "OU" }), s({ brand: "Combigan", eye: "OD" })], SEED_FORMULARY, DRUG_CLASSES);
  assert.deepEqual(w, ["Cosopt and Combigan both contain a beta blocker (right eye)."]);
  assert.deepEqual(dropWarnings([s({ brand: "Cosopt", eye: "OS" }), s({ brand: "Combigan", eye: "OD" })], SEED_FORMULARY, DRUG_CLASSES), []);
});

test("ongoing plans fill whole months", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 })]);
  const a = scheduleSpan(e, 1, new Date(2026, 10, 2));
  assert.equal(a.end.toDateString(), "Mon Nov 30 2026");
  const b = scheduleSpan(e, 1, new Date(2026, 9, 31));
  assert.equal(b.end.toDateString(), "Mon Nov 30 2026");
});

test("calendar file has one alarm per dose time", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 }), s({ brand: "Cosopt", freq: 2 })]);
  const ics = buildICS({ entries: e, formulary: SEED_FORMULARY, start: new Date(2026, 10, 2), days: 2, wake: "08:00", bed: "22:00" });
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 6);
  assert.equal((ics.match(/BEGIN:VALARM/g) || []).length, 6);
  assert.match(ics, /DTSTART:20261102T220000/);
});

test("phone link round trip carries no patient details", () => {
  const e = toEntries([s({ brand: "Pred Forte", eye: "OS", mode: "taper", steps: taper })]);
  const code = encodeRegimen({ entries: e, formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00" });
  const back = decodeRegimen(code);
  assert.equal(back.entries[0].brand, "Pred Forte");
  assert.deepEqual(back.entries[0].steps, taper);
  assert.equal(back.start, "2026-11-02");
  assert.ok(!/name|dob|hcn|address/i.test(JSON.stringify(back)));
});

test("formulary entries are complete", () => {
  for (const m of SEED_FORMULARY) {
    assert.ok(m.brand && m.generic, m.brand);
    assert.ok(m.cls.length && m.cls.every((c) => DRUG_CLASSES[c]), m.brand);
    assert.ok([1, 2, 3, 4, 5, 6, 8].includes(m.freq), m.brand);
  }
  assert.equal(SEED_FORMULARY.find((m) => m.brand === "Simbrinza").lu, "393");
});
