import { correctSpelling } from "./spelling.js";
// Reads eye drop orders out of chart note shorthand ("Maxidex QID OS x1wk
// then BID x1wk", "on 0/2 (brimonidine, dorzolamide left)") and returns
// draft drops for the clinician to check. Nothing here is trusted: every
// value the note did not state outright carries a flag that says what was
// assumed, and drugs the note mentions in the past tense or as an allergy
// are listed but left out.
//
// The result is a draft only. It reaches a patient only after a clinician
// has checked each drop in Eye Drop Tracker.
import { FREQ_OPTIONS } from "./regimen.js";

const MAX_DAYS = 365;

// Names clinicians write that the formulary does not spell out. Combination
// names come first so "dorzolamide-timolol" is not read as two drugs.
const EXTRA_NAMES = [
  ["brimonidine[-/ ]+timolol|brimo[-/ ]?tim", "Combigan"],
  ["dorzolamide[-/ ]+timolol|dorz(?:o)?[-/ ]?tim(?:olol)?|trusopt[-/ ]+timolol", "Cosopt"],
  ["latanoprost[-/ ]+timolol", "Xalacom"],
  ["travoprost[-/ ]+timolol|travoprost[-/ ]?timop", "DuoTrav PQ"],
  ["brinzolamide[-/ ]+brimonidine", "Simbrinza"],
  ["brinzolamide[-/ ]+timolol", "Azarga"],
  ["tobramycin[-/ ]+dexamethasone|tobra[-/ ]?dex", "TobraDex"],
  ["pred(?:nisolone)?\\s*forte|prednisolone(?:\\s+acetate)?", "Pred Forte"],
  ["brimo", "Alphagan"],
  ["pred", "Pred Forte"],
  ["dorzo|trusopt", "Dorzolamide"],
  ["moxi(?:floxacin)?", "Vigamox"],
  ["ketorolac", "Acular"],
  ["difluprednate", "Durezol"],
  ["lumigan", "Lumigan RC"],
  ["travatan", "Travatan Z"],
  ["duotrav", "DuoTrav PQ"],
  ["iso?pto\\s*atropine", "Atropine"],
  ["cyclopentolate", "Cyclogyl"],
  ["polytrim|polymyxin(?: b)?[-/ ]+trimethoprim", "Polytrimethoprim"],
  ["neomycin[-/ ]+polymyxin(?: b)?[-/ ]+dexamethasone", "Maxitrol"],
  ["pilo", "Pilocarpine"],
  ["timo", "Timoptic"],
];

// Mentioned often in eye notes but not eye drops on the calendar. They are
// reported so the clinician knows they were seen and left out.
const NOT_DROPS = [
  ["acetazolamide|diamox|methazolamide|prednisone", "taken by mouth"],
  ["artificial tears|tear gel|tears|lubricant|refresh|systane|hylo|genteal|thera ?tears|lacrilube", "lubricant, not in the drug list"],
  // "AT" and "ATs" only in capitals, so "at bedtime" is not read as tears.
  ["\\bATs?\\b", "lubricant, not in the drug list", ""],
];

