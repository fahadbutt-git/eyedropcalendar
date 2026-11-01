import { useState } from "react";
import { addDays, fmtShort } from "../../lib/dates.js";
import { FREQ_OPTIONS, TAPER_PRESETS } from "../../lib/regimen.js";
import { sigText } from "../../lib/wording.js";
import { CapDot, Choice, NumberInput } from "../ui.jsx";
import MedPicker from "./MedPicker.jsx";
import TaperEditor from "./TaperEditor.jsx";

const EYE_CHOICES = [
  ["OD", "Right eye"],
  ["OS", "Left eye"],
  ["OU", "Both eyes"],
];
const COURSE_CHOICES = [
  ["ongoing", "Ongoing"],
  ["duration", "Fixed course"],
  ["taper", "Taper"],
];
const FORM_NOTE = { suspension: "Shake well", emulsion: "Emulsion", gel: "Gel, use last" };
const timesADay = (f) => (f === 1 ? "Once a day" : `${f} times a day`);

// The plan fields a new drug starts from. Changing the drug resets them, so
// a taper or course never carries over to a different drug by accident.
// Every dose is one drop.
export const freshPlan = (m) => ({ freq: m?.freq ?? 2, drops: 1, mode: "ongoing", steps: [], durationDays: 7 });

export default function DropRow({ index, drop, formulary, startDate, update, remove }) {
  const [changing, setChanging] = useState(false);
  const med = formulary.find((m) => m.brand === drop.brand);
  const n = index + 1;
  const name = drop.brand;

  const setMode = (mode) =>
    update(mode === "taper" && !drop.steps.length ? { mode, steps: TAPER_PRESETS[0].build(drop.freq) } : { mode });
  const delay = drop.startDay - 1;

  return (
    <li className="drop">
      <span className="drop-n" aria-hidden="true">
        {n}
      </span>
      <div className="drop-body">
        <div className="drop-head">
          {changing ? (
            <MedPicker
              label={`Change drug ${n}, ${name}`}
              formulary={formulary}
              autoFocus
              onPick={(brand) => {
                setChanging(false);
                // A fixed course or taper is kept when the drug changes, so a
                // plan is never silently dropped. An ongoing drop takes the new
                // drug's usual frequency.
                if (brand !== name)
                  update(drop.mode === "ongoing" ? { brand, freq: formulary.find((m) => m.brand === brand)?.freq ?? drop.freq } : { brand });
              }}
              onCancel={() => setChanging(false)}
            />
          ) : (
            <h3 className="drop-name">
              {name} {med?.generic && <span className="drop-generic">{med.generic}</span>}
            </h3>
          )}
          <div className="drop-meta">
            <CapDot cap={med?.cap} named />
            {FORM_NOTE[med?.form] && <span className="tag">{FORM_NOTE[med.form]}</span>}
            {!med && <span className="tag warn">Not in the formulary</span>}
          </div>
          <div className="drop-actions">
            <button className="link-btn" onClick={() => setChanging(!changing)} aria-expanded={changing}>
              {changing ? "Keep drug" : "Change drug"}
            </button>
            <button className="link-btn danger" onClick={remove} aria-label={`Remove ${name}`}>
              Remove
            </button>
          </div>
        </div>

        <div className="drop-fields">
          <Choice legend="Eye" value={drop.eye} options={EYE_CHOICES} onChange={(eye) => update({ eye })} />
          <Field2 label="How often" id={`f-${drop.id}`}>
            {drop.mode === "taper" ? (
              <span className="static" id={`f-${drop.id}`}>
                Set by the taper
              </span>
            ) : (
              <select id={`f-${drop.id}`} className="select" value={drop.freq} onChange={(e) => update({ freq: Number(e.target.value) })}>
                {FREQ_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f === 1 && med?.qhs ? "Once a day, at bedtime" : timesADay(f)}
                  </option>
                ))}
              </select>
            )}
          </Field2>
          <Choice legend="Course" value={drop.mode} options={COURSE_CHOICES} onChange={setMode} />
          {drop.mode === "duration" && (
            <Field2 label="Days" id={`d-${drop.id}`}>
              <NumberInput id={`d-${drop.id}`} value={drop.durationDays} onChange={(v) => update({ durationDays: v })} />
            </Field2>
          )}
        </div>

        {drop.mode === "taper" && <TaperEditor drop={drop} startDate={startDate} update={update} />}

        <div className="drop-foot">
          <label className="inline">
            <input type="checkbox" checked={delay > 0} onChange={(e) => update({ startDay: e.target.checked ? 2 : 1 })} />
            Start later
          </label>
          {delay > 0 && (
            <span className="inline">
              <NumberInput label={`Days to wait before starting ${name}`} value={delay} min={1} max={364} onChange={(v) => update({ startDay: v + 1 })} />
              days after the calendar starts
              {startDate && (
                <b className="mono">
                  First dose {fmtShort(addDays(startDate, delay))}, {addDays(startDate, delay).getFullYear()}
                </b>
              )}
            </span>
          )}
        </div>
        <p className="sig">
          <span className="label">Rx</span> {sigText(drop, med?.qhs, startDate)}
          {med?.form === "suspension" && " Shake well."}
        </p>
      </div>
    </li>
  );
}

// A label above a single control.
function Field2({ label, id, children }) {
  return (
    <div className="field">
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      {children}
    </div>
  );
}
