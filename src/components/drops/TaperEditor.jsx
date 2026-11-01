import { addDays, fmtShort } from "../../lib/dates.js";
import { FREQ_OPTIONS, TAPER_PRESETS, totalDays } from "../../lib/regimen.js";
import { NumberInput } from "../ui.jsx";

const MAX_STEPS = 10;
const timesADay = (f) => (f === 1 ? "Once a day" : `${f} times a day`);

// Taper steps as a ruled table, with the real dates of each step.
export default function TaperEditor({ drop, startDate, update }) {
  const { steps } = drop;
  const setSteps = (next) => update({ steps: next });
  const setStep = (i, patch) => setSteps(steps.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const addStep = () => {
    const last = steps.at(-1);
    const lower = FREQ_OPTIONS.filter((f) => f < (last?.freq ?? drop.freq)).at(-1) ?? 1;
    setSteps([...steps, { freq: lower, days: last?.days ?? 7 }]);
  };
  let day = drop.startDay - 1;
  const rows = steps.map((s) => {
    const from = day;
    day += s.days;
    return { ...s, from, to: day - 1 };
  });
  const date = (i) => (startDate ? fmtShort(addDays(startDate, i)) : `day ${i + 1}`);

  return (
    <div className="taper" role="group" aria-label={`${drop.brand} taper`}>
      <div className="taper-head">
        <span className="taper-title">
          Taper, {totalDays(drop)} days
        </span>
        <span className="taper-presets">
          Templates:
          {TAPER_PRESETS.map((p) => (
            <button key={p.label} className="link-btn" onClick={() => setSteps(p.build(drop.steps[0]?.freq ?? drop.freq))}>
              {p.label}
            </button>
          ))}
        </span>
      </div>
      <div className="table-wrap">
        <table className="taper-table">
          <thead>
            <tr>
              <th scope="col">Step</th>
              <th scope="col">How often</th>
              <th scope="col">Days</th>
              <th scope="col">Dates</th>
              <th scope="col">
                <span className="sr-only">Remove</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s, i) => (
              <tr key={i}>
                <td className="mono">{i + 1}</td>
                <td>
                  <select
                    className="select sm"
                    aria-label={`Step ${i + 1}, how often`}
                    value={s.freq}
                    onChange={(e) => setStep(i, { freq: Number(e.target.value) })}
                  >
                    {FREQ_OPTIONS.map((f) => (
                      <option key={f} value={f}>
                        {timesADay(f)}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <NumberInput label={`Step ${i + 1}, number of days`} value={s.days} onChange={(v) => setStep(i, { days: v })} className="sm" />
                </td>
                <td className="mono">
                  {date(s.from)} to {date(s.to)}
                </td>
                <td className="right">
                  <button className="link-btn" disabled={steps.length === 1} onClick={() => setSteps(steps.filter((_, j) => j !== i))}>
                    Remove<span className="sr-only"> step {i + 1}</span>
                  </button>
                </td>
              </tr>
            ))}
            <tr className="stop-row">
              <td className="mono">→</td>
              <td>
                <b>Stop</b>
              </td>
              <td />
              <td className="mono">{date(day)}</td>
              <td className="right">
                <button className="link-btn" disabled={steps.length >= MAX_STEPS} onClick={addStep}>
                  Add a step
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
