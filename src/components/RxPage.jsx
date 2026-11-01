import { parseISO, sigText } from "../lib/regimen.js";
import { MONTHS } from "../lib/calendar.js";
import { Field, Icon } from "./ui.jsx";

export const rxKey = (e) => `${e.brand}|${e.eye}`;
const DEFAULT_OPT = { include: true, disp: "1 bottle", refills: 0 };
const fmtDate = (iso) => {
  if (!iso) return "";
  const d = parseISO(iso);
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
};

export default function RxPage({ entries, formulary, patient, prescriber, setPrescriber, rx, setRx, start, go }) {
  const pr = (k) => (e) => setPrescriber({ ...prescriber, [k]: e.target.value });
  const opt = (e) => ({ ...DEFAULT_OPT, ...(rx.items[rxKey(e)] || {}) });
  const setOpt = (e, patch) =>
    setRx({ ...rx, items: { ...rx.items, [rxKey(e)]: { ...opt(e), ...patch } } });
  const items = entries.filter((e) => opt(e).include);

  const print = () => {
    document.body.classList.add("print-rx");
    window.print();
    document.body.classList.remove("print-rx");
  };

  if (!entries.length)
    return (
      <div className="card card-b" style={{ textAlign: "center", padding: 48 }}>
        <h2 style={{ fontSize: 16, marginBottom: 6 }}>No drops selected</h2>
        <p className="muted" style={{ marginBottom: 14 }}>Choose medications first to fill the prescription.</p>
        <button className="btn primary" onClick={() => go("regimen")}>Select drops</button>
      </div>
    );

  const missing = [];
  if (!prescriber.name) missing.push("prescriber name");
  if (!prescriber.license) missing.push("licence number");
  if (!patient.name) missing.push("patient name");
  if (!patient.dob) missing.push("patient date of birth");

  return (
    <div className="rx-layout">
      <aside className="stack no-print">
        <section className="card">
          <div className="card-h">
            <h2>Prescriber</h2>
            <span className="muted small">Saved on this device</span>
          </div>
          <div className="card-b stack" style={{ gap: 10 }}>
            <Field label="Prescriber name and credentials">
              <input className="input" value={prescriber.name} onChange={pr("name")} placeholder="Dr. Jane Smith, MD FRCSC" />
            </Field>
            <Field label="Licence number">
              <input className="input" value={prescriber.license} onChange={pr("license")} placeholder="CPSO 123456" />
            </Field>
            <Field label="Clinic or practice name" optional>
              <input className="input" value={prescriber.clinic} onChange={pr("clinic")} />
            </Field>
            <Field label="Street address" optional>
              <input className="input" value={prescriber.street} onChange={pr("street")} />
            </Field>
            <Field label="City, province or state" optional>
              <input className="input" value={prescriber.city} onChange={pr("city")} />
            </Field>
            <div className="grid-2">
              <Field label="Phone" optional>
                <input className="input" value={prescriber.phone} onChange={pr("phone")} />
              </Field>
              <Field label="Fax" optional>
                <input className="input" value={prescriber.fax} onChange={pr("fax")} />
              </Field>
            </div>
          </div>
        </section>

        <section className="card">
          <div className="card-h">
            <h2>Prescription</h2>
          </div>
          <div className="card-b stack" style={{ gap: 10 }}>
            <Field label="Date">
              <input className="input" type="date" value={rx.date} onChange={(e) => setRx({ ...rx, date: e.target.value })} />
            </Field>
            <div className="rx-items">
              <div className="rx-items-h" aria-hidden="true">
                <span>Drug</span>
                <span>Dispense</span>
                <span>Refills</span>
              </div>
              {entries.map((e) => {
                const o = opt(e);
                const k = rxKey(e).replace(/\W/g, "-");
                return (
                  <div className={`rx-item-row ${o.include ? "" : "off"}`} key={rxKey(e)}>
                    <label className="check" htmlFor={`rx-inc-${k}`}>
                      <input
                        id={`rx-inc-${k}`}
                        type="checkbox"
                        checked={o.include}
                        onChange={(ev) => setOpt(e, { include: ev.target.checked })}
                      />
                      <span>
                        <b>{e.brand}</b> <span className={`tag ${e.eye.toLowerCase()}`}>{e.eye}</span>
                      </span>
                    </label>
                    <input
                      className="input sm"
                      aria-label={`Dispense for ${e.brand}`}
                      disabled={!o.include}
                      value={o.disp}
                      onChange={(ev) => setOpt(e, { disp: ev.target.value })}
                    />
                    <select
                      className="select sm"
                      aria-label={`Refills for ${e.brand}`}
                      disabled={!o.include}
                      value={o.refills}
                      onChange={(ev) => setOpt(e, { refills: Number(ev.target.value) })}
                    >
                      {[0, 1, 2, 3, 4, 5, 6, 11].map((n) => (
                        <option key={n} value={n}>
                          {n}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
            <p className="small muted">Untick a drug the patient already has to leave it off the prescription.</p>
            <Field label="Notes" optional>
              <textarea className="textarea" rows={3} value={rx.notes} onChange={(e) => setRx({ ...rx, notes: e.target.value })} />
            </Field>
          </div>
        </section>

        {missing.length > 0 && (
          <div className="notice warn small">Still needed: {missing.join(", ")}.</div>
        )}
        <button className="btn primary lg" onClick={print} disabled={!items.length}>
          {Icon.print} Print prescription
        </button>
      </aside>

      <div className="rx-print">
        <article className="rx-sheet">
          <header className="rx-head">
            <div className="prescriber">
              <b>{prescriber.name || "Prescriber name"}</b>
              {prescriber.license && <div>Licence {prescriber.license}</div>}
            </div>
            <div className="clinic">
              {prescriber.clinic && <div style={{ fontWeight: 650, color: "var(--ink)" }}>{prescriber.clinic}</div>}
              {prescriber.street && <div>{prescriber.street}</div>}
              {prescriber.city && <div>{prescriber.city}</div>}
              {prescriber.phone && <div>Tel {prescriber.phone}</div>}
              {prescriber.fax && <div>Fax {prescriber.fax}</div>}
            </div>
          </header>

          <div className="rx-pt">
            <div>
              <span className="lbl">Patient</span>
              {patient.name || " "}
            </div>
            <div>
              <span className="lbl">Date</span>
              {fmtDate(rx.date)}
            </div>
            <div>
              <span className="lbl">Date of birth</span>
              {patient.dob ? fmtDate(patient.dob) : " "}
            </div>
            {patient.hcn && (
              <div>
                <span className="lbl">Healthcare number</span>
                {patient.hcn}
              </div>
            )}
            {patient.address && (
              <div style={{ gridColumn: "1 / -1" }}>
                <span className="lbl">Address</span>
                {patient.address}
              </div>
            )}
          </div>

          <div className="rx-symbol">Rx</div>

          {items.map((e) => {
            const med = formulary.find((m) => m.brand === e.brand);
            const o = opt(e);
            return (
              <div className="rx-item" key={rxKey(e)}>
                <div>
                  <span className="name">{e.brand}</span>
                  {med?.generic && <span className="gen"> ({med.generic}) ophthalmic</span>}
                </div>
                <div>
                  <b>Sig:</b> {sigText(e, e.eye, med?.qhs, start ? parseISO(start) : null)}
                  {med?.form === "suspension" ? " Shake well." : ""}
                </div>
                <div className="meta">
                  <span>
                    <b>Disp:</b> {o.disp}
                  </span>
                  <span>
                    <b>Refills:</b> {o.refills === 0 ? "none" : o.refills}
                  </span>
                  {med?.lu && (
                    <span>
                      <b>LU code:</b> {med.lu}
                    </span>
                  )}
                </div>
              </div>
            );
          })}

          {rx.notes && <div className="rx-notes">{rx.notes}</div>}

          <footer className="rx-foot">
            <div className="small muted">
              {items.length} item{items.length !== 1 ? "s" : ""} prescribed
            </div>
            <div className="sig-line">
              Signature
              {prescriber.name ? ` · ${prescriber.name}` : ""}
            </div>
          </footer>
        </article>
      </div>
    </div>
  );
}
