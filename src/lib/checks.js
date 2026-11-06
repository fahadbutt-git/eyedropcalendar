// Safety checks shown beside the drop list and repeated on the print steps.
// They are prompts for the prescriber, never blocks.
import { modeOf, totalDays } from "./regimen.js";

const IGNORED = new Set(["OTHER", "LUB"]);
const GLAUCOMA = new Set(["PGA", "BB", "CAI", "AA", "MIO"]);
// "an NSAID" is said with a vowel sound.
const article = (word) => (/^([aeiou]|nsaid)/i.test(word) ? "an" : "a");
const listOf = (names) => (names.length === 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`);

function eyeWarnings(drops, medOf, eyeLabel, classNames) {
  const warnings = [];
  const seen = new Set();
  const byClass = new Map();
  for (const d of drops) {
    if (seen.has(d.brand)) warnings.push(`${d.brand} is listed twice for the ${eyeLabel}.`);
    seen.add(d.brand);
    for (const c of medOf(d)?.cls || []) {
      if (IGNORED.has(c)) continue;
      if (!byClass.has(c)) byClass.set(c, new Set());
      byClass.get(c).add(d.brand);
    }
  }
  for (const [c, brands] of byClass) {
    if (brands.size < 2) continue;
    const names = [...brands];
    const word = (classNames[c] || c).toLowerCase();
    warnings.push(`${listOf(names)} ${names.length === 2 ? "both" : "all"} contain ${article(word)} ${word} (${eyeLabel}).`);
  }
  const glaucoma = [...seen].filter((b) => medOf({ brand: b })?.cls.some((c) => GLAUCOMA.has(c)));
  const agents = new Set(drops.flatMap((d) => (medOf(d)?.cls || []).filter((c) => GLAUCOMA.has(c))));
  if (agents.size > 3) warnings.push(`${agents.size} glaucoma drug classes in the ${eyeLabel} (${listOf(glaucoma)}).`);
  if (byClass.has("MIO") && byClass.has("CYC"))
    warnings.push(`A miotic and a cycloplegic are both prescribed for the ${eyeLabel}. They work against each other.`);
  return warnings;
}

const ageInYears = (dob, today) => {
  if (!dob) return null;
  const [y, m, d] = dob.split("-").map(Number);
  let age = today.getFullYear() - y;
  if (today.getMonth() + 1 < m || (today.getMonth() + 1 === m && today.getDate() < d)) age--;
  return age;
};

export function dropWarnings(drops, formulary, classNames, { dob = "", today = new Date() } = {}) {
  const medOf = (d) => formulary.find((m) => m.brand === d.brand);
  const active = drops.filter((d) => d.brand);
  const all = [
    ...eyeWarnings(active.filter((d) => d.eye !== "OS"), medOf, "right eye", classNames),
    ...eyeWarnings(active.filter((d) => d.eye !== "OD"), medOf, "left eye", classNames),
  ];

  // Topical beta blockers are absorbed systemically, so one in each eye adds up.
  const bb = [...new Set(active.filter((d) => medOf(d)?.cls.includes("BB")).map((d) => d.brand))];
  const bbEyes = new Set(active.filter((d) => medOf(d)?.cls.includes("BB")).flatMap((d) => (d.eye === "OU" ? ["OD", "OS"] : [d.eye])));
  if (bb.length > 1 && bbEyes.size === 2 && !all.some((w) => w.includes("beta blocker")))
    all.push(`${listOf(bb)} both contain a beta blocker. Two topical beta blockers are not recommended.`);

  const age = ageInYears(dob, today);
  for (const d of active) {
    const med = medOf(d);
    if (!med) continue;
    const mode = modeOf(d);
    const peak = mode === "taper" ? Math.max(...d.steps.map((s) => s.freq)) : d.freq;
    if (mode === "ongoing" && med.cls.some((c) => ["STER", "NSAID", "ABX", "CYC"].includes(c)))
      all.push(`${d.brand} is set to ongoing. Steroids, NSAIDs, antibiotics and cycloplegics usually have a set course or taper.`);
    if (med.maxFreq && peak > med.maxFreq)
      all.push(`${d.brand} is set to ${peak} times a day. The label maximum is ${med.maxFreq === 1 ? "once" : `${med.maxFreq} times`} a day.`);
    // Steroids raise eye pressure in some people, so a longer course needs a
    // pressure check booked.
    const days = mode === "taper" ? d.steps.reduce((n, st) => n + (Number(st.days) || 0), 0) : mode === "duration" ? Number(d.durationDays) || 0 : 0;
    if (med.cls.includes("STER") && days > 14)
      all.push(`${d.brand} runs for ${days} days. Book an eye pressure check within 2 to 4 weeks of starting, sooner with glaucoma.`);
    if (d.drops > 1) all.push(`${d.brand} is set to ${d.drops} drops each time. One drop is usually enough.`);
    if (med.cls.includes("AA") && age != null && age < 18)
      all.push(`${d.brand}: brimonidine is contraindicated under 2 years and not recommended under 18.`);
    if (d.mode === "taper" && d.steps.some((s, i) => i > 0 && s.freq > d.steps[i - 1].freq))
      all.push(`${d.brand}: a taper step goes up in frequency. Check the steps.`);
    if (d.mode === "taper" && totalDays(d) > 120) all.push(`${d.brand}: the taper lasts ${totalDays(d)} days.`);
  }
  return mergeEyes([...new Set(all)]);
}

// The same warning for each eye reads once, as "both eyes".
function mergeEyes(list) {
  const key = (w) => w.replace(/(the )?(right|left) eye/, "{eye}");
  const out = [];
  for (const w of list) {
    const k = key(w);
    const twin = w.includes("right eye") && list.find((x) => x !== w && x.includes("left eye") && key(x) === k);
    if (twin) out.push(k.replace("{eye}", "both eyes"));
    else if (!(w.includes("left eye") && list.some((x) => x !== w && x.includes("right eye") && key(x) === k))) out.push(w);
  }
  return out;
}
