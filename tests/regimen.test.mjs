// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { toEntries, newSlot, dosesOnDay, lastDayIndex, TAPER_PRESETS, FREQ_OPTIONS } from "../src/lib/regimen.js";
import { sigText, patientInstruction } from "../src/lib/wording.js";
import { doseTimes, fmtTime } from "../src/lib/times.js";
import { dropWarnings } from "../src/lib/checks.js";
import { SEED_FORMULARY, DRUG_CLASSES } from "../src/data/formulary.js";
import { scheduleSpan, courseLastDay } from "../src/lib/calendar.js";
import { buildICS, eventIds } from "../src/lib/ics.js";
import { encodeRegimen, decodeRegimen, codeFromUrl } from "../src/lib/share.js";
import { cleanFormulary } from "../src/lib/validate.js";
import { doseGroups, upcomingReminders, doseDayIndex, minutesInto, nextDose } from "../src/lib/doses.js";
import { planId } from "../src/lib/hash.js";
import { changeNotes } from "../src/lib/changes.js";

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
  assert.equal(sigText(x, true), "Instill 1 drop in both eyes once daily at bedtime.");
  assert.equal(patientInstruction(x, true), "1 drop in both eyes, once a day at bedtime.");
  const pf = s({ brand: "Pred Forte", eye: "OS", mode: "taper", steps: taper.slice(0, 2) });
  assert.equal(sigText(pf), "Instill 1 drop in the left eye 4 times daily for 7 days, then 3 times daily for 7 days, then stop.");
  const late = s({ brand: "Combigan", eye: "OD", startDay: 3 });
  assert.equal(sigText(late, false, new Date(2026, 10, 2)), "Starting Nov 4, 2026, instill 1 drop in the right eye twice daily.");
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
  // One beta blocker in each eye is still flagged, because both are absorbed.
  assert.deepEqual(dropWarnings([s({ brand: "Cosopt", eye: "OS" }), s({ brand: "Combigan", eye: "OD" })], SEED_FORMULARY, DRUG_CLASSES), [
    "Cosopt and Combigan both contain a beta blocker. Two topical beta blockers are not recommended.",
  ]);
});

test("ongoing drops print for whole calendar months from the start date", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 })]);
  assert.equal(scheduleSpan(e, 1, new Date(2026, 10, 15)).end.toDateString(), "Mon Dec 14 2026");
  assert.equal(scheduleSpan(e, 1, new Date(2026, 10, 16)).end.toDateString(), "Tue Dec 15 2026");
  assert.equal(scheduleSpan(e, 1, new Date(2027, 0, 31)).end.toDateString(), "Sat Feb 27 2027");
  assert.equal(scheduleSpan(e, 2, new Date(2026, 9, 31)).days, 61);
});

test("calendar file has one alarm per dose time", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 }), s({ brand: "Cosopt", freq: 2 })]);
  const ics = buildICS({ entries: e, formulary: SEED_FORMULARY, start: new Date(2026, 10, 2), wake: "08:00", bed: "22:00", from: new Date(2026, 10, 1) });
  // Ongoing drops repeat daily with no end date.
  // Three repeating dose alarms for six months, plus one alert to renew them.
  assert.equal((ics.match(/BEGIN:VEVENT/g) || []).length, 4);
  assert.equal((ics.match(/RRULE:FREQ=DAILY;UNTIL=20270502T235900/g) || []).length, 3);
  assert.match(ics, /Renew your eye drop alarms/);
  assert.match(ics, /DTSTART:20261102T220000/);
  assert.match(ics, /DTSTAMP:\d{8}T\d{6}Z/);
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
  const lu = (b) => SEED_FORMULARY.find((m) => m.brand === b).lu;
  assert.deepEqual(lu("Simbrinza"), ["393", "466"]);
  assert.deepEqual(lu("Xalatan"), ["171", "172", "387"]);
  assert.deepEqual(lu("Pred Forte"), []);
  const freq = (b) => SEED_FORMULARY.find((m) => m.brand === b).freq;
  assert.equal(freq("Alphagan-P"), 3);
  assert.equal(freq("Vigamox"), 3);
  assert.ok(!SEED_FORMULARY.some((m) => ["Betagan", "Trusopt-PF"].includes(m.brand)));
});

