// The three steps of a visit, and the clinic's formulary.
export const STEPS = [
  ["regimen", "Patient and drops", "Drops"],
  ["schedule", "Calendar", "Calendar"],
  ["rx", "Prescription", "Rx"],
];
export const TITLES = { regimen: "Patient and drops", schedule: "Calendar", rx: "Prescription", formulary: "Formulary" };

export default function StepNav({ tab, go, locked }) {
  return (
    <nav className="steps" aria-label="Steps">
      {STEPS.map(([key, label, short], i) => (
        <button
          key={key}
          className={`step ${tab === key ? "active" : ""}`}
          aria-current={tab === key ? "step" : undefined}
          disabled={i > 0 && locked}
          onClick={() => go(key)}
        >
          <span className="step-num">{i + 1}</span> <span className="long">{label}</span>
          <span className="short">{short}</span>
        </button>
      ))}
      <button
        className={`step plain ${tab === "formulary" ? "active" : ""}`}
        aria-current={tab === "formulary" ? "page" : undefined}
        onClick={() => go("formulary")}
      >
        Formulary
      </button>
    </nav>
  );
}
