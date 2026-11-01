import { useRef, useState } from "react";
import { CAP_COLOURS, DRUG_CLASSES } from "../../data/formulary.js";
import { downloadFile } from "../../lib/download.js";
import { cleanFormulary } from "../../lib/validate.js";
import { freqAbbrev } from "../../lib/wording.js";
import { CapDot } from "../ui.jsx";
import MedEditor from "./MedEditor.jsx";

const classNames = (m) => m.cls.map((c) => DRUG_CLASSES[c]).join(" + ");
const COLUMNS = [
  ["brand", "Brand", (m) => m.brand.toLowerCase()],
  ["generic", "Generic", (m) => m.generic.toLowerCase()],
  ["cls", "Class", classNames],
  ["freq", "Usual dose", (m) => m.freq],
  ["lu", "LU code", (m) => m.lu],
];

function SortHeader({ id, label, sort, setSort }) {
  const active = sort.key === id;
  return (
    <th className="sort" aria-sort={active ? (sort.dir > 0 ? "ascending" : "descending") : "none"}>
      <button onClick={() => setSort({ key: id, dir: active ? -sort.dir : 1 })}>
        {label} {active && (sort.dir > 0 ? "↑" : "↓")}
      </button>
    </th>
  );
}

export default function FormularyPage({ formulary, setFormulary, restore, outdated }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState({ key: "brand", dir: 1 });
  const [editing, setEditing] = useState(null);
  const [importError, setImportError] = useState("");
  const fileInput = useRef(null);

  const sortValue = COLUMNS.find(([k]) => k === sort.key)[2];
  const q = query.trim().toLowerCase();
  const rows = formulary
    .filter((m) => `${m.brand} ${m.generic} ${m.lu} ${classNames(m)}`.toLowerCase().includes(q))
    .sort((a, b) => (sortValue(a) > sortValue(b) ? 1 : sortValue(a) < sortValue(b) ? -1 : 0) * sort.dir);

  const save = (med) => {
    const id = med.id || Math.max(0, ...formulary.map((x) => x.id)) + 1;
    setFormulary(med.id ? formulary.map((x) => (x.id === id ? med : x)) : [...formulary, { ...med, id }]);
    setEditing(null);
  };

  const importFile = async (e) => {
    const file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 500_000) throw new Error();
      const data = JSON.parse(await file.text());
      const list = cleanFormulary(Array.isArray(data) ? data : data?.formulary);
      if (!list) throw new Error();
      setFormulary(list);
      setImportError("");
    } catch {
      setImportError("That file is not a formulary exported from Eye Drop Tracker.");
    }
  };

  const confirmRestore = (message) => window.confirm(message) && restore();

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <h1>Formulary</h1>
          <p>Defaults that fill in when a drop is picked. Changes are saved on this device.</p>
        </div>
        <span className="spacer" />
        <button className="btn primary" onClick={() => setEditing({})}>
          Add medication
        </button>
      </div>

      {outdated && (
        <div className="notice info">
          Updated defaults are available. Your edited list is still in use.{" "}
          <button className="link-btn" onClick={() => confirmRestore("Replace your edited list with the updated defaults?")}>
            Use the updated defaults
          </button>
        </div>
      )}
      {importError && (
        <div className="notice warn" role="alert">
          {importError}
        </div>
      )}

      <section className="card">
        <div className="card-h">
          <input
            className="input"
            type="search"
            aria-label="Search the formulary"
            style={{ maxWidth: 340 }}
            placeholder="Search brand, generic, class or LU code"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <span className="muted small">
            {rows.length} of {formulary.length}
          </span>
          <span className="spacer" />
          <button className="btn sm" onClick={() => downloadFile("formulary.json", JSON.stringify({ formulary }, null, 2), "application/json")}>
            Export
          </button>
          <button className="btn sm" onClick={() => fileInput.current.click()}>
            Import
          </button>
          <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={importFile} />
          <button className="btn sm danger" onClick={() => confirmRestore("Restore the default formulary? Your edits on this device will be lost.")}>
            Restore defaults
          </button>
        </div>
        <div className="table-wrap">
          <table className="t">
            <thead>
              <tr>
                {COLUMNS.map(([id, label]) => (
                  <SortHeader key={id} id={id} label={label} sort={sort} setSort={setSort} />
                ))}
                <th>Cap</th>
                <th>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((m) => (
                <tr key={m.id}>
                  <td className="strong">{m.brand}</td>
                  <td>{m.generic}</td>
                  <td className="small">{classNames(m)}</td>
                  <td className="nowrap">
                    {m.drops} drop{m.drops > 1 ? "s" : ""} {freqAbbrev(m.freq)}
                    {m.qhs && m.freq === 1 && " at bedtime"}
                  </td>
                  <td>{m.lu ? <span className="tag lu">{m.lu}</span> : <span className="muted">none</span>}</td>
                  <td>
                    <span className="row" style={{ gap: 6 }}>
                      <CapDot cap={m.cap} />
                      <span className="small muted">{m.cap && CAP_COLOURS[m.cap].label}</span>
                    </span>
                  </td>
                  <td>
                    <div className="row" style={{ gap: 4, justifyContent: "flex-end" }}>
                      <button className="btn sm" onClick={() => setEditing(m)}>
                        Edit
                      </button>
                      <button
                        className="btn sm ghost danger"
                        onClick={() => window.confirm(`Remove ${m.brand} from the formulary?`) && setFormulary(formulary.filter((x) => x.id !== m.id))}
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
        Cap colours follow the American Academy of Ophthalmology class convention and are left blank for fixed combinations and
        preservative-free unit doses. Confirm against the dispensed product. LU codes apply to the Ontario Drug Benefit program.
      </p>

      {editing && <MedEditor initial={editing} existing={formulary} onSave={save} onClose={() => setEditing(null)} />}
    </div>
  );
}
