import { useState } from "react";
import { codeFromUrl, decodeRegimen } from "../../lib/share.js";

// At a follow-up visit the clinician pastes the patient's link and changes
// the plan rather than typing it in again. The plan keeps its start date and
// its plan ID, so taper days still line up and the patient's phone replaces
// the old plan instead of adding a second one.
export default function OpenPlan({ formulary, hasDrops, onOpen }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");

  const open = (e) => {
    e.preventDefault();
    let plan;
    try {
      plan = decodeRegimen(codeFromUrl(text));
    } catch {
      setError("That link did not open. Copy the whole link from the patient's phone or the chart note and try again.");
      return;
    }
    if (hasDrops && !window.confirm("Replace the drops on this page with the plan from the link?")) return;
    const missing = plan.entries.map((x) => x.brand).filter((b) => !formulary.some((m) => m.brand === b));
    onOpen(plan, missing);
    setText("");
    setError(missing.length ? `These drops are not in your formulary. Check them: ${[...new Set(missing)].join(", ")}.` : "");
  };

  return (
    <details className="more open-plan">
      <summary>Change a plan from an earlier visit</summary>
      <form className="open-plan-form" onSubmit={open}>
        <label className="field">
          <span className="field-label">Patient&apos;s plan link</span>
          <input
            className="input"
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste the link from their phone or chart"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
          />
        </label>
        <button className="btn" type="submit" disabled={!text.trim()}>
          Open plan
        </button>
      </form>
      <p className="small">
        The plan keeps its start date, so a taper can be changed from today on. Enter the patient&apos;s details again, then print the new
        calendar. Their phone app replaces the old plan when they scan the new code.
      </p>
      {error && (
        <p className="notice warn" role="alert">
          {error}
        </p>
      )}
    </details>
  );
}
