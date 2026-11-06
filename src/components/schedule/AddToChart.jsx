import { useState } from "react";

// Adds the plan to the Oscar chart it was read from, as an unsigned note the
// clinician signs there. Shown only when the plan came from Oscar through the
// extension and the patient on screen is still that patient.
export default function AddToChart({ code, patient, add }) {
  const [state, setState] = useState({ busy: false, result: null });
  const run = async () => {
    setState({ busy: true, result: null });
    setState({ busy: false, result: await add(code) });
  };
  return (
    <>
      <button type="button" className="btn sm" onClick={run} disabled={state.busy || state.result?.ok}>
        {state.busy ? "Adding to Oscar…" : state.result?.ok ? "Added to Oscar chart" : "Add to Oscar chart"}
      </button>
      <p className={`hint ${state.result && !state.result.ok ? "error-text" : ""}`} role="status">
        {state.result?.message || `Adds this plan to ${patient}'s chart in Oscar, as an unsigned note.`}
      </p>
    </>
  );
}
