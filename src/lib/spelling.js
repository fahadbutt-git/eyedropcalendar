// Finds drug names a note has misspelled ("Xalatn", "Combigen") and words
// written where a drug should be that are not on the drug list ("Vgmx 1 gtt
// QID"). A correction is only made beside a dosing word, keeps the first
// letter, and is always flagged for the clinician to check.

// Plain names the reader knows besides brand names, written as typed.
const EXTRA_WORDS = ["prednisolone", "moxifloxacin", "ketorolac", "difluprednate", "cyclopentolate", "brimonidine", "dorzolamide", "lumigan", "travatan", "duotrav"];

// A dose, frequency, eye or "drop" nearby means the word is probably a drug.
export const DOSING = /\b(?:gtts?|drops?|q\.?d|od|os|ou|b\.?i\.?d|t\.?i\.?d|q\.?i\.?d|qhs|hs|q\.?\s?\d+\s?h(?:rs?|ours?)?|daily|once|twice|times a day|nightly|bedtime|ung|oint(?:ment)?|right eye|left eye|both eyes|RE|LE|BE)\b/i;

// Words that sit next to dosing words in notes and are not drugs.
const COMMON = new Set(
  "after again apply before bilateral continue continues daily drops every eye eyes start started started stop taper tapering twice until using while with weeks month months night nightly morning evening right left both instill instil should please patient return follow plus their there these those today tomorrow drops then each every with into from also only once".split(" ")
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

// The words the reader can match: brands and the first word of each generic.
export function knownWords(formulary) {
  const words = new Set(EXTRA_WORDS);
  for (const m of formulary) {
    words.add(m.brand.toLowerCase().replace(/[^a-z]/g, ""));
    const g = m.generic?.split(/[\s\d(/]/)[0].toLowerCase();
    if (g && g.length > 4) words.add(g);
  }
  return [...words].filter((w) => w.length >= 5);
}

// The closest known word, if it is close enough to be a misspelling.
export function closest(word, known) {
  const w = word.toLowerCase();
  if (w.length < 5 || COMMON.has(w) || known.includes(w)) return null;
  const allowed = w.length >= 8 ? 2 : 1;
  let best = null;
  for (const k of known) {
    if (k[0] !== w[0] || Math.abs(k.length - w.length) > allowed) continue;
    const dist = distance(w, k);
    if (dist <= allowed && (!best || dist < best.dist)) best = { word: k, dist };
  }
  return best?.word || null;
}

// Rewrites misspelled drug names beside dosing words, and lists words in a
// drug's place that the reader does not know.
export function correctSpelling(note, formulary, pattern) {
  const known = knownWords(formulary);
  const corrections = [];
  const unknown = [];
  const lines = String(note || "")
    .split(/\r?\n/)
    .map((line) => {
      // Words already inside a known name ("Forte" in "Pred Forte") are left alone.
      const taken = [...line.matchAll(new RegExp(pattern.source, "gi"))].map((m) => [m.index, m.index + m[0].length]);
      return line.replace(/\b[A-Za-z][A-Za-z-]{2,}\b/g, (word, at) => {
        const near = line.slice(at, at + word.length + 30);
        if (!DOSING.test(near.slice(word.length)) || taken.some(([a, b]) => at >= a && at < b)) return word;
        const fix = closest(word, known);
        if (fix) {
          corrections.push({ from: word, to: fix });
          return fix;
        }
        // A short unknown word right before a dose is likely shorthand.
        if (/^\s+(?:\d\s*gtts?\s+|1 drop\s+)?(?:qd|bid|tid|qid|qhs|q\d+h|daily|once|twice)\b/i.test(line.slice(at + word.length)) && !COMMON.has(word.toLowerCase()) && !/^(?:od|os|ou|re|le|be|gtts?|drops?|eye|eyes)$/i.test(word))
          unknown.push(word);
        return word;
      });
    });
  return { text: lines.join("\n"), corrections, unknown: [...new Set(unknown)] };
}
