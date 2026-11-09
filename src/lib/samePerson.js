// Decides whether a name or date of birth typed over the patient on screen
// still means the same person. A typo fix, a reordered name or added detail
// is the same person. Any other name, or a different date of birth, asks
// whether this is a new patient, so the last plan never carries over.

const tokens = (name) =>
  String(name || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

function distance(a, b) {
  const row = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    let prev = row[0];
    row[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const next = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row[j];
      row[j] = next;
    }
  }
  return row[b.length];
}

// Every word of the shorter name starts a word of the longer one.
const covers = (short, long) => short.every((t) => long.some((u) => u.startsWith(t)));

export function sameName(a, b) {
  const x = tokens(a);
  const y = tokens(b);
  if (!x.length || !y.length) return true;
  if (covers(x, y) || covers(y, x)) return true;
  // A small typing slip in an otherwise identical name.
  return distance([...x].sort().join(" "), [...y].sort().join(" ")) <= 2;
}

// `owner` is the person the plan on screen was made for. Blank fields are
// not a different person: they are details not yet entered.
export function differentPerson(owner, now) {
  if (!owner || !now) return false;
  if (owner.name && now.name && !sameName(owner.name, now.name)) return true;
  if (owner.dob && now.dob && owner.dob !== now.dob) return true;
  return false;
}