test("malformed or oversized phone links are rejected", () => {
  const bad = [
    "", "!!!", "x".repeat(5000),
    btoa(JSON.stringify({ v: 1, s: "2026-13-40", w: "08:00", b: "22:00", e: [] })),
    btoa(JSON.stringify({ v: 1, s: "2026-11-02", w: "08:00", b: "22:00", e: [["X", "", "", "solution", 0, "OD", 1, "d", 4, 99999, 1, 0]] })),
    btoa(JSON.stringify({ v: 1, s: "2026-11-02", w: "08:00", b: "22:00", e: [["X", "", "", "solution", 0, "ZZ", 1, "o", 2, 7, 1, 0]] })),
  ].map((c) => c.replace(/=+$/, ""));
  for (const code of bad) assert.throws(() => decodeRegimen(code), code);
});

test("imported formularies are cleaned", () => {
  const list = cleanFormulary([
    { brand: " Test ", generic: "<b>x</b>", cls: ["PGA", "NOPE"], freq: 99, cap: "neon", lu: 123, extra: "dropped" },
    { brand: "test" },
    { generic: "no brand" },
  ]);
  assert.equal(list.length, 1);
  assert.deepEqual(list[0].cls, ["PGA"]);
  assert.equal(list[0].freq, 2);
  assert.equal(list[0].cap, "");
  assert.deepEqual(list[0].lu, ["123"]);
  assert.ok(!("extra" in list[0]));
  assert.equal(cleanFormulary("nonsense"), null);
});

const plan = (e, start = "2026-11-02", wake = "08:00", bed = "22:00") =>
  encodeRegimen({ entries: toEntries(e), formulary: SEED_FORMULARY, start, wake, bed });
const raw = (entry) => Buffer.from(JSON.stringify({ v: 1, s: "2026-11-02", w: "08:00", b: "22:00", e: [entry] })).toString("base64url");

test("a weekly taper never uses an unsupported frequency or doubles a daily drop", () => {
  const from8 = TAPER_PRESETS[0].build(8);
  assert.deepEqual(from8.map((x) => x.freq), [8, 6, 5, 4, 3, 2, 1]);
  assert.ok(from8.every((x) => FREQ_OPTIONS.includes(x.freq)));
  assert.deepEqual(TAPER_PRESETS[0].build(1), [{ freq: 1, days: 7 }]);
  const code = plan([s({ brand: "Pred Forte", eye: "OS", mode: "taper", steps: from8 })]);
  assert.doesNotThrow(() => decodeRegimen(code));
});

test("different plans never share check marks or calendar events", () => {
  const a = plan([s({ brand: "Xalatan", freq: 1 })]);
  const b = plan([s({ brand: "Atropine", freq: 3 })]);
  assert.equal(a.slice(0, 48), b.slice(0, 48));
  assert.notEqual(planId(a), planId(b));
});

test("an ongoing drop never finishes on the phone", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 }), s({ brand: "Vigamox", freq: 3, mode: "duration", durationDays: 7 })]);
  assert.equal(courseLastDay(e), null);
  assert.equal(dosesOnDay(e[0], 2000), 1);
  const reminders = upcomingReminders(
    { entries: e, formulary: SEED_FORMULARY, start: new Date(2026, 10, 2), days: 5000, wake: "08:00", bed: "22:00" },
    new Date(2029, 0, 1),
    5
  );
  assert.equal(reminders.length, 5);
});

test("bedtime after midnight lands on the next date everywhere", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 })]);
  const ics = buildICS({ entries: e, formulary: SEED_FORMULARY, start: new Date(2027, 2, 12), wake: "08:00", bed: "00:30", from: new Date(2027, 2, 1) });
  assert.match(ics, /DTSTART:20270313T003000/);
  assert.doesNotMatch(ics, /DTSTART:20270312T003000/);
  const next = upcomingReminders({ entries: e, formulary: SEED_FORMULARY, start: new Date(2027, 2, 12), days: 3, wake: "08:00", bed: "00:30" }, new Date(2027, 2, 12, 9), 1);
  assert.equal(next[0].at.toString(), new Date(2027, 2, 13, 0, 30).toString());
});

test("a short waking day never gives two doses at the same time", () => {
  const t = doseTimes(4, "22:00", "23:00");
  assert.equal(new Set(t).size, 4);
});

