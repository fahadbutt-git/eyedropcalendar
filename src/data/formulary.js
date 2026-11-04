// Default formulary. Every field is editable in the Formulary tab, and edits
// are saved in the user's browser. Only products marketed in Canada on Health
// Canada's Drug Product Database (checked November 2026) are listed. Doses
// follow the Canadian product monographs. LU codes follow the Ontario Drug
// Benefit formulary. Generic versions are found by searching the generic
// name or the "aka" names.
//
// cls     drug classes, used for duplicate-therapy warnings
// cap     AAO standard cap colour by class. Verify against local product.
// form    "solution" | "suspension" | "emulsion" | "gel" | "ointment" (sets
//         shake-well advice and the order drops go in)
// qhs     true when once-daily dosing is usually given at bedtime
// lu      the LU codes that can apply; the prescriber picks one on the Rx.
//         Left empty where the ODB code could not be confirmed (Monoprost,
//         Vistitan, Zimed PF, dorzolamide) or the drug is not an LU benefit.
// maxFreq label maximum doses a day, when the label sets one
// aka     other names the drug is searched by (such as a US brand name)

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
  ALG: "Anti-allergy",
  IMM: "Dry eye immunomodulator",
  AV: "Antiviral",
  AF: "Antifungal",
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

export { FORMS } from "./forms.js";

// ODB Limited Use reason-for-use codes and their criteria, from the Ontario
// Drug Benefit e-Formulary (checked November 2026). The prescriber decides
// whether the patient meets them.
export const LU_CRITERIA = {
  171: "First line, beta blocker not tolerated or contraindicated",
  172: "Second line, inadequate response to a beta blocker",
  387: "Added to a beta blocker in an urgent situation",
  310: "Second line, after beta blocker monotherapy",
  393: "Initial therapy in an urgent situation",
  466: "Second line, after brinzolamide or brimonidine alone",
};
// Written on the prescription when ODB applies but the criteria are not met.
export const LU_NOT_MET = "not-met";

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
  aka: "",
  ...extra,
});
const PGA = { cap: "teal", qhs: true, maxFreq: 1 };

