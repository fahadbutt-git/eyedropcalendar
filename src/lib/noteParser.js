// Reads eye drop orders out of chart note shorthand ("Maxidex QID OS x1wk
// then BID x1wk", "on 0/2 (brimonidine, dorzolamide left)") and returns
// draft drops for the clinician to check. Nothing here is trusted: every
// value the note did not state outright carries a flag that says what was
// assumed, and drugs the note mentions in the past tense or as an allergy
// are listed but left out.
//
// The result is a draft only. It reaches a patient only after a clinician
// has checked each drop in Eye Drop Tracker.
import { FREQ_OPTIONS, TAPER_PRESETS } from "./regimen.js";

const MAX_DAYS = 365;

// Names clinicians write that the formulary does not spell out. Combination
// names come first so "dorzolamide-timolol" is not read as two drugs.
const EXTRA_NAMES = [
  ["brimonidine[-/ ]+timolol|brimo[-/ ]?tim", "Combigan"],
  ["dorzolamide[-/ ]+timolol|dorz(?:o)?[-/ ]?tim(?:olol)?", "Cosopt"],
  ["latanoprost[-/ ]+timolol", "Xalacom"],
  ["travoprost[-/ ]+timolol|travoprost[-/ ]?timop", "DuoTrav PQ"],
  ["brinzolamide[-/ ]+brimonidine", "Simbrinza"],
  ["brinzolamide[-/ ]+timolol", "Azarga"],
  ["tobramycin[-/ ]+dexamethasone|tobra[-/ ]?dex", "TobraDex"],
  ["pred(?:nisolone)?\\s*forte|prednisolone(?:\\s+acetate)?", "Pred Forte"],
  ["brimo", "Alphagan"],
  ["dorzo", "Dorzolamide"],
  ["moxi(?:floxacin)?", "Vigamox"],
  ["ketorolac", "Acular"],
  ["difluprednate", "Durezol"],
  ["lumigan", "Lumigan RC"],
  ["travatan", "Travatan Z"],
  ["duotrav", "DuoTrav PQ"],
  ["iso?pto\\s*atropine", "Atropine"],
  ["cyclopentolate", "Cyclogyl"],
];

// Mentioned often in eye notes but not eye drops on the calendar. They are
// reported so the clinician knows they were seen and left out.
const NOT_DROPS = [
  ["acetazolamide|diamox|methazolamide", "taken by mouth"],
  ["artificial tears|tear gel|tears|lubricant|refresh|systane|hylo|genteal|thera ?tears|lacrilube", "lubricant, not in the drug list"],
  // "AT" and "ATs" only in capitals, so "at bedtime" is not read as tears.
  ["\\bATs?\\b", "lubricant, not in the drug list", ""],
];

