import { flushSync } from "react-dom";
import { toISO } from "../../lib/dates.js";
import { LU_CRITERIA, LU_NOT_MET } from "../../data/formulary.js";
import { EYES } from "../../lib/regimen.js";
import { Field, Icon, printSheets } from "../ui.jsx";
import Warnings from "../Warnings.jsx";
import PrescriptionSheet from "./PrescriptionSheet.jsx";
import SignaturePad from "./SignaturePad.jsx";

// Every prescriber is a physician, so "Dr." is added unless already typed.
export const drName = (name) => {
  const n = (name || "").trim();
  return !n ? "" : /^dr\.?\s/i.test(n) ? n.replace(/^dr\.?\s*/i, "Dr. ") : `Dr. ${n}`;
};

const isSignature = (v) => (typeof v === "string" && /^data:image\/png;base64,[\w+/=]+$/.test(v) && v.length < 300000 ? v : "");

const REFILLS = [0, 1, 2, 3, 4, 5, 6, 11];
// Dispense is a real quantity (such as "5 mL"), entered for each drug.
const DEFAULTS = { include: true, disp: "", refills: 0, lu: "" };
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
          <span className="prefixed">
            <span className="prefix" aria-hidden="true">
              Dr.
            </span>
            <input id="rx-prescriber-name" className="input" aria-label="Prescriber name and credentials, after Dr." placeholder="Jane Smith, MD FRCSC"
              value={prescriber.name}
              onChange={(e) => setPrescriber({ ...prescriber, name: e.target.value.replace(/^\s*dr\.?\s+/i, "") })}
            />
          </span>
        </Field>
        <Field label="CPSO number">
          <input className="input" inputMode="numeric" placeholder="123456" {...bind("license")} />
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
          <input className="input sm" disabled={!opt.include} value={opt.disp} maxLength={40} placeholder="e.g. 5 mL" onChange={(e) => setOpt({ disp: e.target.value })} />
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
            <select className="select sm" disabled={!opt.include} value={codes.includes(opt.lu) || opt.lu === LU_NOT_MET ? opt.lu : ""} onChange={(e) => setOpt({ lu: e.target.value })}>
              <option value="">None (ODB does not apply)</option>
              {codes.map((c) => (
                <option key={c} value={c}>
                  {c}: {LU_CRITERIA[c] || "see the ODB formulary"}
                </option>
              ))}
              <option value={LU_NOT_MET}>Does not meet LU criteria</option>
            </select>
          </Field>
        )}
      </div>
    </div>
  );
}

// Saved prescriber details are confirmed once in each browser tab, so a
// prescription is never printed under someone else's name and licence.
function PrescriberCheck({ prescriber, confirm }) {
  const change = () => {
    const box = document.getElementById("rx-prescriber-name");
    box?.scrollIntoView({ block: "center" });
    box?.focus({ preventScroll: true });
  };
  return (
    <section className="notice info prescriber-check" aria-labelledby="rx-who-h">
      <h2 id="rx-who-h" className="field-label">
        Confirm the prescriber
      </h2>
      <p>
        Prescribing as <b>{drName(prescriber.name)}</b>, CPSO {prescriber.license}
      </p>
      <div className="row">
        <button className="btn sm primary" onClick={confirm}>
          That&apos;s me
        </button>
        <button className="btn sm" onClick={change}>
          Change
        </button>
      </div>
    </section>
  );
}

export default function RxPage({ entries, formulary, patient, prescriber, setPrescriber, prescriberConfirmed, confirmPrescriber, today, setToday, rx, setRx, signature: drawn, setSignature, start, warnings, go }) {
  // A signature is drawn for each prescription and never saved, as the
  // Ontario College of Pharmacists does not accept a stored signature image
  // pasted onto prescriptions. It is held in memory by the clinician app.
  const signature = isSignature(drawn);
  // `today` changes when the tab comes back into use, so this renders again.
  const date = rx.dateEdited ? rx.date : today && toISO(new Date());
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
      return { entry, med, ...opt, lu: med?.lu?.includes(opt.lu) || (med?.lu?.length && opt.lu === LU_NOT_MET) ? opt.lu : "" };
    });
  const medOf = (e) => formulary.find((m) => m.brand === e.brand);

  const missing = [
    !prescriber.name && "prescriber name",
    !prescriber.license && "CPSO number",
    ...items.filter((it) => !it.disp.trim()).map((it) => `quantity for ${it.entry.brand}`),
    !patient.name && "patient name",
    !(prescriber.street && prescriber.city) && "practice address",
    !patient.dob && "date of birth",
    !date && "prescription date",
  ].filter(Boolean);
  // Until the date is changed by hand, the prescription is dated the day it prints.
  const print = () => {
    if (!rx.dateEdited) flushSync(() => setToday(toISO(new Date())));
    printSheets("rx");
  };
  const saved = !!(prescriber.name || "").trim() && !!(prescriber.license || "").trim();
  const why = !items.length
    ? "Tick at least one drug to print."
    : missing.length
      ? "Complete the details still needed to print."
      : !prescriberConfirmed
        ? "Confirm the prescriber to print."
        : "";

  return (
    <div className="rx-layout">
      <h1 className="sr-only">Prescription</h1>
      <aside className="stack no-print">
        <Warnings warnings={warnings} compact />
        <section className="card">
          <div className="card-h">
            <h2>Prescription</h2>
          </div>
          <div className="card-b stack" style={{ gap: 10 }}>
            <Field label="Date">
              <input className="input" type="date" value={date} onChange={(e) => setRx({ ...rx, date: e.target.value, dateEdited: true })} />
            </Field>
            <div className="rx-items">
              {entries.map((e) => (
                <ItemRow key={keyOf(e)} entry={e} med={medOf(e)} opt={optOf(e)} setOpt={setOpt(e)} />
              ))}
            </div>
            <p className="hint">Untick a drug the patient already has. Pick an LU code only when the Ontario Drug Benefit applies.</p>
            <div className="field">
              <span className="field-label">
                Sign this prescription <em>(optional)</em>
              </span>
              <SignaturePad signature={signature} setSignature={setSignature} />
              <span className="field-hint">
                Signing confirms you have reviewed this prescription. The signature is used for this prescription only, is not
                saved, and comes off if the drops or patient change. You can also leave it blank and sign the printout by hand.
              </span>
            </div>
            <Field label="Notes" optional>
              <textarea className="textarea" rows={3} maxLength={500} value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} />
            </Field>
          </div>
        </section>
        {missing.length > 0 && <div className="notice warn small">Still needed: {missing.join(", ")}. Prescriber details are under the preview.</div>}
        {saved && !prescriberConfirmed && <PrescriberCheck prescriber={prescriber} confirm={confirmPrescriber} />}
        <button className="btn primary lg" onClick={print} disabled={!!why} aria-describedby={why ? "rx-print-why" : undefined}>
          {Icon.print} Print prescription
        </button>
        {why && (
          <p className="hint print-why" id="rx-print-why">
            {why}
          </p>
        )}
      </aside>
      <div className="rx-print">
        <PrescriptionSheet
          items={items}
          prescriber={{ ...prescriber, name: drName(prescriber.name) }}
          patient={patient}
          date={date}
          notes={rx.notes}
          start={start}
          signature={signature}
        />
        <div className="no-print rx-prescriber">
          <PrescriberForm prescriber={prescriber} setPrescriber={setPrescriber} />
        </div>
      </div>
    </div>
  );
}
