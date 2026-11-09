// Stress test for drug name recognition, both ways.
//
// Misspellings: every drug name on the list, misspelled many ways (a letter
// dropped, doubled, swapped or changed, a vowel wrong, ph for f, c for k, the
// name shortened, two slips in a long name, the space left out), in a line
// with a dose. Each should be read as the right drug, never as another one.
//
// Not drugs: ordinary words, eye exam words, oral medicines and made-up words
// in the same position. None should become a drug.
//
//   node scripts/spelling-bench.mjs [--misses]
import { parseNote } from "../src/lib/noteParser.js";
import { SEED_FORMULARY as F } from "../src/data/formulary.js";
import { knownNames } from "../src/lib/spelling.js";

let seed = 7;
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const VOWELS = "aeiou";

function variants(name) {
  const out = new Set();
  const w = name;
  const letters = [...w].map((c, i) => (/[a-z]/i.test(c) ? i : -1)).filter((i) => i > 0);
  for (const i of letters) {
    if (i < w.length - 1) out.add(w.slice(0, i) + w.slice(i + 1)); // dropped
    out.add(w.slice(0, i) + w[i] + w.slice(i)); // doubled
    if (i < w.length - 1 && /[a-z]/i.test(w[i + 1])) out.add(w.slice(0, i) + w[i + 1] + w[i] + w.slice(i + 2)); // swapped
    if (VOWELS.includes(w[i].toLowerCase())) out.add(w.slice(0, i) + VOWELS[(VOWELS.indexOf(w[i].toLowerCase()) + 2) % 5] + w.slice(i + 1)); // vowel
  }
  if (/ph/i.test(w)) out.add(w.replace(/ph/i, "f"));
  if (/c/i.test(w.slice(1))) out.add(w[0] + w.slice(1).replace(/c/i, "k"));
  if (/k/i.test(w.slice(1))) out.add(w[0] + w.slice(1).replace(/k/i, "c"));
  const plain = w.replace(/[^A-Za-z]/g, "");
  if (plain.length >= 7) out.add(plain.slice(0, Math.max(4, Math.ceil(plain.length * 0.6)))); // shortened
  if (/[\s-]/.test(w)) out.add(w.replace(/[\s-]/g, "")); // space left out
  if (plain.length >= 10) {
    const i = 2 + Math.floor(rand() * (w.length - 6));
    out.add(w.slice(0, i) + w.slice(i + 1, i + 3) + w.slice(i + 4)); // two slips
  }
  out.delete(w);
  return [...out].filter((v) => v.replace(/[^A-Za-z]/g, "").length >= 4);
}

const NOT_DRUGS = `patient pressure vision stable return review refill repeat routine improved better worse discussed cataract glaucoma laser
phaco trabeculectomy cornea retina macula lids lashes scrubs compress tears artificial bottle shake minutes hours dilated exam clinic
office surgery inflammation infection discharge redness burning itching blurry floaters flashes halos glare headache nausea vomiting
appointment schedule booked tomorrow yesterday morning evening weekend weekday monday friday insurance pharmacy coverage cost generic
husband daughter caregiver nurse resident fellow scribe technician optometrist eyelid tearing contact lenses glasses spectacles reading
driving computer screen sunlight sunglasses shield patch bandage stitches sutures wound incision bleb tube shunt implant lens capsule
metformin insulin aspirin warfarin apixaban atorvastatin lipitor ramipril amlodipine prednisone acetazolamide diamox vitamin omega fish
oil tylenol advil ibuprofen acetaminophen melatonin zopiclone sertraline gabapentin tamsulosin flomax plaquenil hydroxychloroquine
xylitol zorbax quintel morvane belstat torrix plavid vintex ozmira kelphan drivon lumora cravex daltrin nexova pristel`.split(/\s+/);

const names = knownNames(F);
const tally = { variants: 0, right: 0, form: 0, wrong: 0, missed: 0, notDrugs: 0, falseDrugs: 0 };
// The active ingredient, so a different form of the same medicine (drops or
// gel, preserved or preservative free) is told apart from a different one.
const active = (brand) => F.find((m) => m.brand === brand)?.generic.split(/[\s\d(]/)[0].toLowerCase();
const misses = [];
for (const { text } of names) {
  const truth = parseNote(`${text} 1 gtt BID OU`, F).drops[0]?.brand;
  if (!truth) continue;
  for (const v of variants(text)) {
    tally.variants++;
    const got = parseNote(`${v} 1 gtt BID OU`, F).drops.map((d) => d.brand);
    if (got.length === 1 && got[0] === truth) tally.right++;
    else if (got.length === 1 && active(got[0]) === active(truth)) {
      tally.form++;
      misses.push(`form   ${v} -> ${got[0]} (should be ${truth})`);
    } else if (got.length) {
      tally.wrong++;
      misses.push(`WRONG  ${v} -> ${got.join(", ")} (should be ${truth})`);
    } else {
      tally.missed++;
      misses.push(`missed ${v} (${truth})`);
    }
  }
}
for (const word of NOT_DRUGS) {
  for (const line of [`${word} BID OU`, `Plan: ${word} daily OD`, `${word[0].toUpperCase()}${word.slice(1)} 1 gtt qid OS x 7 days`]) {
    tally.notDrugs++;
    const got = parseNote(line, F).drops.map((d) => d.brand);
    if (got.length) {
      tally.falseDrugs++;
      misses.push(`FALSE  "${line}" -> ${got.join(", ")}`);
    }
  }
}
const pct = (a, b) => `${((100 * a) / b).toFixed(1)}%`;
console.log(`Misspelled names: ${tally.variants}
  read as the right drug: ${tally.right} (${pct(tally.right, tally.variants)})
  same medicine, different form or strength: ${tally.form} (${pct(tally.form, tally.variants)})
  read as a different medicine: ${tally.wrong} (${pct(tally.wrong, tally.variants)})
  not recognised, listed for the clinician: ${tally.missed} (${pct(tally.missed, tally.variants)})
Words that are not eye drops, in a dosing line: ${tally.notDrugs}
  turned into a drug: ${tally.falseDrugs}`);
if (process.argv.includes("--misses")) console.log(misses.join("\n"));
