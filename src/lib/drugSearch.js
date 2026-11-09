// Formulary search for the drug picker. A generic name puts the usual
// product first: the plain solution at the standard strength, marked in the
// formulary by an "aka" of "generic <name>". Preservative-free, gel,
// ointment, single-use and combination products follow.

const textOf = (m) => `${m.brand} ${m.generic} ${m.aka || ""}`.toLowerCase();
const VARIANT = /preservative free|ointment|gel|single-use|viscous/i;

function rank(m, q) {
  const brand = m.brand.toLowerCase();
  const generic = m.generic.toLowerCase();
  const aka = (m.aka || "").toLowerCase();
  const combo = generic.includes("/");
  const variant = VARIANT.test(m.generic) || /-(xe|pf)\b/i.test(m.brand);
  let tier;
  if (!combo && aka.split(/,\s*/).some((a) => a.startsWith(`generic ${q}`))) tier = 0;
  else if (brand === q) tier = 0;
  else if (brand.startsWith(q) && !variant && !combo) tier = 1;
  else if (generic.startsWith(q) && !variant && !combo) tier = 2;
  else if (brand.startsWith(q) || generic.startsWith(q)) tier = 3;
  else tier = 4;
  return tier * 4 + (combo ? 2 : 0) + (variant ? 1 : 0);
}

export function searchFormulary(formulary, query, groupOf = () => 0) {
  const q = query.trim().toLowerCase();
  return [...formulary]
    .filter((m) => !q || textOf(m).includes(q))
    .sort((a, b) => (q ? rank(a, q) - rank(b, q) : groupOf(a) - groupOf(b)) || a.brand.localeCompare(b.brand));
}

// Enter alone picks only when the search leaves no doubt: a single match, or
// a product named exactly. Otherwise the clinician chooses from the list.
export function soleMatch(matches, query) {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  if (matches.length === 1) return matches[0];
  return matches.find((m) => m.brand.toLowerCase() === q) || null;
}
