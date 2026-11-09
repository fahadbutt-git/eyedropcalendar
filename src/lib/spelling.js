// Recognises drug names a note has misspelled or shortened ("Xalatn",
// "Alfagan P", "Pred Fort", "dorzolamid-timolol", "Azop", "cipro"), and lists
// words written where a drug should be that it cannot place ("Vgmx 1 gtt
// QID"). It is deliberately cautious:
//
// - it only looks at a word beside a dosing word (a frequency, an eye, gtt,
//   ointment) or after a label such as "Rx:" or "Drops:"
// - a word must be close to exactly one drug, by spelling, by sound or as the
//   start of its name, or it is left alone
// - every correction is flagged for the clinician to check
//
// Ordinary words and names that are not close to any drug are never turned
// into drugs.

// Names the reader knows besides brands and generics, written the way its
// note reader matches them.
const EXTRA_NAMES = [
  "prednisolone", "moxifloxacin", "ketorolac", "difluprednate", "cyclopentolate", "brimonidine", "dorzolamide",
  "Lumigan", "Travatan", "DuoTrav", "Polytrim", "dorzolamide-timolol", "brimonidine-timolol", "Pred Forte",
];

// A dose, frequency, eye or "drop" after the word.
export const DOSING = /\b(?:gtts?|drops?|q\.?d|od|os|ou|b\.?i\.?d|t\.?i\.?d|q\.?i\.?d|qhs|hs|q\.?\s?\d+\s?h(?:rs?|ours?)?|\d+x\/d(?:ay)?|daily|once|twice|times a day|nightly|bedtime|ung|oint(?:ment)?|right eye|left eye|both eyes|r eye|l eye|RE|LE|BE)\b/i;
// A label or verb before the word that introduces a drug.
const INTRO = /(?:\b(?:rx|gtts?|drops?|meds?|medications?|plan|start|started|continue|cont|use|add|restart|switch(?:ed)? to|change(?:d)? to|on)\b[\s:,-]*|[:•]\s*)$/i;

// Words that sit near dosing words in eye notes and are never drug names.
const COMMON = new Set(
  `after again apply applied before bilateral continue continues daily drops drop every eye eyes start started stop stopped taper tapering
  twice until using while with week weeks month months day days night nightly morning evening right left both instill instil instilled
  should please patient return follow review refill renew repeat routine stable improved better worse discussed education plus their
  there these those today tomorrow then each into from also only once same current plan meds medications allergy allergies sulfa asthma
  pressure vision cataract glaucoma laser phaco trab trabeculectomy cornea corneal retina macula lids lashes scrubs warm compress
  compresses tears tear artificial preservative free bottle shake wait between apart during finished finish complete decrease increase
  reduce change switch minutes hours dilated dilation drops exam check follow-up followup visit clinic office given prior previous
  operated operative fellow other affected surgery post-op postop pre-op preop inflammation infection discharge redness pain itch
  itching itchy burning gtts lubricate lubricating lubricant ointment refresh systane optive genteal thera
  prednisone methylprednisolone acetazolamide methazolamide rest`.split(/\s+/)
);

// Optimal string alignment distance: insertions, deletions, substitutions
// and swapped neighbours each cost one.
export function distance(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[a.length][b.length];
}

const compact = (w) => w.toLowerCase().replace(/[^a-z]/g, "");

// How a word sounds: its first letter and its consonants, with common
// spelling swaps (ph and f, c and k, x and ks) made the same.
export function sound(word) {
  const w = compact(word)
    .replace(/ph/g, "f")
    .replace(/ck/g, "k")
    .replace(/c(?=[eiy])/g, "s")
    .replace(/[cq]/g, "k")
    .replace(/x/g, "ks")
    .replace(/z/g, "s")
    .replace(/(.)\1+/g, "$1");
  return w[0] + w.slice(1).replace(/[aeiouyh]/g, "");
}

