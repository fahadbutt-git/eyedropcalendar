import { FREQ_OPTIONS, TAPER_PRESETS, totalDays } from "../../lib/regimen.js";
import { freqAbbrev } from "../../lib/wording.js";

const MAX_STEPS = 10;
export const clampDays = (v) => Math.min(365, Math.max(1, Math.round(Number(v)) || 1));

export default function TaperEditor({ drop, update }) {
  const { steps } = drop;
  const setSteps = (next) => update({ steps: next });
  const setStep = (i, patch) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStep = () => {
    const last = steps.at(-1);
    setSteps([...steps, { freq: last ? Math.max(1, last.freq - 1) : drop.freq, days: last?.days ?? 7 }]);
  };

  return (
    <div className="taper" role="group" aria-label={`${drop.brand} taper`}>
      <div className="taper-head">
        <span className="taper-title">Taper</span>
        <select
          className="select sm"
          aria-label="Apply a taper template"
          value=""
          onChange={(e) => e.target.value !== "" && setSteps(TAPER_PRESETS[e.target.value].build(drop.freq))}
        >
          <option value="">Use a template</option>
          {TAPER_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <ol className="taper-steps">
        {steps.map((s, i) => (
          <li key={i} className="taper-step">
            <span className="step-n" aria-hidden="true">
              {i + 1}
            </span>
            <select
              className="select sm"
              aria-label={`Step ${i + 1}, times a day`}
              value={s.freq}
              onChange={(e) => setStep(i, { freq: Number(e.target.value) })}
            >
              {FREQ_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}x a day
                </option>
              ))}
            </select>
            <span className="muted">for</span>
            <input
              className="input sm num"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              aria-label={`Step ${i + 1}, number of days`}
              value={s.days}
              onChange={(e) => setStep(i, { days: clampDays(e.target.value) })}
            />
            <span className="muted">days</span>
            <button
              className="icon-btn"
              aria-label={`Remove step ${i + 1}`}
              disabled={steps.length === 1}
              onClick={() => setSteps(steps.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="taper-foot">
        <button className="link-btn" disabled={steps.length >= MAX_STEPS} onClick={addStep}>
          Add a step
        </button>
        <span className="muted small">
          {steps.map((s) => freqAbbrev(s.freq)).join(" → ")} → stop · {totalDays(drop)} days
        </span>
      </div>
    </div>
  );
}