const PAST = /\b(allerg\w*|intoleran\w*|previously|prior(?:ly)?|failed|was on|were on|history of|hx of|switched from|reaction to|stopped (?:due|because)|in the past)\b/i;
const STOP = /\b(stop|stopped|d\/c|dc'?d|discontinue[ds]?|discontinued|hold|held|cease)\b/i;
const PRN = /\b(prn|as needed|as required|when needed)\b/i;

const FREQS = [
  [/\bq\.?\s?2\s?h(?:r|rs|ours?)?\b|\bevery 2 hours\b/i, 8, "Every 2 hours was read as 8 times a day."],
  [/\bq\.?\s?3\s?h(?:r|rs|ours?)?\b|\bevery 3 hours\b/i, 6, "Every 3 hours was read as 6 times a day."],
  [/\bq\.?\s?4\s?h(?:r|rs|ours?)?\b|\bevery 4 hours\b/i, 4, "Every 4 hours was read as 4 times a day while awake."],
  [/\b([2-8])\s?(?:x|times)\s?(?:\/|a|per)?\s?(?:day|d|daily)\b|\bx\s?([2-8])\s?\/\s?(?:day|d)\b/i, null],
  [/\bq\.?i\.?d\.?(?![a-z])|\bfour times\b/i, 4],
  [/\bt\.?i\.?d\.?(?![a-z])|\bthree times\b/i, 3],
  [/\bb\.?i\.?d\.?(?![a-z])|\bbd\b|\btwice\b/i, 2],
  [/\bq\.?h\.?s\.?(?![a-z])|\bnightly\b|\bat bedtime\b|\bat night\b/i, 1],
  [/\bq\.?d\.?(?![a-z])|\bq\s?am\b|\bq\s?pm\b|\bdaily\b|\bonce a day\b|\bonce\b|\bqday\b|\bevery day\b/i, 1],
];

// Abbreviations count only in capitals, so "to be used", "re-check" and
// "Os" in a sentence are not read as an eye. "Right" and "left" count unless
// they are part of a phrase such as "right away" or "left over".
const SIDE_PHRASE = "(?!\\s*(?:away|now|after|before|here|there|over|behind|alone|side of)\\b)";
const EYE_WORDS = [
  [/\bOU\b|\bBE\b/, /\bboth eyes\b|\bbilateral(?:ly)?\b/i, "OU"],
  [/\bOD\b|\bRE\b/, new RegExp(`\\bright\\b${SIDE_PHRASE}`, "i"), "OD"],
  [/\bOS\b|\bLE\b/, new RegExp(`\\bleft\\b${SIDE_PHRASE}`, "i"), "OS"],
];
// "OD" also means once daily, which is why ISMP Canada lists it as error-prone.
const OD_ALONE = /\bOD\b/;
// Hourly drops (keratitis, endophthalmitis) are more than the calendar can
// show, so they are left for the clinician to write by hand.
const HOURLY = /\bq\.?\s?(?:1\s?h(?:r|rs|ours?)?|30\s?min)\b|\bhourly\b|\bevery (?:hour|30 minutes|half hour)\b/i;
// Words that make a drop current even when the sentence also mentions the past.
const CURRENT = /\b(start|started|begin|continue|cont|restart|resume|use|add|new)\b/i;

const UNIT_DAYS = { d: 1, day: 1, days: 1, w: 7, wk: 7, wks: 7, week: 7, weeks: 7, mo: 30, month: 30, months: 30 };
const DURATION = /(?:\bx|×|\bfor)\s*(\d{1,3}|an?|one|two|three|four|five|six|seven|eight|ten|fourteen)\s*(days?|d|wks?|w|weeks?|mo|months?)\b/i;
const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fourteen: 14 };
const DROPS = /\b([1-3])\s*(?:gtts?|drops?)\b/i;