const SEED = [
  // Glaucoma
  d("Alphagan", "Brimonidine 0.2%", ["AA"], 2, LU_SINGLE, { cap: "purple", maxFreq: 2, aka: "generic brimonidine 0.2%" }),
  d("Alphagan-P", "Brimonidine 0.15%", ["AA"], 3, LU_SINGLE, { cap: "purple", maxFreq: 3, aka: "Brimonidine P" }),
  d("Azarga", "Brinzolamide 1% / timolol 0.5%", ["CAI", "BB"], 2, LU_COMBO, { cap: "darkblue", form: "suspension", maxFreq: 2 }),
  d("Azopt", "Brinzolamide 1%", ["CAI"], 2, LU_SINGLE, { cap: "orange", form: "suspension", maxFreq: 3 }),
  d("Combigan", "Brimonidine 0.2% / timolol 0.5%", ["AA", "BB"], 2, LU_COMBO, { cap: "darkblue", maxFreq: 2, aka: "generic brimonidine-timolol" }),
  d("Cosopt", "Dorzolamide 2% / timolol 0.5%", ["CAI", "BB"], 2, LU_COMBO, { cap: "darkblue", maxFreq: 2, aka: "generic dorzolamide-timolol" }),
  d("Cosopt-PF", "Dorzolamide 2% / timolol 0.5% (preservative free)", ["CAI", "BB"], 2, LU_COMBO, { cap: "darkblue", maxFreq: 2 }),
  d("DuoTrav PQ", "Travoprost 0.004% / timolol 0.5%", ["PGA", "BB"], 1, LU_COMBO, { cap: "darkblue", maxFreq: 1, aka: "Apo-Travoprost-Timop PQ" }),
  // The Trusopt brand is discontinued in Canada; generic dorzolamide remains.
  d("Dorzolamide", "Dorzolamide 2%", ["CAI"], 3, [], { cap: "orange", maxFreq: 3 }),
  d("Iopidine", "Apraclonidine 0.5%", ["AA"], 3, [], { cap: "purple", maxFreq: 3 }),
  d("Lumigan RC", "Bimatoprost 0.01%", ["PGA"], 1, LU_SINGLE, { ...PGA, aka: "generic bimatoprost 0.01%" }),
  d("Monoprost", "Latanoprost 0.005% (preservative free)", ["PGA"], 1, [], PGA),
  d("Pilocarpine", "Pilocarpine 2%", ["MIO"], 4, [], { cap: "green", maxFreq: 4, aka: "Isopto Carpine" }),
  d("Simbrinza", "Brinzolamide 1% / brimonidine 0.2%", ["CAI", "AA"], 2, ["393", "466"], { cap: "lightgreen", form: "suspension", maxFreq: 2 }),
  d("Timolol 0.25%", "Timolol 0.25%", ["BB"], 2, [], { cap: "yellow", maxFreq: 2 }),
  d("Timoptic", "Timolol 0.5%", ["BB"], 2, [], { cap: "yellow", maxFreq: 2, aka: "generic timolol" }),
  d("Timoptic-XE", "Timolol 0.5% gel-forming solution", ["BB"], 1, [], { cap: "yellow", form: "gel", maxFreq: 1 }),
  d("Travatan Z", "Travoprost 0.004%", ["PGA"], 1, LU_SINGLE, { ...PGA, aka: "generic travoprost" }),
  d("Vistitan", "Bimatoprost 0.03%", ["PGA"], 1, [], PGA),
  d("Vyzulta", "Latanoprostene bunod 0.024%", ["PGA"], 1, LU_SINGLE, PGA),
  d("Xalacom", "Latanoprost 0.005% / timolol 0.5%", ["PGA", "BB"], 1, LU_COMBO, { cap: "darkblue", maxFreq: 1, aka: "generic latanoprost-timolol" }),
  d("Xalatan", "Latanoprost 0.005%", ["PGA"], 1, LU_SINGLE, { ...PGA, aka: "generic latanoprost" }),
  d("Zimed PF", "Bimatoprost 0.03% (preservative free)", ["PGA"], 1, [], { ...PGA, aka: "ZimedMD" }),

  // Corticosteroids
  d("Durezol", "Difluprednate 0.05%", ["STER"], 4, [], { cap: "pink", form: "emulsion", maxFreq: 4 }),
  d("FML", "Fluorometholone 0.1%", ["STER"], 4, [], { cap: "pink", form: "suspension", aka: "generic fluorometholone" }),
  d("Lotemax", "Loteprednol etabonate 0.5%", ["STER"], 4, [], { cap: "pink", form: "suspension", maxFreq: 4 }),
  d("Lotemax Gel", "Loteprednol etabonate 0.5% gel", ["STER"], 4, [], { cap: "pink", form: "gel", maxFreq: 4 }),
  d("Lotemax Ointment", "Loteprednol etabonate 0.5% ointment", ["STER"], 4, [], { form: "ointment", maxFreq: 4 }),
  d("Maxidex", "Dexamethasone 0.1%", ["STER"], 4, [], { cap: "pink", form: "suspension", maxFreq: 6 }),
  d("Maxidex Ointment", "Dexamethasone 0.1% ointment", ["STER"], 3, [], { form: "ointment", maxFreq: 4 }),
  d("Pred Forte", "Prednisolone acetate 1%", ["STER"], 4, [], { cap: "pink", form: "suspension" }),

  // NSAIDs
  d("Acular", "Ketorolac 0.5%", ["NSAID"], 4, [], { cap: "grey", maxFreq: 4, aka: "generic ketorolac" }),
  d("Ilevro", "Nepafenac 0.3%", ["NSAID"], 1, [], { cap: "grey", form: "suspension", maxFreq: 1 }),
  d("Nevanac", "Nepafenac 0.1%", ["NSAID"], 3, [], { cap: "grey", form: "suspension", maxFreq: 3 }),
  d("Prolensa", "Bromfenac 0.07%", ["NSAID"], 1, [], { cap: "grey", maxFreq: 1 }),

  // Antibiotics
  d("Besivance", "Besifloxacin 0.6%", ["ABX"], 3, [], { cap: "tan", form: "suspension", maxFreq: 3 }),
  d("Ciloxan", "Ciprofloxacin 0.3%", ["ABX"], 4, [], { cap: "tan", maxFreq: 8 }),
  d("Ciloxan Ointment", "Ciprofloxacin 0.3% ointment", ["ABX"], 3, [], { form: "ointment" }),
  d("Erythromycin Ointment", "Erythromycin 0.5% ointment", ["ABX"], 4, [], { form: "ointment", maxFreq: 6 }),
  d("Fucithalmic", "Fusidic acid 1% viscous drops", ["ABX"], 2, [], { form: "gel", maxFreq: 2 }),
  d("Ocuflox", "Ofloxacin 0.3%", ["ABX"], 4, [], { cap: "tan", maxFreq: 8 }),
  d("Polytrimethoprim", "Polymyxin B / trimethoprim", ["ABX"], 6, [], { cap: "tan", maxFreq: 6 }),
  d("Tobrex", "Tobramycin 0.3%", ["ABX"], 4, [], { cap: "tan", maxFreq: 8, aka: "generic tobramycin" }),
  d("Tobrex Ointment", "Tobramycin 0.3% ointment", ["ABX"], 3, [], { form: "ointment" }),
  d("Vigamox", "Moxifloxacin 0.5%", ["ABX"], 3, [], { cap: "tan", maxFreq: 3, aka: "generic moxifloxacin" }),
  d("Zymar", "Gatifloxacin 0.3%", ["ABX"], 4, [], { cap: "tan", maxFreq: 8, aka: "generic gatifloxacin" }),

  // Steroid and antibiotic combinations
  d("Maxitrol", "Dexamethasone 0.1% / neomycin / polymyxin B", ["STER", "ABX"], 4, [], { cap: "pink", form: "suspension", maxFreq: 6 }),
  d("Maxitrol Ointment", "Dexamethasone 0.1% / neomycin / polymyxin B ointment", ["STER", "ABX"], 3, [], { form: "ointment", maxFreq: 4 }),
  d("Sofracort", "Dexamethasone / framycetin / gramicidin", ["STER", "ABX"], 4, [], {}),
  d("TobraDex", "Tobramycin 0.3% / dexamethasone 0.1%", ["STER", "ABX"], 4, [], { cap: "pink", form: "suspension", maxFreq: 6 }),
  d("TobraDex Ointment", "Tobramycin 0.3% / dexamethasone 0.1% ointment", ["STER", "ABX"], 3, [], { form: "ointment", maxFreq: 4 }),

  // Anti-allergy
  d("Alomide", "Lodoxamide 0.1%", ["ALG"], 4, [], { maxFreq: 4 }),
  d("Bepreve", "Bepotastine 1.5%", ["ALG"], 2, [], { maxFreq: 2 }),
  d("Pataday", "Olopatadine 0.2%", ["ALG"], 1, [], { maxFreq: 1 }),
  d("Patanol", "Olopatadine 0.1%", ["ALG"], 2, [], { maxFreq: 2, aka: "generic olopatadine" }),
  d("Pazeo", "Olopatadine 0.7%", ["ALG"], 1, [], { maxFreq: 1 }),
  d("Zaditor", "Ketotifen 0.025%", ["ALG"], 2, [], { maxFreq: 2 }),

  // Dry eye
  d("Cequa", "Cyclosporine 0.09%", ["IMM"], 2, [], { maxFreq: 2 }),
  d("Miebo", "Perfluorohexyloctane", ["LUB"], 4, [], { maxFreq: 4 }),
  d("Restasis", "Cyclosporine 0.05% (single-use vials)", ["IMM"], 2, [], { form: "emulsion", maxFreq: 2 }),
  d("Restasis Multidose", "Cyclosporine 0.05%", ["IMM"], 2, [], { form: "emulsion", maxFreq: 2 }),
  d("Verkazia", "Cyclosporine 0.1% (single-use vials)", ["IMM"], 4, [], { form: "emulsion", maxFreq: 4 }),
  d("Xiidra", "Lifitegrast 5% (single-use vials)", ["IMM"], 2, [], { maxFreq: 2 }),

  // Antiviral
  // Five times a day until the cornea heals, then three times a day for 7
  // days: set it up as a taper.
  d("Eyezirgan", "Ganciclovir 0.15% gel", ["AV"], 5, [], { form: "gel", maxFreq: 5 }),

  // Dilating and cycloplegic
  d("Atropine", "Atropine sulfate 1%", ["CYC"], 3, [], { cap: "red", aka: "Isopto Atropine, Minims Atropine" }),
  d("Cyclogyl", "Cyclopentolate 1%", ["CYC"], 3, [], { cap: "red" }),

  // Other
  d("Cystadrops", "Cysteamine 0.37% viscous solution", ["OTHER"], 4, [], { form: "gel", maxFreq: 4 }),
];

export const SEED_FORMULARY = SEED.map((m, i) => ({ id: i + 1, ...m }));

export const FORMULARY_VERSION = 7;
