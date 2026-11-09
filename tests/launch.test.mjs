// Run with: npm test
import { test } from "node:test";
import assert from "node:assert/strict";
import { differentPerson, sameName } from "../src/lib/samePerson.js";
import { searchFormulary, soleMatch } from "../src/lib/drugSearch.js";
import { SEED_FORMULARY } from "../src/data/formulary.js";

test("a typo fix, reordered name or added detail is the same person", () => {
  assert.ok(sameName("Firstpatient, Ann", "Ann Firstpatient"));
  assert.ok(sameName("Firstpatient, Ann", "Firstpatent, Ann"));
  assert.ok(sameName("Ann", "Ann Firstpatient"));
  assert.ok(sameName("Zoë Testcase", "zoe testcase"));
  assert.ok(sameName("", "Anyone"));
});

test("another name or date of birth is a different person", () => {
  assert.equal(sameName("Firstpatient, Ann", "Secondpatient, Bob"), false);
  assert.equal(sameName("Sample, John", "Sample, Mary"), false);
  assert.ok(differentPerson({ name: "Sample, John", dob: "1950-01-01" }, { name: "Sample, John", dob: "1951-01-01" }));
  assert.ok(differentPerson({ name: "Sample, John", dob: "" }, { name: "Other, Kim", dob: "" }));
  assert.equal(differentPerson({ name: "", dob: "" }, { name: "Other, Kim", dob: "1960-01-01" }), false, "blank details are filled in, not a new person");
  assert.equal(differentPerson({ name: "Sample, John", dob: "1950-01-01" }, { name: "", dob: "" }), false);
});

const first = (q) => searchFormulary(SEED_FORMULARY, q)[0].brand;

test("a generic name puts the usual product first", () => {
  assert.equal(first("latan"), "Xalatan");
  assert.equal(first("latanoprost"), "Xalatan");
  assert.equal(first("timolol"), "Timoptic");
  assert.equal(first("brimo"), "Alphagan");
  assert.equal(first("pred"), "Pred Forte");
  const latan = searchFormulary(SEED_FORMULARY, "latan").map((m) => m.brand);
  assert.ok(latan.indexOf("Monoprost") > latan.indexOf("Xalatan"), "preservative free after the usual product");
  assert.ok(latan.indexOf("Xalacom") > latan.indexOf("Monoprost"), "combinations last");
});

test("Enter alone picks only a single match or an exact name", () => {
  const pick = (q) => soleMatch(searchFormulary(SEED_FORMULARY, q), q)?.brand ?? null;
  assert.equal(pick("latan"), null);
  assert.equal(pick("timolol"), null);
  assert.equal(pick("brimo"), null);
  assert.equal(pick("Timoptic"), "Timoptic");
  assert.equal(pick("vigamox"), "Vigamox");
  assert.equal(pick(""), null);
});