const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// The words a formulary entry can be found by: its brand, and the generic
// name without the strength ("Brimonidine 0.2%" gives "brimonidine").
function nameIndex(formulary) {
  const names = EXTRA_NAMES.map(([pattern, brand]) => ({ pattern, brand, extra: true }));
  for (const m of formulary) {
    // "Alphagan-P" is also written "Alphagan P" or "AlphaganP".
    names.push({ pattern: m.brand.split("-").map(escape).join("[- ]?"), brand: m.brand });
    // Combination products are found by their brand or a combined name only,
    // so "latanoprost" alone never means Xalacom.
    if (m.generic?.includes("/")) continue;
    const generic = m.generic?.split(/[\d(]/)[0].trim();
    if (generic && generic.length > 3) names.push({ pattern: escape(generic), brand: m.brand, generic: true });
  }
  return names.filter((n) => formulary.some((m) => m.brand === n.brand));
}

// One name can fit several formulary entries (brimonidine is Alphagan and
// Alphagan-P). A strength written in the note picks one, otherwise the
// first eye drop solution is used and flagged.
function chooseBrand(found, clause, formulary) {
  const candidates = formulary.filter((m) => found.some((f) => f.brand === m.brand));
  if (candidates.length === 1 || found.some((f) => f.extra || !f.generic)) {
    return { brand: (found.find((f) => !f.generic) || found[0]).brand, flag: null };
  }
  const strength = clause.match(/(\d*\.?\d+)\s*%/)?.[1];
  // Ointments, gels and preservative free versions are only chosen by name.
  const plain = candidates.filter((m) => !/ointment|gel|preservative|single-use/i.test(m.generic));
  const pool = plain.length ? plain : candidates;
  const byStrength = strength && (pool.find((m) => m.generic.includes(`${strength}%`)) || candidates.find((m) => m.generic.includes(`${strength}%`)));
  if (byStrength) return { brand: byStrength.brand, flag: null };
  const word = found[0].text.toLowerCase();
  const pick = pool.find((m) => m.aka.toLowerCase().startsWith(`generic ${word}`)) || pool[0];
  const strengths = new Set(pool.map((m) => m.generic.match(/[\d.]+%/)?.[0]));
  const flag = strengths.size > 1 ? `Strength: "${found[0].text}" comes in more than one strength, so ${pick.brand} (${pick.generic}) was chosen. Check the strength.` : null;
  return { brand: pick.brand, flag };
}

function findFreq(text) {
  for (const [re, freq, note] of FREQS) {
    const m = text.match(re);
    if (!m) continue;
    const n = freq ?? Number(m[1] || m[2]);
    const fit = FREQ_OPTIONS.includes(n) ? n : FREQ_OPTIONS.filter((f) => f <= n).pop();
    return { freq: fit, note: note || (fit !== n ? `The note says ${n} times a day. The calendar holds ${fit}, so ${fit} was used.` : null), at: m.index };
  }
  return null;
}

// Every eye named in the text, first one first.
function eyesIn(text) {
  const found = [];
  for (const [abbr, words, eye] of EYE_WORDS) {
    const at = Math.min(...[text.match(abbr), text.match(words)].filter(Boolean).map((m) => m.index));
    if (Number.isFinite(at)) found.push({ eye, at });
  }
  return found.sort((a, b) => a.at - b.at).map((f) => f.eye);
}
const findEye = (text) => eyesIn(text)[0] || null;

const findDays = (text) => {
  const m = text.match(DURATION);
  const n = WORD_NUMBERS[m?.[1].toLowerCase()] ?? Number(m?.[1]);
  return m ? Math.min(MAX_DAYS, n * UNIT_DAYS[m[2].toLowerCase()]) : null;
};

// "QID x1wk then TID x1wk then BID" gives steps, and an open-ended last part
// ("then QD until further instructions") is returned as the frequency that
// carries on after them.
function readSchedule(clause) {
  const parts = clause.split(/\bthen\b|->|→|,\s*(?=(?:q\.?i\.?d|t\.?i\.?d|b\.?i\.?d|q\.?d|daily|[2-8]\s?x)\b)/i);
  const steps = [];
  let after = null;
  let stops = false;
  for (const part of parts) {
    const f = findFreq(part);
    const days = findDays(part);
    if (/\b(stop|off|discontinue|d\/c)\b/i.test(part) && !f) {
      stops = true;
      break;
    }
    if (!f) continue;
    if (days) steps.push({ freq: f.freq, days, note: f.note });
    else {
      after = { freq: f.freq, note: f.note };
      break;
    }
  }
  return { steps, after, stops };
}

// Splits a note into sentences without breaking decimals ("0.5%") or
// abbreviations with dots ("b.i.d.").
function sentences(note) {
  const out = [];
  for (const line of note.split(/\r?\n/)) {
    let start = 0;
    const re = /[.;](?=\s+\S|\s*$)/g;
    let m;
    while ((m = re.exec(line))) {
      if (/\b[a-z]\.[a-z]$/i.test(line.slice(Math.max(0, m.index - 4), m.index))) continue;
      out.push(line.slice(start, m.index + 1));
      start = m.index + 1;
    }
    out.push(line.slice(start));
  }
  return out.map((s) => s.trim()).filter(Boolean);
}

// A numbered problem ("2. Left mild PXG") gives the eye for drops in it
// that do not name one.
const headingEye = (line) => {
  const m = line.match(/^\s*\d+[.)]\s*(.{0,60})/);
  return m ? findEye(m[1].split(/[.:]/)[0]) : null;
};

