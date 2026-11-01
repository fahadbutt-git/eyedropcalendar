// Prescribing cautions by drug class, summarised from the Canadian product
// monographs. They are prompts to check with the patient, not a complete list
// of contraindications. Drug-specific notes add to the class note.

export const CLASS_CAUTIONS = {
  BB: {
    title: "Beta blocker",
    text: "Contraindicated in asthma or a history of asthma, severe COPD, sinus bradycardia, sick sinus syndrome, second or third degree heart block, overt heart failure and cardiogenic shock. Can mask the signs of hypoglycaemia and hyperthyroidism. Betaxolol is more selective but still needs care in reactive airway disease.",
  },
  AA: {
    title: "Brimonidine",
    text: "Contraindicated with MAO inhibitors and in children under 2; not recommended in older children because of drowsiness and apnoea. Use with care in severe cardiovascular disease, depression and orthostatic hypotension. Drowsiness and fatigue are common. Long-term use can cause allergic follicular conjunctivitis.",
  },
  CAI: {
    title: "Carbonic anhydrase inhibitor",
    text: "A sulfonamide: avoid with a sulfonamide allergy. Not recommended in severe renal impairment (creatinine clearance under 30 mL/min) or with an oral carbonic anhydrase inhibitor. Use with care when the corneal endothelium is compromised.",
  },
  PGA: {
    title: "Prostaglandin analogue",
    text: "Can permanently darken the iris, and darken the eyelid skin (usually reversible) and lashes, which shows most when only one eye is treated. Use with care in active intraocular inflammation, a history of herpetic keratitis, and after cataract surgery when there is a risk of cystoid macular oedema.",
  },
  MIO: {
    title: "Pilocarpine",
    text: "Contraindicated in active iritis. Risk of retinal detachment, so examine the peripheral retina first, especially in high myopia. Dim vision in low light and brow ache: warn about driving at night.",
  },
  STER: {
    title: "Corticosteroid",
    text: "Raises intraocular pressure in steroid responders: check it within 2 to 4 weeks, sooner in glaucoma. Contraindicated in active herpes simplex keratitis, other viral infections of the cornea and conjunctiva (such as varicella and vaccinia), fungal or mycobacterial eye infection and untreated bacterial infection. Prolonged use risks cataract and delayed healing.",
  },
  NSAID: {
    title: "NSAID",
    text: "Contraindicated with hypersensitivity to aspirin or other NSAIDs. Use with care with a bleeding tendency. Prolonged use, especially with a steroid, can cause corneal melt: stop if the epithelium breaks down.",
  },
  ABX: {
    title: "Fluoroquinolone",
    text: "Avoid with a quinolone allergy. Keep to the set course; prolonged use encourages resistance and overgrowth.",
  },
  CYC: {
    title: "Atropine",
    text: "Contraindicated in narrow angles or angle-closure glaucoma. Systemic effects (flushing, fever, fast heart rate, confusion) are more likely in children and older adults; press on the inner corner after each drop. Blurred near vision can last days.",
  },
};

export const DRUG_CAUTIONS = {
  Prolensa: "Contains sodium sulfite: avoid with a sulfite allergy.",
  Simbrinza:
    "Contraindicated with MAO inhibitors, tricyclic antidepressants or mianserin, a sulfonamide allergy, severe renal impairment, hyperchloraemic acidosis and in children under 2.",
  "Timoptic-XE": "Gel: use 10 minutes after any other drop.",
};

// Cautions for the drops in a plan, one per class, naming the drugs.
export function cautionsFor(drops, formulary) {
  const byClass = new Map();
  const extra = [];
  for (const d of drops) {
    const med = formulary.find((m) => m.brand === d.brand);
    for (const c of med?.cls || []) {
      if (!CLASS_CAUTIONS[c]) continue;
      if (!byClass.has(c)) byClass.set(c, new Set());
      byClass.get(c).add(d.brand);
    }
    if (DRUG_CAUTIONS[d.brand] && !extra.some((e) => e.drugs[0] === d.brand))
      extra.push({ key: d.brand, title: d.brand, drugs: [d.brand], text: DRUG_CAUTIONS[d.brand] });
  }
  const steroidWithGlaucoma = byClass.has("STER") && ["BB", "AA", "CAI", "PGA", "MIO"].some((c) => byClass.has(c));
  const list = [...byClass].map(([c, brands]) => ({ key: c, ...CLASS_CAUTIONS[c], drugs: [...brands] }));
  if (steroidWithGlaucoma)
    list.unshift({
      key: "ster-glaucoma",
      title: "Steroid with glaucoma treatment",
      drugs: [],
      text: "This patient is on glaucoma drops and a steroid. Check the pressure early and often while the steroid continues.",
    });
  return [...list, ...extra];
}