// Every name the reader can match, by the text that should replace a
// misspelling of it.
export function knownNames(formulary) {
  const texts = new Set(EXTRA_NAMES);
  for (const m of formulary) {
    texts.add(m.brand);
    if (m.generic?.includes("/")) continue;
    const g = m.generic?.split(/[\s\d(]/)[0];
    if (g && g.length > 4) texts.add(g.toLowerCase());
  }
  return [...texts].map((text) => ({ text, key: compact(text), sound: sound(text) })).filter((n) => n.key.length >= 5);
}

// How far a misspelling may be from the name, by the name's length.
const allowedFor = (n) => (n <= 6 ? 1 : n <= 9 ? 2 : 3);

// The one name a word most likely means, or null when it is not close to
// any, or close to more than one.
export function recognise(word, names, doseAfter = true) {
  const w = compact(word);
  if (w.length < 4 || COMMON.has(w)) return null;
  // Written without its space or hyphen ("LumiganRC"): the same name.
  const same = names.find((n) => n.key === w);
  if (same) return compact(word) === compact(same.text) && word.replace(/[^A-Za-z]/g, "") !== same.text.replace(/[^A-Za-z]/g, "") ? same.text : null;
  // One answer only. Names that are the same word ("timolol" the generic
  // and "Timolol 0.25%") count once, and a name that starts every other
  // match ("erythromycin" and "Erythromycin Ointment") is that match.
  const pick = (found) => {
    const byKey = [...new Map(found.map((n) => [n.key, n])).values()];
    if (byKey.length === 1) return byKey[0].text;
    const root = byKey.find((n) => byKey.every((m) => m.key.startsWith(n.key)));
    return root ? root.text : null;
  };
  // 1. Spelling: a few letters wrong, the same first letter. A four-letter
  // word may only be one letter from a five-letter name ("Azot", "Zmar").
  if (w.length >= 4) {
    const scored = names
      .filter((n) => n.key[0] === w[0] && Math.abs(n.key.length - w.length) <= allowedFor(n.key.length) && (w.length >= 5 || n.key.length === 5))
      .map((n) => ({ ...n, d: distance(w, n.key) }))
      .filter((n) => n.d <= allowedFor(n.key.length));
    if (scored.length) {
      const best = Math.min(...scored.map((n) => n.d));
      const one = pick(scored.filter((n) => n.d === best));
      if (one) return one;
    }
  }
  // 2. The start of exactly one name: "Azop", "cipro", "erythro". Four
  // letters only count with a dose straight after ("Cont rest." is not Restasis).
  const start = (w.length >= 5 || doseAfter) && pick(names.filter((n) => n.key.startsWith(w) && n.key.length > w.length));
  if (start) return start;
  // 3. Sound: "Alfagan" is Alphagan, "Xalitin" is Xalatan. Only when most of
  // the letters agree too, so a different drug that sounds alike is not chosen.
  const s = sound(w);
  if (w.length >= 5 && s.length >= 4) {
    const one = pick(names.filter((n) => n.sound === s && distance(w, n.key) <= Math.ceil(n.key.length / 3)));
    if (one) return one;
  }
  return null;
}

// Rewrites misspelled drug names in dosing context, and lists words in a
// drug's place that it could not place.
export function correctSpelling(note, formulary, pattern) {
  const names = knownNames(formulary);
  const multi = names.filter((n) => /[\s-]/.test(n.text));
  const corrections = [];
  const unknown = [];
  const lines = String(note || "")
    .split(/\r?\n/)
    .map((line) => {
      // Words already inside a known name ("Forte" in "Pred Forte") are left alone.
      const taken = [...line.matchAll(new RegExp(pattern.source, "gi"))].map((m) => [m.index, m.index + m[0].length]);
      const inTaken = (a, b) => taken.some(([x, y]) => a < y && b > x);
      const words = [...line.matchAll(/[A-Za-z][A-Za-z]*/g)].map((m) => ({ text: m[0], at: m.index, end: m.index + m[0].length }));
      const inContext = (a, b) => DOSING.test(line.slice(b, b + 30)) || INTRO.test(line.slice(Math.max(0, a - 25), a));
      const edits = [];
      for (let i = 0; i < words.length; i++) {
        const w = words[i];
        if (inTaken(w.at, w.end) || !inContext(w.at, w.end)) continue;
        // Two-word names first: "Pred Fort", "Alfagan P", "dorzolamid-timolol".
        const next = words[i + 1];
        if (next && /^[\s-]$/.test(line.slice(w.end, next.at)) && !inTaken(next.at, next.end)) {
          const pair = w.text + next.text;
          const one = recognise(pair, multi);
          if (one && compact(pair) !== compact(one)) {
            edits.push({ at: w.at, end: next.end, from: line.slice(w.at, next.end), to: one });
            i++;
            continue;
          }
        }
        // "Ointmnt", "Oitment": the form word, so the ointment is chosen.
        if (/^o/i.test(w.text) && w.text.length >= 5 && w.text.toLowerCase() !== "ointment" && distance(w.text.toLowerCase(), "ointment") <= 2) {
          edits.push({ at: w.at, end: w.end, from: w.text, to: "ointment", form: true });
          continue;
        }
        const one = recognise(w.text, names, DOSING.test(line.slice(w.end, w.end + 30)));
        if (one) {
          edits.push({ at: w.at, end: w.end, from: w.text, to: one });
          continue;
        }
        // A word right before a frequency that is not a known word is likely
        // shorthand the reader cannot place.
        if (/^\s+(?:\d\s*gtts?\s+|1 drop\s+)?(?:qd|bid|tid|qid|qhs|q\d+h|daily|once|twice)\b/i.test(line.slice(w.end)) && !COMMON.has(w.text.toLowerCase()) && !/^(?:od|os|ou|re|le|be|r|l|gtts?|drops?|eye|eyes|and|or|then|to|in|of)$/i.test(w.text))
          unknown.push(w.text);
      }
      let out = line;
      for (const e of edits.reverse()) {
        if (!e.form) corrections.push({ from: e.from, to: e.to });
        out = out.slice(0, e.at) + e.to + out.slice(e.end);
      }
      return out;
    });
  return { text: lines.join("\n"), corrections: corrections.reverse(), unknown: [...new Set(unknown)] };
}
