import { useState } from "react";

// Adds the chart note to the Oscar chart the plan was read from, as an
// unsigned note the clinician signs there. Shown only when the plan came
// from Oscar through the extension.
export default function AddToChart({ text, add }) {
  const [state, setState] = useState({ busy: false, result: null });
  const run = async () => {
    setState({ busy: true, result: null });
    setState({ busy: false, result: await add(text) });
  };
  return (
    <>
      <button type="button" className="btn sm" onClick={run} disabled={state.busy || state.result?.ok}>
        {state.busy ? "Adding to Oscar…" : state.result?.ok ? "Added to Oscar chart" : "Add to Oscar chart"}
      </button>
      <p className={`hint ${state.result && !state.result.ok ? "error-text" : ""}`} role="status">
        {state.result?.message || "Adds the same text to the chart this plan was read from, as an unsigned note."}
      </p>
    </>
  );
}
