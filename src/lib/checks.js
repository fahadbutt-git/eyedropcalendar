// Duplicate therapy checks, run separately for each eye.

const IGNORED = new Set(["OTHER", "LUB"]);

function eyeWarnings(drops, formulary, eyeLabel, classNames) {
  const warnings = [];
  const seen = new Set();
  const byClass = new Map();
  for (const d of drops) {
    if (seen.has(d.brand)) warnings.push(`${d.brand} is listed twice for the ${eyeLabel}.`);
    seen.add(d.brand);
    const med = formulary.find((m) => m.brand === d.brand);
    for (const c of med?.cls || []) {
      if (IGNORED.has(c)) continue;
      if (!byClass.has(c)) byClass.set(c, new Set());
      byClass.get(c).add(d.brand);
    }
  }
  for (const [c, brands] of byClass) {
    if (brands.size < 2) continue;
    const names = [...brands];
    const list = names.length === 2 ? names.join(" and ") : `${names.slice(0, -1).join(", ")} and ${names.at(-1)}`;
    const verb = names.length === 2 ? "both contain" : "all contain";
    warnings.push(`${list} ${verb} a ${(classNames[c] || c).toLowerCase()} (${eyeLabel}).`);
  }
  return warnings;
}

export function dropWarnings(drops, formulary, classNames) {
  const active = drops.filter((d) => d.brand);
  const all = [
    ...eyeWarnings(active.filter((d) => d.eye !== "OS"), formulary, "right eye", classNames),
    ...eyeWarnings(active.filter((d) => d.eye !== "OD"), formulary, "left eye", classNames),
  ];
  return [...new Set(all)];
}