test("tapers and bedtime agree between the sig and the dose times", () => {
  const x = s({ brand: "Xalatan", mode: "taper", steps: [{ freq: 2, days: 7 }, { freq: 1, days: 7 }] });
  const g = doseGroups([x], SEED_FORMULARY, 10, "08:00", "22:00");
  assert.equal(fmtTime(g[0].time), "8:00 AM");
  assert.match(sigText(x, true), /once daily for 7 days/);
});

test("drops due together go solutions first and gels last", () => {
  const e = toEntries([s({ brand: "Timoptic-XE", freq: 1 }), s({ brand: "Pred Forte", freq: 1 }), s({ brand: "Xalatan", freq: 1, mode: "duration" })]);
  const g = doseGroups(e, SEED_FORMULARY.map((m) => ({ ...m, qhs: false })), 0, "08:00", "22:00");
  assert.deepEqual(g[0].items.map((it) => it.entry.brand), ["Xalatan", "Pred Forte", "Timoptic-XE"]);
});

test("phone links with any out-of-range value are rejected, not repaired", () => {
  for (const entry of [
    ["Cosopt", "", "", "solution", 0, "OD", 1, "o", 99999, 7, 1, 0],
    ["Cosopt", "", "", "solution", 0, "OD", 50, "o", 2, 7, 1, 0],
    ["Vigamox", "", "", "solution", 0, "OS", 1, "d", 3, 1e9, 1, 0],
    ["Cosopt", "", "", "solution", 0, "OD", 1, "o", 2.5, 7, 1, 0],
    ["X", "", "", "solution", 0, "OD", 1, "t", 2, 7, 1, [[2, 300], [1, 300]]],
  ])
    assert.throws(() => decodeRegimen(raw(entry)));
  const bidi = decodeRegimen(raw(["\u202Eabc", "", "", "solution", 0, "OD", 1, "o", 2, 7, 1, 0]));
  assert.equal(bidi.entries[0].brand, "abc");
});

test("pasted links are recognised even when wrapped or encoded", () => {
  const code = plan([s({ brand: "Xalatan", freq: 1 })]);
  const url = `https://eyedroptracker.com/#/p/${code}`;
  assert.equal(codeFromUrl(url.slice(0, 40) + "\n" + url.slice(40)), code);
  assert.equal(codeFromUrl(url.replace("#", "%23")), code);
  assert.equal(codeFromUrl(code), code);
  assert.equal(codeFromUrl("hello"), null);
  assert.equal(codeFromUrl("> " + url.slice(0, 30) + "\n> " + url.slice(30)), code);
  assert.equal(codeFromUrl(url.slice(0, 30) + "=\n" + url.slice(30)), code);
  assert.equal(codeFromUrl("Your plan: " + url + " Reply STOP to opt out"), code);
  assert.equal(codeFromUrl(url.slice(0, 50) + "\u200B" + url.slice(50)), code);
});

test("safety checks", () => {
  const w = (drops, opts) => dropWarnings(drops, SEED_FORMULARY, DRUG_CLASSES, opts);
  assert.ok(w([s({ brand: "Timoptic", eye: "OD" }), s({ brand: "Combigan", eye: "OS" })]).some((x) => /two topical beta blockers/i.test(x)));
  assert.ok(w([s({ brand: "Alphagan-P", eye: "OU", freq: 2 })], { dob: "2020-01-01", today: new Date(2026, 10, 1) }).some((x) => /brimonidine/.test(x)));
  assert.ok(w([s({ brand: "Xalatan", freq: 2 })]).some((x) => /label maximum is once/.test(x)));
  assert.ok(w([s({ brand: "Pilocarpine", freq: 4 }), s({ brand: "Atropine", freq: 3 })]).some((x) => /miotic/.test(x)));
  assert.ok(w([s({ brand: "Durezol", freq: 4 }), s({ brand: "Nevanac", freq: 3 }), s({ brand: "Pred Forte" })]).some((x) => /an? corticosteroid/.test(x)));
  assert.ok(w([s({ brand: "Nevanac" }), s({ brand: "Prolensa", freq: 1 })]).some((x) => /an nsaid/.test(x)));
});

