import { useEffect, useState } from "react";
import { CAP_COLOURS, DRUG_CLASSES } from "../../data/formulary.js";
import { DROP_OPTIONS, FREQ_OPTIONS } from "../../lib/regimen.js";
import { cleanMed } from "../../lib/validate.js";
import { Field } from "../ui.jsx";

const BLANK = { brand: "", generic: "", cls: [], freq: 2, drops: 1, lu: "", cap: "", form: "solution", qhs: false };

// Add or edit one formulary entry in a dialog.
export default function MedEditor({ initial, existing, onSave, onClose }) {
  const [m, setM] = useState({ ...BLANK, ...initial });
  const set = (key) => (e) => setM({ ...m, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const setNum = (key) => (e) => setM({ ...m, [key]: Number(e.target.value) });
  const toggleClass = (c) => setM({ ...m, cls: m.cls.includes(c) ? m.cls.filter((x) => x !== c) : [...m.cls, c] });
  const name = m.brand.trim().toLowerCase();
  const duplicate = existing.some((x) => x.id !== m.id && x.brand.toLowerCase() === name);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const save = (e) => {
    e.preventDefault();
    const clean = cleanMed(m, m.id);
    if (clean && !duplicate) onSave(clean);
  };

  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <form className="modal" role="dialog" aria-modal="true" aria-labelledby="med-h" onSubmit={save}>
        <div className="card-h">
          <h2 id="med-h">{m.id ? `Edit ${initial.brand}` : "Add medication"}</h2>
        </div>
        <div className="card-b">
          <div className="grid-2">
            <Field label="Brand name">
              <input className="input" value={m.brand} onChange={set("brand")} maxLength={60} required autoFocus />
            </Field>
            <Field label="LU code" optional>
              <input className="input" value={m.lu} onChange={set("lu")} maxLength={12} />
            </Field>
          </div>
          {duplicate && <div className="notice warn small">A medication with this name already exists.</div>}
          <Field label="Generic name and strength">
            <input className="input" value={m.generic} onChange={set("generic")} maxLength={120} />
          </Field>
          <div className="grid-2">
            <Field label="Usual frequency">
              <select className="select" value={m.freq} onChange={setNum("freq")}>
                {FREQ_OPTIONS.map((f) => (
                  <option key={f} value={f}>
                    {f}x a day
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Drops each time">
              <select className="select" value={m.drops} onChange={setNum("drops")}>
                {DROP_OPTIONS.map((d) => (
                  <option key={d} value={d}>
                    {d}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Cap colour">
              <select className="select" value={m.cap} onChange={set("cap")}>
                {Object.entries(CAP_COLOURS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Formulation">
              <select className="select" value={m.form} onChange={set("form")}>
                <option value="solution">Solution</option>
                <option value="suspension">Suspension (shake well)</option>
                <option value="gel">Gel-forming (use last)</option>
              </select>
            </Field>
          </div>
          <fieldset className="field">
            <legend>Drug class, used to flag duplicate therapy</legend>
            <div className="row" style={{ gap: 6 }}>
              {Object.entries(DRUG_CLASSES).map(([k, label]) => (
                <button key={k} type="button" aria-pressed={m.cls.includes(k)} className={`btn sm ${m.cls.includes(k) ? "primary" : ""}`} onClick={() => toggleClass(k)}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          <label className="check">
            <input type="checkbox" checked={m.qhs} onChange={set("qhs")} />
            <span>Once-daily dose is given at bedtime</span>
          </label>
          <div className="cta-row">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn primary" disabled={!name || duplicate}>
              Save
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}