const PAST = /\b(allerg\w*(?!\s+(?:season|conjunctivitis|symptoms|eyes?|flare|rhinitis))|intoleran\w*|previously|prior(?:ly)?|failed|was on|were on|history of|hx of|switched from|reaction to|stopped (?:due|because)|in the past|avoid\w*|(?<!be )used|tried|ineffective|did not help|didn't help|no benefit)\b/i;
const STOP = /\b(stop|stopped|d\/c|dc'?d|discontinue[ds]?|discontinued|hold|held|cease)\b/i;
const PRN = /\b(prn|as needed|as required|when needed)\b/i;

const FREQS = [
  [/\bq\.?\s?2\s?h(?:r|rs|ours?)?\b|\bevery (?:2|two) hours\b/i, 8, "Every 2 hours was read as 8 times a day."],
  [/\bq\.?\s?3\s?h(?:r|rs|ours?)?\b|\bevery (?:3|three) hours\b/i, 6, "Every 3 hours was read as 6 times a day."],
  [/\bq\.?\s?4\s?h(?:r|rs|ours?)?\b|\bevery (?:4|four) hours\b/i, 4, "Every 4 hours was read as 4 times a day while awake."],
  [/\b([2-8])\s?(?:x|times)\s?(?:\/|a|per)?\s?(?:day|d|daily)\b|\bx\s?([2-8])\s?\/\s?(?:day|d)\b/i, null],
  [/\bq\.?i\.?d\.?(?![a-z])|\bfour times\b/i, 4],
  [/\bt\.?i\.?d\.?(?![a-z])|\bthree times\b/i, 3],
  [/\bb\.?i\.?d\.?(?![a-z])|\bbd\b|\btwice\b/i, 2],
  [/\bq\.?h\.?s\.?(?![a-z])|\bh\.?s\b|\bnightly\b|\bat bedtime\b|\bat night\b/i, 1],
  [/\bq\.?d\.?(?![a-z])|\bq\s?am\b|\bq\s?pm\b|\bdaily\b|\bonce a day\b|\bonce\b|\bqday\b|\bevery day\b|\b(?:every|each|in the) (?:morning|evening)\b|\b1\s?x\s?\/\s?(?:day|d)\b/i, 1],
];

// Abbreviations count only in capitals, so "to be used", "re-check" and
// "Os" in a sentence are not read as an eye. "Right" and "left" count unless
// they are part of a phrase such as "right away" or "left over".
const SIDE_PHRASE = "(?!\\s*(?:away|now|after|before|here|there|over|behind|alone|side of)\\b)";
const EYE_WORDS = [
  [/\b[Oo][Uu]\b|\bBE\b/, /\bboth eyes\b|\beach eye\b|\bbilateral(?:ly)?\b/i, "OU"],
  [/\b[Oo][Dd]\b|\bRE\b|\b[Rr]\.? eye\b/, new RegExp(`\\bright\\b${SIDE_PHRASE}`, "i"), "OD"],
  [/\b[Oo][Ss]\b|\bLE\b|\b[Ll]\.? eye\b/, new RegExp(`\\bleft\\b${SIDE_PHRASE}`, "i"), "OS"],
];
// "OD" also means once daily, which is why ISMP Canada lists it as error-prone.
const OD_ALONE = /\b[Oo][Dd]\b/;
// Hourly drops (keratitis, endophthalmitis) are more than the calendar can
// show, so they are left for the clinician to write by hand.
const HOURLY = /\bq\.?\s?(?:1\s?h(?:r|rs|ours?)?|30\s?min)\b|\bhourly\b|\bevery (?:hour|30 minutes|half hour)\b/i;
// Words that make a drop current even when the sentence also mentions the past.
const CURRENT = /\b(start|started|begin|continue|cont|restart|resume|use|add|new)\b/i;
// Mentioned but not ordered: something considered, given once in clinic,
// replaced, or stopped after the fact.
const HYPOTHETICAL = /\b(consider\w*|may add|could add|might add|may use|can use|could use|option of|discuss\w* adding|if (?:iop|pressure|needed|not)\b)/i;
// Earlier in the same sentence: the drug is only a possibility.
const HEDGE = /\bconsider\w*\b|\b(?:will )?hold off\b|\b(?:may|might) be on\b|\bunclear\b|\bto confirm\b|\b(?:may|might|could) need\b|\bwill discuss\b|\bto discuss\b|\bdiscuss(?:ed)? (?:with|about)\b|\basked about\b|\brefer(?:red|ral)? (?:to [^.;]{0,30} )?for\b|\bif no (?:better|improvement|change)\b|\bif not improv\w*|\bunless\b/i;
// A hedge counts until a new clause starts a drug ("consider stopping
// Xalatan, continue Cosopt").
const hedgedIn = (text) => {
  const last = [...text.matchAll(new RegExp(HEDGE.source, "gi"))].pop();
  return !!last && !/[,;]\s*(?:and\s+)?(?:continue|cont|start|use|restart|resume)\b/i.test(text.slice(last.index));
};
// A course already finished.
const FINISHED = /^[^.;]{0,40}(?:\(\s*(?:now |already )?(?:completed?|finished|done)\s*\)|\b(?:now|already|has|have|was|were) (?:been )?(?:completed?|finished|done)\b)/i;
// After the drug: the patient said no.
const DECLINED = /^\W*(?:[-–]\s*)?(?:pt |patient )?(?:declined|refused)\b/i;
// A procedure, not a drop to use at home.
const PROCEDURE = /\b(?:intracameral|intravitreal|intra-?vitreal|subconj\w*|sub-?tenon\w*|IVT|IVI|injection|injected|dropless)\b/i;
// A section listing drugs that are no longer used.
const OLD_SECTION = /^\s*[-*•]?\s*(?:discontinued|stopped|past|previous|prior|old|inactive|failed|ineffective)\b[^:]{0,40}:\s*(.*)$/i;
const ANY_SECTION = /^\s*[A-Za-z][A-Za-z /&()-]{1,40}:\s*$/;
const COPIED = /\bcopied (?:from|forward)\b|\bcarried forward\b|\bfrom (?:the )?(?:prior|previous|last) (?:note|visit)\b/i;
// A sentence that starts with "then" after a condition ("No antibiotics
// unless discharge worsens; then Polytrim QID").
const CONDITION = /\b(?:unless|if)\b/i;
// The drug was switched to another one.
const SWITCHED_TO = /^\s*(?:was |is |being |to be )?(?:switched|changed|swapped|replaced)\s+(?:to|for|with|by)\b/i;
// A change in the plan: the newer instruction wins over an older line.
const CHANGE = /\b(?:decrease|increase|reduce|lower|raise|change|now|taper|switch)\b/i;
const IN_CLINIC = /\b(?:given|instilled|administered|applied)\b[^.;]{0,40}\b(?:in clinic|in (?:the )?office|today)\b|\bin clinic\b|\bx\s?[12] (?:given|in clinic)\b/i;
const REPLACED = /\b(?:replacing|instead of|in place of|change|switch(?:ed)?(?: from)?|swap)\s+$/i;
const STOPPED_AFTER = /\b(?<!then )(?:has been |was |were |is )?(?:stopped|discontinued|d\/c'?d|dc'?d)\b/i;
const ORAL = /\b\d+\s*mg\b|\bp\.?o\.?\b|\bby mouth\b|\btab(?:let)?s?\b/i;
const LABEL_ALLERGY = /\b(?:allerg\w*|intoleran\w*|adverse reactions?)\s*:[^:]*$/i;
// Drops for someone else, planned for later, or ruled out.
const SOMEONE_ELSE = /\b(?:husband|wife|spouse|partner|son|daughter|mother|father|parent|sibling|brother|sister|family member)'?s?\b[^.;]{0,40}$/i;
const LATER = /\b(?:post-?op drops|to start (?:on )?(?:the )?day of surgery|after (?:the )?surgery)\b/i;
// "Per protocol" alone gives no plan. "Per protocol: Vigamox QID x 1wk" does.
const PROTOCOL = /\bper protocol\b/i;
// "All OU" after a list gives the eye for the drops in it that named none.
const ALL_EYE = /^\W*(?:all|both|each)(?:\s+(?:drops?|of (?:these|them|the above)|meds?|medications?))?\s+(OU|OD|OS|both eyes|right eye|left eye)\W*$/i;
// "4/3/2/1 weekly" or "4→3→2→1 x 1 week each": a taper in shorthand.
const TAPER_NUMBERS = /(?<![\d/.])([1-8])\s*(?:\/|→|->|-)\s*([1-8])\s*(?:\/|→|->|-)\s*([1-8])(?:\s*(?:\/|→|->|-)\s*([1-8]))?(?:\s*(?:\/|→|->|-)\s*([1-8]))?(?![\d/.%])/;
const TAPER_PERIOD = /\b(?:weekly|each week|every week|per week|a week each|(?:x\s*)?1\s*(?:wk|week) each|q\.?\s?(?:1\s?)?wk|q\.?\s?week)\b|\bx\s*(\d)\s*(?:wks?|weeks?) each\b|\b(\d{1,2})\s*days? each\b/i;
// "Taper by 1 drop weekly, starting QID".
const TAPER_BY_ONE = /\btaper(?:ing)?(?: down)? by (?:1|one) (?:drop|gtt|dose)s? (?:a |per |each |every )?(week|weekly|day|daily)\b/i;
// "BID OD, QD OS": a different plan for each eye on one line.
const PER_EYE = /\b(q\.?i\.?d|t\.?i\.?d|b\.?i\.?d|q\.?d|qhs|daily|once daily|twice daily)\.?\s+(OD|OS)\s*[,;]\s*(?:and\s+)?(q\.?i\.?d|t\.?i\.?d|b\.?i\.?d|q\.?d|qhs|daily|once daily|twice daily)\.?\s+(OD|OS)\b/i;
const RULED_OUT = /\bno\s*$/i;
const GIVEN_NOW = /^\s*(?:\d[^a-z]*)?(?:(?:gtts?|drops?)\s+)?(?:was |were )?(?:given|instilled|administered)\b/i;
const SAME_OTHER_EYE = /\bsame (?:in|for|to) (?:the )?(?:fellow|other) eye\b/i;

const UNIT_DAYS = { d: 1, day: 1, days: 1, w: 7, wk: 7, wks: 7, week: 7, weeks: 7, mo: 30, month: 30, months: 30 };
const DURATION = /(?:\bx|×|\bfor|\btimes(?=\s+(?:\d|one|two|three|four|five|six|seven|eight|ten|fourteen)\b))\s*(\d{1,3}|an?|one|two|three|four|five|six|seven|eight|ten|fourteen)\s*(?:more\s+|additional\s+|extra\s+)?(days?|d|wks?|w|weeks?|mo|months?)\b/i;
// "x 5/7" is five days and "x 2/52" two weeks, as many notes write them.
const SLASH_DURATION = /(?:\bx|×|\bfor)\s*(\d{1,2})\/(7|52|12)\b|(?<![\d/])\b([1-9]|1[0-2])\/(52|12)\b(?![\d/])/;
const WORD_NUMBERS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, ten: 10, fourteen: 14 };
const DROPS = /\b([1-3])\s*(?:gtts?|drops?)\b/i;

// "Stop the timoptic ... start azopt": a stop counts only when no start
// comes after it.
const stoppedIn = (text) => {
  const last = [...text.matchAll(new RegExp(STOP.source, "gi"))].pop();
  return !!last && !CURRENT.test(text.slice(last.index + last[0].length));
};
// "One drop in the right eye of Cosopt": the eye is written before the drug.
const EYE_BEFORE_DRUG = /\b(?:in|to|for) (?:the |each |both )?(right|left|both) eyes? (?:of|with)\s*$/i;
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
    // Notes often write only the first word ("loteprednol", not
    // "loteprednol etabonate").
    const first = generic?.split(" ")[0];
    if (first && first !== generic && first.length > 5) names.push({ pattern: escape(first), brand: m.brand, generic: true });
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

// The frequency written first wins, so "Lotemax ointment qhs + PF tears QID"
// stays at bedtime.
function findFreq(text) {
  let best = null;
  for (const [re, freq, note] of FREQS) {
    const m = text.match(re);
    if (!m || (best && best.at <= m.index)) continue;
    const n = freq ?? Number(m[1] || m[2]);
    const fit = FREQ_OPTIONS.includes(n) ? n : FREQ_OPTIONS.filter((f) => f <= n).pop();
    best = { freq: fit, note: note || (fit !== n ? `The note says ${n} times a day. The calendar holds ${fit}, so ${fit} was used.` : null), at: m.index };
  }
  return best;
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
  const slash = text.match(SLASH_DURATION);
  if (slash) {
    const n = Number(slash[1] || slash[3]);
    const unit = slash[2] || slash[4];
    return Math.min(MAX_DAYS, n * (unit === "52" ? 7 : unit === "12" ? 30 : 1));
  }
  const m = text.match(DURATION);
  const n = WORD_NUMBERS[m?.[1].toLowerCase()] ?? Number(m?.[1]);
  return m ? Math.min(MAX_DAYS, n * UNIT_DAYS[m[2].toLowerCase()]) : null;
};

// "QID x1wk then TID x1wk then BID" gives steps, and an open-ended last part
// ("then QD until further instructions") is returned as the frequency that
// carries on after them.
function readSchedule(clause) {
  const nums = clause.match(TAPER_NUMBERS);
  const period = clause.match(TAPER_PERIOD);
  if (nums && period) {
    const freqs = nums.slice(1).filter(Boolean).map(Number);
    const days = period[1] ? Number(period[1]) * 7 : period[2] ? Number(period[2]) : 7;
    if (freqs.every((f, i) => i === 0 || f < freqs[i - 1]) && days > 0)
      return { steps: freqs.map((freq) => ({ freq, days })), after: null, stops: true, shorthand: nums[0] };
  }
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
      // Common abbreviations do not end a sentence.
      if (m[0] === "." && /\b(?:incl|e\.g|i\.e|approx|vs|etc|esp|pt|dr|re)$/i.test(line.slice(Math.max(0, m.index - 6), m.index))) continue;
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

export function parseNote(input, formulary) {
  const names = nameIndex(formulary);
  const pattern = new RegExp(`(?<![\\w-])(${names.map((n) => n.pattern).sort((a, b) => b.length - a.length).join("|")})(?![\\w])`, "gi");
  // Misspelled drug names beside a dose are corrected and flagged. Unknown
  // words in a drug's place are listed, so nothing is dropped silently.
  const { text: corrected, corrections, unknown } = correctSpelling(input, formulary, pattern);
  // A line that starts with "then" carries on the instruction above it.
  const note = corrected
    .replace(/[,;]?\s*\r?\n\s*(?=then\b)/gi, " ")
    // Dictation writes "right I" for right eye.
    .replace(/\b(right|left)\s+I\b/g, "$1 eye")
    // Templates write numbers in boxes: "[4] x/day x [7] days".
    .replace(/\[\s*(\d{1,2})\s*\]/g, "$1");
  // If the whole note names only one eye (a post-op note for one eye), a drop
  // with no eye of its own most likely means that eye.
  const noteEyes = new Set(eyesIn(note));
  const onlyEye = noteEyes.size === 1 && !noteEyes.has("OU") ? [...noteEyes][0] : null;
  const drops = [];
  const skipped = [];
  let sectionEye = null;
  // Lines under "Discontinued medications:" and the like are not current.
  let oldSection = false;

  for (const raw of String(note || "").split(/\r?\n/)) {
    // A numbered problem ("2. Left POAG") or an eye heading ("OD:") sets the
    // eye for the lines under it, until a blank line.
    const eyeHeading = raw.match(/^\s*(OD|OS|OU|RE|LE|BE|right eye|left eye|both eyes)\s*:/i);
    const headEye = eyeHeading && findEye(eyeHeading[1].length > 2 ? eyeHeading[1] : eyeHeading[1].toUpperCase());
    // "OD:" alone heads the lines below it. "Right eye: new CRAO" with text
    // after it covers that line only.
    const lineOnly = headEye && raw.slice(eyeHeading[0].length).trim() !== "";
    sectionEye = headEye && !lineOnly ? headEye : lineOnly ? null : /^\s*\d+[.)]/.test(raw) ? headingEye(raw) : raw.trim() ? sectionEye : null;
    const lineEye = lineOnly ? headEye : null;
    const old = raw.match(OLD_SECTION);
    if (old) oldSection = !old[1].trim();
    else if (!raw.trim() || ANY_SECTION.test(raw) || /^\s*[A-Z][A-Za-z /&()-]{1,40}:/.test(raw)) oldSection = false;
    const notCurrent = old ? "listed under discontinued or past medications" : oldSection ? "listed under discontinued or past medications" : COPIED.test(raw) ? "copied from an earlier note" : null;
    let previous = "";
    const lineStart = drops.length;
    for (const sentence of sentences(raw)) {
      const allEye = sentence.match(ALL_EYE);
      if (allEye) {
        const eye = findEye(allEye[1].length > 2 ? allEye[1] : allEye[1].toUpperCase());
        for (const d of drops.slice(lineStart)) {
          if (!d.flags.some((f) => /does not say which eye/.test(f))) continue;
          d.eye = eye;
          d.flags = d.flags.filter((f) => !/does not say which eye/.test(f));
          d.flags.push(`The eye was taken from "${allEye[0].trim()}" after the list.`);
        }
      }
      const conditional = /^\s*then\b/i.test(sentence) && CONDITION.test(previous);
      previous = sentence;
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
        // "Maxitrol ung" or "Tobradex ointment" is the ointment form.
        const ointment = /^\s*(?:ung|oint(?:ment)?)\b\.?/i.test(item.clause) && formulary.find((m) => m.brand === `${brand} Ointment`);
        if (ointment) brand = ointment.brand;
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
        // Abbreviations such as "incl." do not end the phrase.
        const near = item.before.split(/[:;,(]|\.(?=\s+[A-Z])/).pop().split(/\s+/).slice(-4).join(" ");
        const ownStart = own.split(/[,;.]/)[0];
        // "FML BID (switched from Pred)": the past words after the drug are about the other one.
        const ownPast = ownStart.replace(/\(?\s*(?:switched|changed) from\b[^)]*\)?/i, "");
        if ((PAST.test(near) || PAST.test(ownPast)) && !CURRENT.test(near) && !CURRENT.test(ownStart)) {
          skipped.push({ name: brand, why: "mentioned as past use or an allergy" });
          continue;
        }
        if (notCurrent) {
          skipped.push({ name: brand, why: notCurrent });
          continue;
        }
        if (conditional || hedgedIn(item.before)) {
          skipped.push({ name: brand, why: conditional ? "only if a condition is met" : "considered, not started" });
          continue;
        }
        if (DECLINED.test(own) || /\[\s\]\s*$/.test(item.before)) {
          skipped.push({ name: brand, why: DECLINED.test(own) ? "declined by the patient" : "not ticked in the template" });
          continue;
        }
        if (PROCEDURE.test(near) || PROCEDURE.test(ownStart)) {
          skipped.push({ name: brand, why: "given during a procedure, not a drop to use at home" });
          continue;
        }
        if (FINISHED.test(own) && !CURRENT.test(near)) {
          skipped.push({ name: brand, why: "course already finished" });
          continue;
        }
        if (SWITCHED_TO.test(own)) {
          skipped.push({ name: brand, why: "being replaced" });
          continue;
        }
        // The line so far, for labels such as "ALLERGIES:" that head a list
        // split by semicolons.
        const lineSoFar = raw.slice(0, Math.max(0, raw.indexOf(sentence))) + item.before;
        // A drug in brackets takes its context from the words before them.
        const bracketed = /\(\s*$/.test(item.before) ? item.before.replace(/\(\s*$/, "") : "";
        if (SOMEONE_ELSE.test(item.before)) {
          skipped.push({ name: brand, why: "for someone else" });
          continue;
        }
        if (LATER.test(sentence) || (PROTOCOL.test(sentence) && !findFreq(own) && !findFreq(shared))) {
          skipped.push({ name: brand, why: "planned for later" });
          continue;
        }
        if (RULED_OUT.test(item.before) || GIVEN_NOW.test(own)) {
          skipped.push({ name: brand, why: RULED_OUT.test(item.before) ? "ruled out" : "given in clinic, not a drop to use at home" });
          continue;
        }
        if (bracketed && (STOP.test(bracketed) || PAST.test(bracketed))) {
          skipped.push({ name: brand, why: "marked as stopped" });
          continue;
        }
        if (LABEL_ALLERGY.test(item.before) || LABEL_ALLERGY.test(lineSoFar)) {
          skipped.push({ name: brand, why: "listed as an allergy" });
          continue;
        }
        if (stoppedIn(context) || /^\W*(?:stop|d\/c|discontinue)/i.test(own) || (STOPPED_AFTER.test(own) && !CURRENT.test(near))) {
          skipped.push({ name: brand, why: "marked as stopped" });
          continue;
        }
        if (HYPOTHETICAL.test(near)) {
          skipped.push({ name: brand, why: "considered, not started" });
          continue;
        }
        if (REPLACED.test(item.before)) {
          skipped.push({ name: brand, why: "being replaced" });
          continue;
        }
        if (IN_CLINIC.test(sentence) && !CURRENT.test(near)) {
          skipped.push({ name: brand, why: "given in clinic, not a drop to use at home" });
          continue;
        }
        if (ORAL.test(own)) {
          skipped.push({ name: brand, why: "taken by mouth" });
          continue;
        }
        entry.started = CURRENT.test(near) || CURRENT.test(ownStart);
        if (PRN.test(own) || (shared && PRN.test(shared))) {
          skipped.push({ name: brand, why: "as needed, so it is not on the calendar" });
          continue;
        }

        if (HOURLY.test(own) || (shared && HOURLY.test(shared))) {
          skipped.push({ name: brand, why: "used hourly or more often, which the calendar cannot show. Write this plan by hand" });
          continue;
        }

        // The eye written just before this drug belongs to it, and the one
        // written just before the next drug belongs to that one.
        const eyeBefore = item.before.match(EYE_BEFORE_DRUG);
        const ownEyes = own.replace(new RegExp(`(?:\\d|one|two)?\\s*(?:gtts?|drops?)?\\s*${EYE_BEFORE_DRUG.source.slice(0, -4)}\\s*$`, "i"), "");
        const named = eyesIn(ownEyes);
        if (new Set(named).size > 1) flags.push("The note names more than one eye for this drop. Check which eye is meant.");
        entry.eye = eyeBefore ? findEye(`${eyeBefore[1]} eye`) : SAME_OTHER_EYE.test(own) ? "OU" : findEye(ownEyes) || (shared && findEye(shared));
        const firstInSentence = item === items[0];
        const before = firstInSentence ? findEye(item.before) : null;
        if (!entry.eye && lineEye) {
          entry.eye = lineEye;
        } else if (!entry.eye && before) {
          entry.eye = before;
          flags.push("The eye was taken from earlier in the sentence. Check it.");
        } else if (!entry.eye && sectionEye) {
          entry.eye = sectionEye;
          flags.push(`The note does not say which eye. ${sectionEye === "OS" ? "Left" : sectionEye === "OD" ? "Right" : "Both"} was taken from the heading it sits under.`);
        } else if (!entry.eye && onlyEye) {
          entry.eye = onlyEye;
          flags.push(`The drop does not say which eye. ${onlyEye === "OS" ? "Left" : "Right"} was used, the only eye this note names.`);
        } else if (!entry.eye) {
          entry.eye = "OU";
          flags.push("The note does not say which eye, so both eyes was used.");
        } else if (!eyeBefore && !findEye(ownEyes)) flags.push("The eye was taken from the list this drug is written in.");

        const dropsMatch = (own.match(DROPS) || shared.match(DROPS))?.[1];
        if (dropsMatch) entry.drops = Number(dropsMatch);

        const sched = readSchedule(own.trim() ? own : shared);
        if (sched.shorthand) flags.push(`The taper was read from shorthand ("${sched.shorthand}"). Check each step.`);
        // "Taper by 1 drop weekly, starting QID": steps down to once a day.
        const byOne = !sched.steps.length && sentence.match(TAPER_BY_ONE);
        const startFreq = byOne && (sched.after?.freq || findFreq(own)?.freq);
        if (byOne && startFreq >= 2) {
          const days = /day|daily/i.test(byOne[1]) ? 1 : 7;
          sched.steps = Array.from({ length: startFreq }, (_, i) => ({ freq: startFreq - i, days }));
          sched.after = null;
          flags.push(`The taper was read as one drop less each ${days === 1 ? "day" : "week"}, from ${startFreq} times a day. Check each step.`);
        }
        // A change, or a line under "Plan:", is newer than history above it.
        entry.changed = CHANGE.test(near) || /\bplan\s*:/i.test(lineSoFar) || /\bmore\b/i.test(ownStart);
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
          // A taper without its steps is never invented. The drop stays at
          // its current frequency until the clinician chooses the steps.
          if (/\btaper\w*\b/i.test(own)) flags.push("The note says taper without the steps. Choose the taper steps before printing, or the drop stays at this frequency.");
        } else {
          entry.freq = usual;
          flags.push(`The note gives no frequency, so the usual ${usual === 1 ? "once" : `${usual} times`} a day was used.`);
          // A taper without its steps is never invented. The drop stays at
          // its current frequency until the clinician chooses the steps.
          if (/\btaper\w*\b/i.test(own)) flags.push("The note says taper without the steps. Choose the taper steps before printing, or the drop stays at this frequency.");
        }
        if (entry.eye === "OD" && OD_ALONE.test(own) && !sched.steps.length && !sched.after)
          flags.push('"OD" can mean once daily as well as right eye. Check which eye is meant.');
        if (med?.maxFreq && entry.freq > med.maxFreq) flags.push(`${brand} is usually not used more than ${med.maxFreq === 1 ? "once" : `${med.maxFreq} times`} a day.`);
        // "Pred Forte BID OD, QD OS": a different plan for each eye.
        const perEye = !sched.steps.length && own.match(PER_EYE);
        if (perEye && [perEye[2], perEye[4]].every((e) => e === e.toUpperCase()) && perEye[2] !== perEye[4]) {
          const note = "The note gives a different plan for each eye. Check both.";
          entry.eye = perEye[2];
          entry.freq = findFreq(perEye[1]).freq;
          entry.flags = flags.filter((f) => !/more than one eye|was used\.$/.test(f) || /Strength/.test(f));
          entry.flags.push(note);
          drops.push(entry);
          drops.push({ ...entry, eye: perEye[4], freq: findFreq(perEye[3]).freq, flags: [...entry.flags] });
          continue;
        }
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
  // A drug stopped, replaced or listed as an allergy anywhere in the note is
  // not kept from another mention ("on timolol ... D/C timolol"), unless that
  // mention starts it again.
  const notOrdered = new Set(skipped.filter((x) => /stopped|replaced|allergy/.test(x.why)).map((x) => x.name));
  const found = dedupe(drops.filter((d) => !notOrdered.has(d.brand) || d.started)).map((d) => {
    delete d.started;
    delete d.changed;
    return d;
  });
  for (const c of corrections) {
    const d = found.find((x) => names.some((n) => n.brand === x.brand && new RegExp(`^(?:${n.pattern})$`, "i").test(c.to)));
    if (d) d.flags.unshift(`The note says "${c.from}", read as ${d.brand}. Check the spelling.`);
  }
  return { drops: found, skipped, unknown };
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
  const plan = (d) => JSON.stringify([d.freq, d.mode, d.durationDays, d.startDay, d.steps]);
  const merged = [];
  for (const d of out) {
    // Different plans for the right and the left eye are both kept.
    const overlaps = (a, b) => a === b || a === "OU" || b === "OU";
    const same = merged.find((m) => m.brand === d.brand && m.startDay === d.startDay && (overlaps(m.eye, d.eye) || plan(m) === plan(d)));
    if (!same) merged.push(d);
    // The same plan for the right eye and the left eye is one plan for both.
    else if (plan(same) === plan(d) && new Set([same.eye, d.eye]).size === 2 && same.eye !== "OU" && d.eye !== "OU") same.eye = "OU";
    // The same drug written twice with different instructions is kept once,
    // and flagged, rather than put on the calendar twice.
    // A later line that changes the plan ("Decrease Pred Forte to daily")
    // is used over the line it changes, and flagged.
    else if (d.changed && !same.changed && !d.flags.some((f) => f.startsWith("The note gives no frequency"))) {
      d.flags.unshift(`The note gives ${d.brand} more than once. The change written later was used. Check it.`);
      merged[merged.indexOf(same)] = d;
    } else if (!same.flags.some((f) => f.startsWith("The note gives")))
      same.flags.unshift(`The note gives ${d.brand} more than once with different instructions. Check which is right.`);
  }
  return merged;
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
