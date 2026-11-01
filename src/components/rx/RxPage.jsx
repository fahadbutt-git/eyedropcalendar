import { EYES } from "../../lib/regimen.js";
import { Field, Icon, printSheets } from "../ui.jsx";
import Warnings from "../Warnings.jsx";
import PrescriptionSheet from "./PrescriptionSheet.jsx";

const REFILLS = [0, 1, 2, 3, 4, 5, 6, 11];
const DEFAULTS = { include: true, disp: "1 bottle", refills: 0, lu: "" };
// Choices are stored by the drop's own id, so changing its eye keeps them.
const keyOf = (e) => e.id;

function PrescriberForm({ prescriber, setPrescriber }) {
  const bind = (key) => ({ value: prescriber[key], onChange: (e) => setPrescriber({ ...prescriber, [key]: e.target.value }) });
  return (
    <section className="card">
      <div className="card-h">
        <h2>Prescriber</h2>
        <span className="muted small">Saved on this device</span>
      </div>
      <div className="card-b stack" style={{ gap: 10 }}>
        <Field label="Prescriber name and credentials">
          <input className="input" placeholder="Dr. Jane Smith, MD FRCSC" {...bind("name")} />
        </Field>
        <Field label="Licence number">
          <input className="input" placeholder="CPSO 123456" {...bind("license")} />
        </Field>
        <Field label="Clinic or practice name" optional>
          <input className="input" {...bind("clinic")} />
        </Field>
        <Field label="Practice street address">
          <input className="input" {...bind("street")} />
        </Field>
        <Field label="City, province or state">
          <input className="input" {...bind("city")} />
        </Field>
        <div className="grid-2">
          <Field label="Phone" optional>
            <input className="input" type="tel" {...bind("phone")} />
          </Field>
          <Field label="Fax" optional>
            <input className="input" type="tel" {...bind("fax")} />
          </Field>
        </div>
      </div>
    </section>
  );
}

function ItemRow({ entry, med, opt, setOpt }) {
  const id = `rx-${entry.id}`;
  const codes = med?.lu || [];
  return (
    <div className={`rx-item-row ${opt.include ? "" : "off"}`}>
      <label className="check" htmlFor={id}>
        <input id={id} type="checkbox" checked={opt.include} onChange={(e) => setOpt({ include: e.target.checked })} />
        <span>
          <b>{entry.brand}</b>
          <span className="hint">{EYES[entry.eye].label}</span>
        </span>
      </label>
      <div className="rx-item-fields">
        <Field label="Dispense">
          <input className="input sm" disabled={!opt.include} value={opt.disp} maxLength={40} onChange={(e) => setOpt({ disp: e.target.value })} />
        </Field>
        <Field label="Refills">
          <select className="select sm" disabled={!opt.include} value={opt.refills} onChange={(e) => setOpt({ refills: Number(e.target.value) })}>
            {REFILLS.map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </Field>
        {codes.length > 0 && (
          <Field label="ODB LU code">
            <select className="select sm" disabled={!opt.include} value={codes.includes(opt.lu) ? opt.lu : ""} onChange={(e) => setOpt({ lu: e.target.value })}>
              <option value="">None</option>
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
    </div>
  );
}

export default function RxPage({ entries, formulary, patient, prescriber, setPrescriber, rx, setRx, start, warnings, go }) {
  if (!entries.length)
    return (
      <div className="card card-b empty">
        <h2>No drops yet</h2>
        <p className="muted">Add the patient&apos;s drops first.</p>
        <button className="btn primary" onClick={() => go("regimen")}>
          Add drops
        </button>
      </div>
    );

  const optOf = (e) => ({ ...DEFAULTS, ...rx.items[keyOf(e)] });
  const setOpt = (e) => (patch) => setRx({ ...rx, items: { ...rx.items, [keyOf(e)]: { ...optOf(e), ...patch } } });
  const items = entries
    .filter((e) => optOf(e).include)
    .map((entry) => {
      const med = formulary.find((m) => m.brand === entry.brand);
      const opt = optOf(entry);
      return { entry, med, ...opt, lu: med?.lu?.includes(opt.lu) ? opt.lu : "" };
    });
  const medOf = (e) => formulary.find((m) => m.brand === e.brand);

  const missing = [
    !prescriber.name && "prescriber name",
    !prescriber.license && "licence number",
    !patient.name && "patient name",
    !(prescriber.street && prescriber.city) && "practice address",
    !patient.dob && "date of birth",
    !rx.date && "prescription date",
  ].filter(Boolean);
  const print = () => printSheets("rx");

  return (
    <div className="rx-layout">
      <aside className="stack no-print">
        <Warnings warnings={warnings} compact />
        <PrescriberForm prescriber={prescriber} setPrescriber={setPrescriber} />
        <section className="card">
          <div className="card-h">
            <h2>Prescription</h2>
          </div>
          <div className="card-b stack" style={{ gap: 10 }}>
            <Field label="Date">
              <input className="input" type="date" value={rx.date} onChange={(e) => setRx({ ...rx, date: e.target.value })} />
            </Field>
            <div className="rx-items">
              {entries.map((e) => (
                <ItemRow key={keyOf(e)} entry={e} med={medOf(e)} opt={optOf(e)} setOpt={setOpt(e)} />
              ))}
            </div>
            <p className="hint">Untick a drug the patient already has. Pick an LU code only when the Ontario Drug Benefit applies.</p>
            <Field label="Notes" optional>
              <textarea className="textarea" rows={3} maxLength={500} value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} />
            </Field>
          </div>
        </section>
        {missing.length > 0 && <div className="notice warn small">Still needed: {missing.join(", ")}.</div>}
        <button className="btn primary lg" onClick={print} disabled={!items.length}>
          {Icon.print} Print prescription
        </button>
      </aside>
      <div className="rx-print">
        <PrescriptionSheet items={items} prescriber={prescriber} patient={patient} date={rx.date} notes={rx.notes} start={start} />
      </div>
    </div>
  );
}
