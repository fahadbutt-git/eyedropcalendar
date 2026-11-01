// Contraindications and precautions to check with the patient, grouped by
// drug class. Yellow, to keep them apart from the red conflicts in the plan.
export default function Cautions({ cautions }) {
  if (!cautions.length) return null;
  return (
    <details className="notice caution" open>
      <summary>
        <b>Prescribing cautions</b> <span className="hint">Check these with the patient</span>
      </summary>
      <dl>
        {cautions.map((c) => (
          <div key={c.key}>
            <dt>
              {c.title}
              {c.drugs.length > 0 && c.drugs.join(", ") !== c.title && <span> · {c.drugs.join(", ")}</span>}
            </dt>
            <dd>{c.text}</dd>
          </div>
        ))}
      </dl>
      <p className="hint">Summarised from the product monographs. Not a complete list.</p>
    </details>
  );
}
