import { DRUG_CLASSES } from "../../data/formulary.js";
import { dropWarnings } from "../../lib/checks.js";
import { newSlot } from "../../lib/regimen.js";
import DropRow from "./DropRow.jsx";
import { Field } from "../ui.jsx";

const MAX_DROPS = 12;

function PatientForm({ patient, setPatient }) {
  const bind = (key) => ({ value: patient[key], onChange: (e) => setPatient({ ...patient, [key]: e.target.value }) });
  return (
    <section className="card" aria-labelledby="pt-h">
      <div className="card-h">
        <h2 id="pt-h">Patient</h2>
      </div>
      <div className="card-b grid-4">
        <Field label="Name">
          <input className="input" autoComplete="off" {...bind("name")} />
        </Field>
        <Field label="Date of birth">
          <input className="input" type="date" max={new Date().toISOString().slice(0, 10)} {...bind("dob")} />
        </Field>
        <Field label="Healthcare number" optional>
          <input className="input" autoComplete="off" {...bind("hcn")} />
        </Field>
        <Field label="Address" optional>
          <input className="input" autoComplete="off" {...bind("address")} />
        </Field>
      </div>
    </section>
  );
}

export default function RegimenPage({ patient, setPatient, drops, setDrops, formulary, go, reset }) {
  const count = drops.filter((d) => d.brand).length;
  const warnings = dropWarnings(drops, formulary, DRUG_CLASSES);

  // The list always ends with one empty row, ready for the next drop.
  const last = drops.at(-1);
  const rows = last && !last.brand ? drops : [...drops, newSlot(last?.eye)];
  const update = (i, patch) => {
    const next = rows.map((d, j) => (j === i ? { ...d, ...patch } : d));
    const tail = next.at(-1);
    setDrops(tail.brand && next.length < MAX_DROPS ? [...next, newSlot(tail.eye)] : next);
  };
  const remove = (i) => setDrops(rows.filter((_, j) => j !== i));

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <h1>Patient and drops</h1>
          <p>Kept in this browser tab only. Closing the tab clears it.</p>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={reset}>
          New patient
        </button>
      </div>

      <PatientForm patient={patient} setPatient={setPatient} />

      <section className="card" aria-labelledby="drops-h">
        <div className="card-h">
          <h2 id="drops-h">Drops</h2>
          <span className="muted small">
            {count ? `${count} added` : "Pick a drop, then the eye. Defaults come from the formulary."}
          </span>
        </div>
        {count > 0 && (
          <div className="drop-cols" aria-hidden="true">
            <span>Medication</span>
            <span>Eye</span>
            <span>How often</span>
            <span>Amount</span>
            <span>Course</span>
          </div>
        )}
        <ol className="drops">
          {rows.map((d, i) => (
            <DropRow key={d.id} index={i} drop={d} formulary={formulary} update={(p) => update(i, p)} remove={() => remove(i)} />
          ))}
        </ol>
      </section>

      {warnings.length > 0 && (
        <div className="notice warn" role="status">
          <b>Check for duplicate therapy</b>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="actionbar">
        <span className="muted">{count ? `${count} drop${count > 1 ? "s" : ""} added` : "Add at least one drop to continue"}</span>
        <span className="spacer" />
        <button className="btn primary lg" disabled={!count} onClick={() => go("schedule")}>
          Next: calendar
        </button>
      </div>
    </div>
  );
}
