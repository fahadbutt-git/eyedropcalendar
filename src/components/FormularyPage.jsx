import { useRef, useState } from "react";
import { CAP_COLOURS, DRUG_CLASSES, SEED_FORMULARY } from "../data/formulary.js";
import { FREQ_OPTIONS, DROP_OPTIONS, freqAbbrev } from "../lib/regimen.js";
import { downloadFile } from "../lib/ics.js";
import { CapDot, Field } from "./ui.jsx";

const BLANK = { brand: "", generic: "", cls: [], freq: 2, drops: 1, lu: "", cap: "", form: "solution", qhs: false };

function EditModal({ initial, onSave, onClose, existing }) {
  const [m, setM] = useState({ ...BLANK, ...initial });
  const set = (k, v) => setM({ ...m, [k]: v });
  const dup = existing.some((x) => x.brand.toLowerCase() === m.brand.trim().toLowerCase() && x.id !== m.id);
  const toggleCls = (c) => set("cls", m.cls.includes(c) ? m.cls.filter((x) => x !== c) : [...m.cls, c]);
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true">
        <div className="card-h">
          <h2>{m.id ? `Edit ${initial.brand}` : "Add medication"}</h2>
        </div>
        <div className="card-b">
          <div className="grid-2">
            <Field label="Brand name">
              <input className="input" value={m.brand} onChange={(e) => set("brand", e.target.value)} autoFocus />
            </Field>
            <Field label="LU code" optional>
              <input className="input" value={m.lu} onChange={(e) => set("lu", e.target.value)} />
            </Field>
          </div>
          {dup && <div className="notice warn small">A medication with this name already exists.</div>}
          <Field label="Generic name and strength">
            <input className="input" value={m.generic} onChange={(e) => set("generic", e.target.value)} />
          </Field>
          <div className="grid-2">
            <Field label="Usual frequency">
              <select className="select" value={m.freq} onChange={(e) => set("freq", Number(e.target.value))}>
                {FREQ_OPTIONS.map((f) => (
                  <option key={f} value={f}>{f}x / day</option>
                ))}
              </select>
            </Field>
            <Field label="Drops per dose">
              <select className="select" value={m.drops} onChange={(e) => set("drops", Number(e.target.value))}>
                {DROP_OPTIONS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </Field>
            <Field label="Cap colour">
              <select className="select" value={m.cap} onChange={(e) => set("cap", e.target.value)}>
                {Object.entries(CAP_COLOURS).map(([k, v]) => (
                  <option key={k} value={k}>{v.label}</option>
                ))}
              </select>
            </Field>
            <Field label="Formulation">
              <select className="select" value={m.form} onChange={(e) => set("form", e.target.value)}>
                <option value="solution">Solution</option>
                <option value="suspension">Suspension (shake well)</option>
                <option value="gel">Gel-forming (use last)</option>
              </select>
            </Field>
          </div>
          <Field label="Drug class (used to flag duplicate therapy)">
            <div className="row" style={{ gap: 6 }}>
              {Object.entries(DRUG_CLASSES).map(([k, v]) => (
                <button key={k} type="button" className={`btn sm ${m.cls.includes(k) ? "primary" : ""}`} onClick={() => toggleCls(k)}>
                  {v}
                </button>
              ))}
            </div>
          </Field>
          <label className="row small">
            <input type="checkbox" checked={m.qhs} onChange={(e) => set("qhs", e.target.checked)} />
            Once-daily dose is given at bedtime
          </label>
          <div className="cta-row">
            <button className="btn" onClick={onClose}>Cancel</button>
            <button className="btn primary" disabled={!m.brand.trim() || dup} onClick={() => onSave({ ...m, brand: m.brand.trim() })}>
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function FormularyPage({ formulary, setFormulary }) {
  const [q, setQ] = useState("");
  const [sort, setSort] = useState(["brand", 1]);
  const [editing, setEditing] = useState(null);
  const fileRef = useRef();

  const rows = formulary
    .filter((m) => `${m.brand} ${m.generic} ${m.lu} ${(m.cls || []).map((c) => DRUG_CLASSES[c]).join(" ")}`.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const [k, dir] = sort;
      const av = k === "cls" ? (a.cls || []).join() : a[k];
      const bv = k === "cls" ? (b.cls || []).join() : b[k];
      return (av > bv ? 1 : av < bv ? -1 : 0) * dir;
    });

  const Th = ({ k, children, style }) => (
    <th className="sort" style={style} aria-sort={sort[0] === k ? (sort[1] > 0 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort([k, sort[0] === k ? -sort[1] : 1])}>
        {children} {sort[0] === k ? (sort[1] > 0 ? "↑" : "↓") : ""}
      </button>
    </th>
  );

  const save = (m) => {
    if (m.id) setFormulary(formulary.map((x) => (x.id === m.id ? m : x)));
    else setFormulary([...formulary, { ...m, id: Math.max(0, ...formulary.map((x) => x.id)) + 1 }]);
    setEditing(null);
  };

  const importFile = async (e) => {
    const f = e.target.files[0];
    e.target.value = "";
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : data.formulary;
      if (!Array.isArray(list) || !list.every((m) => typeof m.brand === "string")) throw new Error();
      setFormulary(list.map((m, i) => ({ ...BLANK, ...m, id: i + 1 })));
    } catch {
      alert("That file is not a valid formulary export.");
    }
  };

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <h1>Formulary</h1>
          <p>Defaults that fill in when a drop is selected. Changes are saved on this device.</p>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({})}>Add medication</button>
      </div>

      <section className="card">
        <div className="card-h">
          <input className="input" style={{ maxWidth: 340 }} placeholder="Search brand, generic, class or LU code" value={q} onChange={(e) => setQ(e.target.value)} />
          <span className="muted small">{rows.length} of {formulary.length}</span>
          <span className="spacer" />
          <button className="btn sm" onClick={() => downloadFile("formulary.json", JSON.stringify({ formulary }, null, 2), "application/json")}>
            Export
          </button>
          <button className="btn sm" onClick={() => fileRef.current.click()}>Import</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={importFile} />
          <button
            className="btn sm danger"
            onClick={() => confirm("Restore the default formulary? Your edits will be lost.") && setFormulary(SEED_FORMULARY)}
          >
            Restore defaults
          </button>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                <Th k="brand">Brand</Th>
                <Th k="generic">Generic</Th>
                <Th k="cls">Class</Th>
                <Th k="freq">Usual dose</Th>
                <Th k="lu">LU code</Th>
                <th>Cap</th>
                <th style={{ width: 130 }} />
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td style={{ fontWeight: 650 }}>{m.brand}</td>
                  <td>{m.generic}</td>
                  <td className="small">{(m.cls || []).map((c) => DRUG_CLASSES[c]).join(" + ")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {m.drops} drop{m.drops > 1 ? "s" : ""} {freqAbbrev(m.freq)}
                    {m.qhs && m.freq === 1 ? " at bedtime" : ""}
                  </td>
                  <td>{m.lu ? <span className="tag lu">{m.lu}</span> : <span className="muted">–</span>}</td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <CapDot cap={m.cap} />
                      <span className="small muted">{m.cap ? CAP_COLOURS[m.cap]?.label : ""}</span>
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn sm" onClick={() => setEditing(m)}>Edit</button>
                      <button
                        className="btn sm ghost danger"
                        onClick={() => confirm(`Remove ${m.brand} from the formulary?`) && setFormulary(formulary.filter((x) => x.id !== m.id))}
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <p className="small muted">
        Cap colours follow the American Academy of Ophthalmology class convention and are left blank for fixed
        combinations and preservative-free unit doses. Confirm against the dispensed product. LU codes apply to
        the Ontario Drug Benefit program.
      </p>

      {editing && <EditModal initial={editing} existing={formulary} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
