// Default formulary. Every field is editable in the Formulary tab, and edits
// are saved in the user's browser. Doses follow the Canadian product
// monographs. LU codes follow the Ontario Drug Benefit formulary.
//
// cls     drug classes, used for duplicate-therapy warnings
// cap     AAO standard cap colour by class. Verify against local product.
// form    "solution" | "suspension" | "emulsion" | "gel" (sets shake-well
//         advice and the order drops go in)
// qhs     true when once-daily dosing is usually given at bedtime
// lu      the LU codes that can apply; the prescriber picks one on the Rx.
//         Left empty where the ODB code could not be confirmed (Monoprost,
//         Vistitan, ZimedMD PF, dorzolamide) or the drug is not an LU benefit.
// maxFreq label maximum doses a day, when the label sets one

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
  lightgreen: { label: "Light green", hex: "#8fcf7e" },
};

export const FORMS = ["solution", "suspension", "emulsion", "gel"];

// ODB Limited Use codes, by product type.
const LU_SINGLE = ["171", "172", "387"];
const LU_COMBO = ["310", "393"];

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
  maxFreq: null,
  ...extra,
});
const PGA = { cap: "teal", qhs: true, maxFreq: 1 };

const SEED = [
  d("Alphagan", "Brimonidine 0.2%", ["AA"], 2, LU_SINGLE, { cap: "purple", maxFreq: 2 }),
  d("Alphagan-P", "Brimonidine 0.15%", ["AA"], 3, LU_SINGLE, { cap: "purple", maxFreq: 3 }),
  d("Azarga", "Brinzolamide 1% / timolol 0.5%", ["CAI", "BB"], 2, LU_COMBO, { cap: "darkblue", form: "suspension", maxFreq: 2 }),
  d("Azopt", "Brinzolamide 1%", ["CAI"], 2, LU_SINGLE, { cap: "orange", form: "suspension", maxFreq: 3 }),
  d("Betoptic-S", "Betaxolol 0.25%", ["BB"], 2, [], { cap: "blue", form: "suspension", maxFreq: 2 }),
  d("Combigan", "Brimonidine 0.2% / timolol 0.5%", ["AA", "BB"], 2, LU_COMBO, { cap: "darkblue", maxFreq: 2 }),
  d("Cosopt", "Dorzolamide 2% / timolol 0.5%", ["CAI", "BB"], 2, LU_COMBO, { cap: "darkblue", maxFreq: 2 }),
  d("Cosopt-PF", "Dorzolamide 2% / timolol 0.5% (preservative free)", ["CAI", "BB"], 2, LU_COMBO, { cap: "darkblue", maxFreq: 2 }),
  d("DuoTrav PQ", "Travoprost 0.004% / timolol 0.5%", ["PGA", "BB"], 1, LU_COMBO, { cap: "darkblue", maxFreq: 1 }),
  d("Izba", "Travoprost 0.003%", ["PGA"], 1, LU_SINGLE, PGA),
  d("Lumigan RC", "Bimatoprost 0.01%", ["PGA"], 1, LU_SINGLE, PGA),
  d("Monoprost", "Latanoprost 0.005% (preservative free)", ["PGA"], 1, [], PGA),
  d("Pilocarpine", "Pilocarpine 2%", ["MIO"], 4, [], { cap: "green", maxFreq: 4 }),
  d("Simbrinza", "Brinzolamide 1% / brimonidine 0.2%", ["CAI", "AA"], 2, ["393", "466"], { cap: "lightgreen", form: "suspension", maxFreq: 2 }),
  d("Timoptic", "Timolol 0.5%", ["BB"], 2, [], { cap: "yellow", maxFreq: 2 }),
  d("Timoptic-XE", "Timolol 0.5% gel-forming solution", ["BB"], 1, [], { cap: "yellow", form: "gel", maxFreq: 1 }),
  d("Travatan Z", "Travoprost 0.004%", ["PGA"], 1, LU_SINGLE, PGA),
  // The Trusopt brand is discontinued in Canada; generic dorzolamide remains.
  d("Dorzolamide", "Dorzolamide 2%", ["CAI"], 3, [], { cap: "orange", maxFreq: 3 }),
  d("Vistitan", "Bimatoprost 0.03%", ["PGA"], 1, [], PGA),
  d("Vyzulta", "Latanoprostene bunod 0.024%", ["PGA"], 1, LU_SINGLE, PGA),
  d("Xalacom", "Latanoprost 0.005% / timolol 0.5%", ["PGA", "BB"], 1, LU_COMBO, { cap: "darkblue", maxFreq: 1 }),
  d("Xalatan", "Latanoprost 0.005%", ["PGA"], 1, LU_SINGLE, PGA),
  d("ZimedMD PF", "Bimatoprost 0.03% (preservative free)", ["PGA"], 1, [], PGA),
  d("Pred Forte", "Prednisolone acetate 1%", ["STER"], 4, [], { cap: "pink", form: "suspension" }),
  d("Durezol", "Difluprednate 0.05%", ["STER"], 4, [], { cap: "pink", form: "emulsion", maxFreq: 4 }),
  d("Nevanac", "Nepafenac 0.1%", ["NSAID"], 3, [], { cap: "grey", form: "suspension", maxFreq: 3 }),
  d("Prolensa", "Bromfenac 0.07%", ["NSAID"], 1, [], { cap: "grey", maxFreq: 1 }),
  d("Vigamox", "Moxifloxacin 0.5%", ["ABX"], 3, [], { cap: "tan" }),
  d("Atropine", "Atropine sulfate 1%", ["CYC"], 3, [], { cap: "red" }),
];

export const SEED_FORMULARY = SEED.map((m, i) => ({ id: i + 1, ...m }));

export const FORMULARY_VERSION = 5;
