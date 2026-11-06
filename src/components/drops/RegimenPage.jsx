import { toISO } from "../../lib/dates.js";
import { newSlot } from "../../lib/regimen.js";
import { MAX_DROPS } from "../../lib/validate.js";
import DropRow, { freshPlan } from "./DropRow.jsx";
import MedPicker from "./MedPicker.jsx";
import OpenPlan from "./OpenPlan.jsx";
import { Field } from "../ui.jsx";
import Warnings from "../Warnings.jsx";
import ImportReview from "./ImportReview.jsx";
import Cautions from "../Cautions.jsx";
import { cautionsFor } from "../../data/cautions.js";

function PatientForm({ patient, setPatient }) {
  const bind = (key) => ({ value: patient[key], onChange: (e) => setPatient({ ...patient, [key]: e.target.value }) });
  return (
    <section className="patient-form" aria-labelledby="pt-h">
      <h2 id="pt-h" className="sr-only">
        Patient
      </h2>
      <Field label="Patient name">
        <input className="input" autoComplete="off" {...bind("name")} />
      </Field>
      <Field label="Date of birth">
        <input className="input mono" type="date" max={toISO(new Date())} {...bind("dob")} />
      </Field>
      <Field label="Health card number" optional>
        <input className="input" autoComplete="off" {...bind("hcn")} />
      </Field>
      <Field label="Address" optional>
        <input className="input" autoComplete="off" {...bind("address")} />
      </Field>
    </section>
  );
}

export default function RegimenPage({ patient, setPatient, drops, setDrops, formulary, startDate, warnings, go, reset, openPlan, imported, setReviewed, setConfirmed }) {
  const list = drops.filter((d) => d.brand);
  const update = (i, patch) => setDrops(list.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const remove = (i) => setDrops(list.filter((_, j) => j !== i));
  // A new drop starts on the same eye as the one above it.
  const add = (brand) => {
    const m = formulary.find((x) => x.brand === brand);
    setDrops([...list, { ...newSlot(list.at(-1)?.eye ?? "OU"), brand, ...freshPlan(m) }]);
  };

  return (
    <div className="page">
      <div className="page-title">
        <h1>Patient and drops</h1>
        <button className="btn" onClick={reset}>
          New patient
        </button>
      </div>
      <p className="page-note">Patient details stay in this browser tab and are not sent to us. Press New patient before the next person.</p>

      {imported && <ImportReview imported={imported} drops={list} setReviewed={setReviewed} setConfirmed={setConfirmed} />}

      <OpenPlan formulary={formulary} hasDrops={list.length > 0} onOpen={openPlan} />

      <PatientForm patient={patient} setPatient={setPatient} />

      <section aria-labelledby="drops-h" className="drops-section">
        <div className="section-head">
          <h2 id="drops-h">Drops</h2>
          <span className="mono small">
            {list.length} of {MAX_DROPS}
          </span>
        </div>
        <ol className="drops">
          {list.map((d, i) => (
            <DropRow
              key={d.id}
              index={i}
              drop={d}
              formulary={formulary}
              startDate={startDate}
              update={(p) => update(i, p)}
              remove={() => remove(i)}
            />
          ))}
        </ol>
        {list.length < MAX_DROPS ? (
          <div className="add-drop">
            <span className="drop-n" aria-hidden="true">
              {list.length + 1}
            </span>
            <div className="add-drop-field">
              <span className="field-label" aria-hidden="true">
                {list.length ? "Add another drop" : "Add a drop"}
              </span>
              <MedPicker label={list.length ? "Add another drop" : "Add a drop"} formulary={formulary} onPick={add} />
            </div>
          </div>
        ) : (
          <p className="small">That is the most one plan can hold.</p>
        )}
      </section>

      <Warnings warnings={warnings} />
      <Cautions cautions={cautionsFor(list, formulary)} />

      <div className="actionbar">
        <span>
          {!list.length ? "Add at least one drop to continue" : imported && !imported.reviewed ? "Confirm the drops read from Oscar to continue" : `${list.length} drop${list.length > 1 ? "s" : ""}`}
        </span>
        <button className="btn primary lg" disabled={!list.length || (imported && !imported.reviewed)} onClick={() => go("schedule")}>
          Next: calendar
        </button>
      </div>
    </div>
  );
}
