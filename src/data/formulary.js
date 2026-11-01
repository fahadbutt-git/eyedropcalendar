// Default formulary. Every field is editable in the Formulary tab, and edits
// are saved in the user's browser.
//
// cls   drug classes, used for duplicate-therapy warnings
// cap   AAO standard cap colour by class (single-agent drugs only). Fixed
//       combinations and preservative-free unit doses are left blank because
//       their caps are not standardised. Verify against local product.
// form  "solution" | "suspension" | "gel" (sets shake-well and order advice)
// qhs   true when once-daily dosing is usually given at bedtime

export const DRUG_CLASSES = {
  PGA: "Prostaglandin analogue",
  BB: "Beta blocker",
  CAI: "Carbonic anhydrase inhibitor",
  AA: "Alpha agonist",
  MIO: "Miotic",
  STER: "Corticosteroid",
  NSAID: "NSAID",
  ABX: "Antibiotic",
  CYC: "Cycloplegic / mydriatic",
  LUB: "Lubricant",
  OTHER: "Other",
};

export const CAP_COLOURS = {
  "": { label: "Not specified", hex: "transparent" },
  teal: { label: "Teal", hex: "#1f8079" },
  yellow: { label: "Yellow", hex: "#f2c230" },
  blue: { label: "Light blue", hex: "#5fa8e0" },
  darkblue: { label: "Dark blue", hex: "#25428f" },
  purple: { label: "Purple", hex: "#7b4fb8" },
  orange: { label: "Orange", hex: "#ee8a2a" },
  green: { label: "Dark green", hex: "#2e6b3c" },
  red: { label: "Red", hex: "#c8362f" },
  pink: { label: "Pink", hex: "#e58bb0" },
  grey: { label: "Grey", hex: "#8c939c" },
  tan: { label: "Tan", hex: "#c9a77c" },
  white: { label: "White", hex: "#ffffff" },
};

const d = (brand, generic, cls, freq, lu, extra = {}) => ({
  brand,
  generic,
  cls,
  freq,
  drops: 1,
  lu,
  cap: "",
  form: "solution",
  qhs: false,
  ...extra,
});

const SEED = [
  d("Alphagan", "Brimonidine 0.2%", ["AA"], 2, "172", { cap: "purple" }),
  d("Alphagan-P", "Brimonidine 0.15%", ["AA"], 2, "172", { cap: "purple" }),
  d("Azarga", "Brinzolamide 1% / timolol 0.5%", ["CAI", "BB"], 2, "310", { form: "suspension" }),
  d("Azopt", "Brinzolamide 1%", ["CAI"], 2, "172", { cap: "orange", form: "suspension" }),
  d("Betagan", "Levobunolol 0.5%", ["BB"], 2, "", { cap: "yellow" }),
  d("Betoptic-S", "Betaxolol 0.25%", ["BB"], 2, "", { cap: "blue", form: "suspension" }),
  d("Combigan", "Brimonidine 0.2% / timolol 0.5%", ["AA", "BB"], 2, "310"),
  d("Cosopt", "Dorzolamide 2% / timolol 0.5%", ["CAI", "BB"], 2, "310"),
  d("Cosopt-PF", "Dorzolamide 2% / timolol 0.5% (preservative free)", ["CAI", "BB"], 2, "310"),
  d("DuoTrav", "Travoprost 0.004% / timolol 0.5%", ["PGA", "BB"], 1, "310"),
  d("Izba", "Travoprost 0.003%", ["PGA"], 1, "172", { cap: "teal", qhs: true }),
  d("Lumigan RC", "Bimatoprost 0.01%", ["PGA"], 1, "172", { cap: "teal", qhs: true }),
  d("Monoprost", "Latanoprost 0.005% (preservative free)", ["PGA"], 1, "172", { qhs: true }),
  d("Pilocarpine", "Pilocarpine 2%", ["MIO"], 3, "", { cap: "green" }),
  d("Simbrinza", "Brinzolamide 1% / brimonidine 0.2%", ["CAI", "AA"], 2, "393", { form: "suspension" }),
  d("Timoptic", "Timolol 0.5%", ["BB"], 2, "", { cap: "yellow" }),
  d("Timoptic-XE", "Timolol 0.5% gel-forming solution", ["BB"], 1, "", { cap: "yellow", form: "gel" }),
  d("Travatan Z", "Travoprost 0.004%", ["PGA"], 1, "172", { cap: "teal", qhs: true }),
  d("Trusopt", "Dorzolamide 2%", ["CAI"], 2, "172", { cap: "orange" }),
  d("Trusopt-PF", "Dorzolamide 2% (preservative free)", ["CAI"], 2, "172"),
  d("Vistitan", "Bimatoprost 0.03%", ["PGA"], 1, "172", { cap: "teal", qhs: true }),
  d("Vyzulta", "Latanoprostene bunod 0.024%", ["PGA"], 1, "172", { cap: "teal", qhs: true }),
  d("Xalacom", "Latanoprost 0.005% / timolol 0.5%", ["PGA", "BB"], 1, "310"),
  d("Xalatan", "Latanoprost 0.005%", ["PGA"], 1, "172", { cap: "teal", qhs: true }),
  d("Zimed PF", "Bimatoprost 0.03% (preservative free)", ["PGA"], 1, "172", { qhs: true }),
  d("Pred Forte", "Prednisolone acetate 1%", ["STER"], 4, "", { cap: "pink", form: "suspension" }),
  d("Durezol", "Difluprednate 0.05%", ["STER"], 4, "", { cap: "pink" }),
  d("Nevanac", "Nepafenac 0.1%", ["NSAID"], 3, "", { cap: "grey", form: "suspension" }),
  d("Prolensa", "Bromfenac 0.07%", ["NSAID"], 1, "", { cap: "grey" }),
  d("Vigamox", "Moxifloxacin 0.5%", ["ABX"], 4, "", { cap: "tan" }),
  d("Atropine", "Atropine sulfate 1%", ["CYC"], 3, "", { cap: "red" }),
];

export const SEED_FORMULARY = SEED.map((m, i) => ({ id: i + 1, ...m }));

export const FORMULARY_VERSION = 3;