export function parseNote(note, formulary) {
  const names = nameIndex(formulary);
  const pattern = new RegExp(`(?<![\\w-])(${names.map((n) => n.pattern).sort((a, b) => b.length - a.length).join("|")})(?![\\w])`, "gi");
  const drops = [];
  const skipped = [];
  let sectionEye = null;

  for (const raw of String(note || "").split(/\r?\n/)) {
    // A numbered problem ("2. Left POAG") or an eye heading ("OD:") sets the
    // eye for the lines under it, until a blank line.
    const eyeHeading = raw.match(/^\s*(OD|OS|OU|RE|LE|BE|right eye|left eye|both eyes)\s*:/i);
    sectionEye = eyeHeading ? findEye(eyeHeading[1].length > 2 ? eyeHeading[1] : eyeHeading[1].toUpperCase()) : /^\s*\d+[.)]/.test(raw) ? headingEye(raw) : raw.trim() ? sectionEye : null;
    for (const sentence of sentences(raw)) {
      for (const [re, why, flags = "i"] of NOT_DROPS) {
        const m = sentence.match(new RegExp(re, flags));
        if (m && !skipped.some((s) => s.name.toLowerCase() === m[0].toLowerCase())) skipped.push({ name: m[0], why });
      }
      const mentions = [...sentence.matchAll(pattern)];
      // Each mention's own words run to the next mention.
      const items = mentions.map((m, i) => {
        const end = i + 1 < mentions.length ? mentions[i + 1].index : sentence.length;
        const text = m[0];
        const found = names.filter((n) => new RegExp(`^(?:${n.pattern})$`, "i").test(text)).map((n) => ({ ...n, text }));
        return { text, at: m.index, clause: sentence.slice(m.index + text.length, end), before: sentence.slice(0, m.index), found };
      });
      // "Xalatan (latanoprost 0.005%)" is one drug: the name in brackets
      // joins the one before it.
      for (let i = items.length - 2; i >= 0; i--) {
        if (/^\s*\($/.test(items[i].clause)) {
          const inner = items.splice(i + 1, 1)[0];
          items[i].clause += inner.text + inner.clause;
        }
      }
      // A list such as "(brimonidine, dorzolamide left)" shares the eye and
      // frequency written after its last drug.
      for (let i = items.length - 2; i >= 0; i--) {
        const gap = items[i].clause;
        if (/^[\s,/&+]*(?:and)?[\s,]*$/i.test(gap)) items[i].shared = items[i + 1].shared || items[i + 1];
      }
      for (const item of items) {
        const flags = [];
        let { brand, flag } = chooseBrand(item.found, item.clause, formulary);
        if (flag) flags.push(flag);
        const own = item.clause;
        const shared = item.shared?.clause || "";
        let med = formulary.find((m) => m.brand === brand);
        // A strength written straight after the name must match the drug
        // chosen. Atropine 0.01% is not atropine 1%.
        const stated = own.match(/^[\s(]*(\d*\.?\d+)\s*%/)?.[1];
        const hasStrength = (m) => new RegExp(`(^|[^\\d.])${stated.replace(".", "\\.")}%`).test(m.generic);
        // "Alphagan 0.15%" is Alphagan-P: the same drug in the strength the note names.
        const sameDrug = stated && med && !hasStrength(med) && formulary.find((f) => f.generic.split(" ")[0] === med.generic.split(" ")[0] && hasStrength(f));
        if (sameDrug) {
          flags.push(`The note says ${stated}%, so ${sameDrug.brand} (${sameDrug.generic}) was chosen.`);
          brand = sameDrug.brand;
          med = sameDrug;
        }
        if (stated && med && !hasStrength(med))
          flags.push(`Strength: the note says ${stated}%, but ${brand} is ${med.generic}. Choose the right strength, or add it to the drug list.`);
        const context = item.before.split(/[,(]/).pop();
        const entry = { brand, eye: null, drops: 1, mode: "ongoing", freq: null, durationDays: 7, startDay: 1, steps: [], source: sentence, flags };

        // Past use is judged on the few words next to the drug, so "Allergic
        // conjunctivitis: start Pataday" and "s/p failed trab, continue
        // Cosopt" are kept.
        const near = item.before.split(/[:;,.(]/).pop().split(/\s+/).slice(-4).join(" ");
        const ownStart = own.split(/[,;.]/)[0];
        if ((PAST.test(near) || PAST.test(ownStart)) && !CURRENT.test(near) && !CURRENT.test(ownStart)) {
          skipped.push({ name: brand, why: "mentioned as past use or an allergy" });
          continue;
        }
        if (STOP.test(context) || /^\W*(?:stop|d\/c|discontinue)/i.test(own)) {
          skipped.push({ name: brand, why: "marked as stopped" });
          continue;
        }
        if (PRN.test(own) || (shared && PRN.test(shared))) {
          skipped.push({ name: brand, why: "as needed, so it is not on the calendar" });
          continue;
        }

        if (HOURLY.test(own) || (shared && HOURLY.test(shared))) {
          skipped.push({ name: brand, why: "used hourly or more often, which the calendar cannot show. Write this plan by hand" });
          continue;
        }

        const named = eyesIn(own);
        if (new Set(named).size > 1) flags.push("The note names more than one eye for this drop. Check which eye is meant.");
        entry.eye = findEye(own) || (shared && findEye(shared));
        if (!entry.eye && sectionEye) {
          entry.eye = sectionEye;
          flags.push(`The note does not say which eye. ${sectionEye === "OS" ? "Left" : sectionEye === "OD" ? "Right" : "Both"} was taken from the heading it sits under.`);
        } else if (!entry.eye) {
          entry.eye = "OU";
          flags.push("The note does not say which eye, so both eyes was used.");
        } else if (!findEye(own)) flags.push("The eye was taken from the list this drug is written in.");

        const dropsMatch = (own.match(DROPS) || shared.match(DROPS))?.[1];
        if (dropsMatch) entry.drops = Number(dropsMatch);

        const sched = readSchedule(own.trim() ? own : shared);
        const usual = med?.freq || 2;
        if (sched.steps.length) {
          entry.mode = sched.steps.length === 1 && !sched.after ? "duration" : "taper";
          if (entry.mode === "duration") {
            entry.freq = sched.steps[0].freq;
            entry.durationDays = sched.steps[0].days;
          } else {
            entry.freq = sched.steps[0].freq;
            entry.steps = sched.steps.map(({ freq, days }) => ({ freq, days }));
          }
          sched.steps.forEach((s) => s.note && flags.push(s.note));
        } else if (sched.after) {
          entry.freq = sched.after.freq;
          if (sched.after.note) flags.push(sched.after.note);
          if (/\btaper\w*\b/i.test(own)) {
            entry.mode = "taper";
            entry.steps = TAPER_PRESETS[0].build(entry.freq);
            flags.push("The note says taper without the steps, so a weekly taper was used.");
          }
        } else {
          entry.freq = usual;
          flags.push(`The note gives no frequency, so the usual ${usual === 1 ? "once" : `${usual} times`} a day was used.`);
          if (/\btaper\w*\b/i.test(own)) {
            entry.mode = "taper";
            entry.steps = TAPER_PRESETS[0].build(entry.freq);
            flags.push("The note says taper without the steps, so a weekly taper was used.");
          }
        }
        if (entry.eye === "OD" && OD_ALONE.test(own) && !sched.steps.length && !sched.after)
          flags.push('"OD" can mean once daily as well as right eye. Check which eye is meant.');
        if (med?.maxFreq && entry.freq > med.maxFreq) flags.push(`${brand} is usually not used more than ${med.maxFreq === 1 ? "once" : `${med.maxFreq} times`} a day.`);
        drops.push(entry);

        // After a taper the drop carries on at a set frequency: a second row
        // that starts the day after the taper ends.
        if (sched.steps.length && sched.after) {
          const startDay = 1 + sched.steps.reduce((n, s) => n + s.days, 0);
          drops.push({
            ...entry,
            mode: "ongoing",
            freq: sched.after.freq,
            steps: [],
            startDay,
            flags: [`Carries on ${sched.after.freq === 1 ? "once" : `${sched.after.freq} times`} a day from day ${startDay} with no end date. Check that this is meant.`],
          });
        }
      }
    }
  }
  return { drops: dedupe(drops), skipped };
}

// The same drug, eye and plan written twice (in the summary and the plan)
// is kept once, in the first place it appears, using the mention that
// needed the fewest assumptions.
function dedupe(drops) {
  const seen = new Map();
  const out = [];
  for (const d of drops) {
    const key = JSON.stringify([d.brand, d.eye, d.freq, d.mode, d.durationDays, d.startDay, d.steps]);
    if (!seen.has(key)) {
      seen.set(key, out.length);
      out.push(d);
    } else if (d.flags.length < out[seen.get(key)].flags.length) out[seen.get(key)] = d;
  }
  return out;
}

// Medication list entries from Oscar Rx (brand, generic or custom name with
// instructions such as "1 gtt OS BID") read the same way as note text.
// Oscar writes booleans as "true" and "false".
const yes = (v) => v === true || v === "true";

export function parseRxList(drugs, formulary) {
  const lines = (drugs || [])
    .filter((d) => d && !yes(d.archived) && !yes(d.prn))
    .map((d) => [d.brandName || d.customName || d.genericName, d.instructions || [d.takeMax && `${d.takeMax} gtt`, d.frequency].filter(Boolean).join(" ")].filter(Boolean).join(" "));
  return parseNote(lines.join("\n"), formulary);
}