test("change notes name the day a drop changes or stops", () => {
  const e = toEntries([
    s({ brand: "Pred Forte", eye: "OS", mode: "taper", steps: [{ freq: 4, days: 7 }, { freq: 3, days: 7 }] }),
    s({ brand: "Vigamox", eye: "OS", freq: 3, mode: "duration", durationDays: 7 }),
  ]);
  const notes = changeNotes(e, new Date(2026, 10, 2), 1, 8, { thisWeek: false });
  assert.deepEqual(notes, ["From Mon Nov 9: Pred Forte 3 times a day", "Vigamox: last dose Sun Nov 8"]);
});

test("a warning that applies to both eyes is shown once", () => {
  const w = dropWarnings([s({ brand: "Azarga", eye: "OU" }), s({ brand: "Simbrinza", eye: "OU" })], SEED_FORMULARY, DRUG_CLASSES);
  assert.deepEqual(w, ["Azarga and Simbrinza both contain a carbonic anhydrase inhibitor (both eyes)."]);
});

test("links carry a check code: any change is refused", () => {
  const code = encodeRegimen({ entries: toEntries([s({ brand: "Xalatan", freq: 1 })]), formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", nonce: "abcd1234" });
  assert.doesNotThrow(() => decodeRegimen(code));
  const o = JSON.parse(Buffer.from(code, "base64url").toString());
  o.e[0][8] = 4;
  assert.throws(() => decodeRegimen(Buffer.from(JSON.stringify(o)).toString("base64url")));
  // A change is either refused or decodes to exactly the same plan (the last
  // character of a code can carry unused padding bits).
  const same = JSON.stringify(decodeRegimen(code));
  for (let i = 0; i < code.length; i++)
    for (const ch of "AZaz09-_") {
      if (code[i] === ch) continue;
      let plan = null;
      try {
        plan = decodeRegimen(code.slice(0, i) + ch + code.slice(i + 1));
      } catch {
        continue;
      }
      assert.equal(JSON.stringify(plan), same);
    }
});

test("identical plans for two patients get different identities", () => {
  const e = toEntries([s({ brand: "Xalatan", freq: 1 })]);
  const a = encodeRegimen({ entries: e, formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", nonce: "aaaa1111" });
  const b = encodeRegimen({ entries: e, formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", nonce: "bbbb2222" });
  assert.notEqual(planId(a), planId(b));
});

test("after midnight the phone stays on the dose day", () => {
  const start = new Date(2026, 10, 2);
  assert.equal(doseDayIndex(start, new Date(2026, 10, 3, 0, 40), "08:00"), 0);
  assert.equal(doseDayIndex(start, new Date(2026, 10, 3, 2, 30), "08:00"), 1);
  assert.equal(doseDayIndex(start, new Date(2026, 10, 3, 7, 50), "20:00"), 0);
  assert.equal(minutesInto(start, 0, new Date(2026, 10, 3, 0, 40)), 1480);
});

test("a missed dose is not offered when the next dose of that drug is due", () => {
  const cosopt = s({ brand: "Cosopt", freq: 2 });
  const items = [{ entry: cosopt, dose: 0, time: 480 }, { entry: cosopt, dose: 1, time: 1200 }];
  const none = () => false;
  assert.equal(nextDose(items, none, 1230).item.time, 1200);
  assert.equal(nextDose(items, none, 1230).missed.size, 1);
  assert.equal(nextDose(items, (it) => it.time === 1200, 1230).item, null);
  const morning = nextDose(items, (it) => it.time === 480, 500);
  assert.equal(morning.state, "later");
});

test("every default formulary entry survives cleaning unchanged", async () => {
  const { SEED_FORMULARY } = await import("../src/data/formulary.js");
  const { cleanFormulary } = await import("../src/lib/validate.js");
  const clean = cleanFormulary(SEED_FORMULARY);
  assert.equal(clean.length, SEED_FORMULARY.length);
  assert.deepEqual(clean, SEED_FORMULARY);
});

test("a reopened plan keeps its start date and plan ID", async () => {
  const { encodeRegimen, decodeRegimen } = await import("../src/lib/share.js");
  const { SEED_FORMULARY } = await import("../src/data/formulary.js");
  const entries = [{ brand: "Pred Forte", eye: "OD", drops: 1, mode: "taper", freq: 4, durationDays: 7, startDay: 1, steps: [{ freq: 4, days: 7 }, { freq: 2, days: 7 }] }];
  const first = decodeRegimen(encodeRegimen({ entries, formulary: SEED_FORMULARY, start: "2026-10-20", wake: "08:00", bed: "22:00", nonce: "abc12345" }));
  const changed = first.entries.map((e) => ({ ...e, steps: [e.steps[0], { freq: 3, days: 14 }] }));
  const again = decodeRegimen(encodeRegimen({ entries: changed, formulary: SEED_FORMULARY, start: first.start, wake: first.wake, bed: first.bed, nonce: first.nonce }));
  assert.equal(again.nonce, "abc12345");
  assert.equal(again.start, "2026-10-20");
  assert.deepEqual(again.entries[0].steps, [{ freq: 4, days: 7 }, { freq: 3, days: 14 }]);
});

test("a changed plan keeps check marks, and another patient's plan starts fresh", async () => {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  const { adoptPlan, patientKey } = await import("../src/lib/patientStore.js");
  const base = { brand: "Pred Forte", eye: "OD", drops: 1, mode: "taper", freq: 4, durationDays: 7, startDay: 1 };
  const make = (steps, nonce) => {
    const code = encodeRegimen({ entries: [{ ...base, steps }], formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", nonce });
    return { code, plan: decodeRegimen(code) };
  };
  const ticks = { "2026-11-02": { "Pred Forte|OD|0": 1 } };
  const a = make([{ freq: 4, days: 7 }, { freq: 2, days: 7 }], "pat00001");
  adoptPlan(a.code, a.plan);
  store.set(`edt.taken.${patientKey(a.plan, a.code)}`, JSON.stringify(ticks));
  store.set(`edt.alarms.${patientKey(a.plan, a.code)}`, "true");
  // Changed at follow-up with Change a plan, so the same patient code.
  const b = make([{ freq: 4, days: 7 }, { freq: 3, days: 14 }], "pat00001");
  adoptPlan(b.code, b.plan);
  const kb = patientKey(b.plan, b.code);
  assert.deepEqual(JSON.parse(store.get(`edt.taken.${kb}`)), ticks);
  assert.equal(store.get(`edt.alarms.${kb}`), "true");
  assert.equal(store.get("edt.patientPlan"), b.code);
  // A plan with another patient code, perhaps another person on this phone.
  const c = make([{ freq: 4, days: 7 }], "pat00002");
  adoptPlan(c.code, c.plan);
  assert.equal(store.get(`edt.taken.${patientKey(c.plan, c.code)}`), undefined);
  delete globalThis.localStorage;
});

test("the chart note holds the plan and a link that reopens it", async () => {
  const { chartNote } = await import("../src/lib/chartNote.js");
  const entries = [{ brand: "Xalatan", eye: "OU", drops: 1, mode: "ongoing", freq: 1, durationDays: 7, startDay: 1, steps: [] }];
  const code = encodeRegimen({ entries, formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", nonce: "chart001" });
  const note = chartNote({ entries, formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", link: `https://eyedroptracker.com/#/p/${code}` });
  assert.match(note, /Xalatan \(Latanoprost 0\.005%\): Instill 1 drop in both eyes once daily at bedtime\./);
  assert.match(note, /8:00 AM to 10:00 PM/);
  assert.equal(codeFromUrl(note), code);
});

test("a new calendar file cancels alarms the changed plan no longer has", () => {
  const base = { formulary: SEED_FORMULARY, start: new Date(2026, 10, 2), wake: "08:00", bed: "22:00", from: new Date(2026, 10, 1), id: "abcd1234" };
  const slot = (brand, freq) => ({ ...newSlot(), brand, eye: "OU", freq, mode: "ongoing" });
  const before = eventIds(buildICS({ ...base, entries: toEntries([slot("Xalatan", 1), slot("Timoptic", 2)]) }));
  const entries = toEntries([slot("Xalatan", 1)]);
  const fresh = new Set(eventIds(buildICS({ ...base, entries })));
  const cancel = before.filter((u) => !fresh.has(u));
  assert.ok(cancel.length > 0);
  const ics = buildICS({ ...base, entries, cancel });
  assert.equal((ics.match(/STATUS:CANCELLED/g) || []).length, cancel.length);
  for (const u of fresh) assert.ok(!cancel.includes(u));
});

test("a steroid course longer than two weeks asks for a pressure check", () => {
  const w = (d) => dropWarnings([{ ...newSlot(), ...d }], SEED_FORMULARY, DRUG_CLASSES).join(" ");
  assert.match(w({ brand: "Pred Forte", eye: "OD", mode: "taper", steps: [{ freq: 4, days: 7 }, { freq: 3, days: 7 }, { freq: 2, days: 7 }] }), /pressure check/);
  assert.doesNotMatch(w({ brand: "Pred Forte", eye: "OD", mode: "duration", freq: 4, durationDays: 7 }), /pressure check/);
});

test("the same drug twice is flagged only when the courses overlap", () => {
  const dup = (w) => w.filter((x) => x.includes("listed twice"));
  // Twice a day for 8 days, then once a day from day 9: a planned step down.
  const stepDown = [
    s({ brand: "Maxidex", eye: "OS", freq: 2, mode: "duration", durationDays: 8 }),
    s({ brand: "Maxidex", eye: "OS", freq: 1, mode: "duration", durationDays: 14, startDay: 9 }),
  ];
  assert.deepEqual(dup(dropWarnings(stepDown, SEED_FORMULARY, DRUG_CLASSES)), []);
  // Both on the same days: flagged once.
  const both = [s({ brand: "Xalatan", eye: "OS" }), s({ brand: "Xalatan", eye: "OS", freq: 2 })];
  assert.deepEqual(dup(dropWarnings(both, SEED_FORMULARY, DRUG_CLASSES)), ["Xalatan is listed twice for the left eye."]);
});

test("the chart note keeps every line short and its plan link still reads whole", async () => {
  const { chartNote } = await import("../src/lib/chartNote.js");
  const { encodeRegimen, decodeRegimen, codeFromUrl } = await import("../src/lib/share.js");
  const entries = toEntries([s({ brand: "Xalatan", eye: "OU" }), s({ brand: "Cosopt", eye: "OD", freq: 2 }), s({ brand: "Pred Forte", eye: "OD", freq: 4, mode: "duration", durationDays: 14 })]);
  const settings = { start: "2026-11-02", wake: "08:00", bed: "22:00" };
  const code = encodeRegimen({ entries, formulary: SEED_FORMULARY, ...settings, nonce: "abcd1234" });
  const note = chartNote({ entries, formulary: SEED_FORMULARY, ...settings, link: `https://eyedroptracker.com/#/p/${code}` });
  // No line in the link is long enough to widen the Oscar encounter page.
  const linkLines = note.split("\n").slice(note.split("\n").findIndex((l) => l.startsWith("Plan link")) + 1);
  assert.ok(linkLines.every((l) => l.length <= 64), "link lines are short");
  assert.equal(codeFromUrl(note), code);
  // Text the clinician writes after the plan is not read as part of the link.
  assert.equal(codeFromUrl(`${note}\nRTC 6 weeks, IOP check.`), code);
  assert.equal(decodeRegimen(codeFromUrl(note)).nonce, "abcd1234");
});

test("a plan link pasted with its line breaks turned into spaces still opens", async () => {
  const { chartNote } = await import("../src/lib/chartNote.js");
  const { encodeRegimen, codeFromUrl } = await import("../src/lib/share.js");
  const entries = toEntries([s({ brand: "Xalatan", eye: "OU" }), s({ brand: "Cosopt", eye: "OD", freq: 2 }), s({ brand: "Vigamox", eye: "OS", freq: 4, mode: "duration", durationDays: 7 })]);
  const settings = { start: "2026-11-02", wake: "08:00", bed: "22:00" };
  const code = encodeRegimen({ entries, formulary: SEED_FORMULARY, ...settings, nonce: "spaces01" });
  const note = chartNote({ entries, formulary: SEED_FORMULARY, ...settings, link: `https://eyedroptracker.com/#/p/${code}` });
  const block = note.slice(note.indexOf("https://"));
  // A paste box turns the line breaks into spaces.
  assert.equal(codeFromUrl(block.replace(/\n/g, " ")), code);
  // The link lines alone, without the end marker, with text after them.
  const lines = block.split("\n").filter((l) => !l.startsWith("("));
  assert.equal(codeFromUrl(`${lines.join(" ")} RTC 6 weeks`), code);
  // A single-line link still works.
  assert.equal(codeFromUrl(`see https://eyedroptracker.com/#/p/${code} thanks`), code);
});
