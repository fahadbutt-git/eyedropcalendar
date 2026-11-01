import { DRUG_CLASSES } from "../data/formulary.js";
import {
  DROP_OPTIONS,
  FREQ_OPTIONS,
  TAPER_PRESETS,
  dropWarnings,
  freqAbbrev,
  newSlot,
  totalDays,
} from "../lib/regimen.js";
import { CapDot, Field } from "./ui.jsx";

const GLAUCOMA = new Set(["PGA", "BB", "CAI", "AA", "MIO"]);
const MAX_DROPS = 12;
const EYE_CHOICES = [
  ["OD", "Right"],
  ["OS", "Left"],
  ["OU", "Both"],
];
const clampDays = (v) => Math.min(365, Math.max(1, Number(v) || 1));

function MedSelect({ id, value, onChange, formulary }) {
  const sorted = [...formulary].sort((a, b) => a.brand.localeCompare(b.brand));
  const glaucoma = sorted.filter((m) => (m.cls || []).some((c) => GLAUCOMA.has(c)));
  const other = sorted.filter((m) => !glaucoma.includes(m));
  const label = (m) => `${m.brand}  ·  ${m.generic.split(" (")[0]}`;
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{value ? "Remove this drop" : "Add a drop"}</option>
      <optgroup label="Glaucoma">
        {glaucoma.map((m) => (
          <option key={m.id} value={m.brand}>
            {label(m)}
          </option>
        ))}
      </optgroup>
      {other.length > 0 && (
        <optgroup label="Post-operative and other">
          {other.map((m) => (
            <option key={m.id} value={m.brand}>
              {label(m)}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function TaperEditor({ slot, update }) {
  const steps = slot.steps;
  const set = (next) => update({ steps: next });
  return (
    <div className="taper" role="group" aria-label={`${slot.brand} taper`}>
      <div className="taper-head">
        <span className="taper-title">Taper</span>
        <select
          className="select sm"
          aria-label="Apply a taper template"
          value=""
          onChange={(e) => {
            const p = TAPER_PRESETS[Number(e.target.value)];
            if (p) set(p.build(slot.freq));
          }}
        >
          <option value="">Use a template</option>
          {TAPER_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      <ol className="taper-steps">
        {steps.map((s, i) => (
          <li key={i} className="taper-step">
            <span className="step-n">{i + 1}</span>
            <select
              className="select sm"
              aria-label={`Step ${i + 1}, times a day`}
              value={s.freq}
              onChange={(e) => set(steps.map((x, j) => (j === i ? { ...x, freq: Number(e.target.value) } : x)))}
            >
              {FREQ_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}x a day
                </option>
              ))}
            </select>
            <span className="muted">for</span>
            <input
              className="input sm num"
              type="number"
              inputMode="numeric"
              min={1}
              max={365}
              aria-label={`Step ${i + 1}, number of days`}
              value={s.days}
              onChange={(e) => set(steps.map((x, j) => (j === i ? { ...x, days: clampDays(e.target.value) } : x)))}
            />
            <span className="muted">days</span>
            <button
              className="icon-btn"
              aria-label={`Remove step ${i + 1}`}
              disabled={steps.length <= 1}
              onClick={() => set(steps.filter((_, j) => j !== i))}
            >
              ×
            </button>
          </li>
        ))}
      </ol>
      <div className="taper-foot">
        <button
          className="link-btn"
          disabled={steps.length >= 10}
          onClick={() => {
            const last = steps[steps.length - 1];
            set([...steps, { freq: last ? Math.max(1, last.freq - 1) : slot.freq, days: last ? last.days : 7 }]);
          }}
        >
          Add a step
        </button>
        <span className="muted small">
          {steps.map((s) => freqAbbrev(s.freq)).join(" → ")} → stop · {totalDays(slot)} days
        </span>
      </div>
    </div>
  );
}

function DropRow({ index, slot, formulary, update, remove }) {
  const med = formulary.find((m) => m.brand === slot.brand);
  const active = !!slot.brand;
  const id = `drop-${slot.id}`;
  return (
    <li className={`drop ${active ? "" : "drop-empty"}`}>
      <div className="drop-grid">
        <div className="drop-med">
          <label htmlFor={`${id}-med`} className="sr-only">
            Drop {index + 1}
          </label>
          <MedSelect
            id={`${id}-med`}
            value={slot.brand}
            formulary={formulary}
            onChange={(brand) => {
              if (!brand) return remove();
              const m = formulary.find((x) => x.brand === brand);
              update({ brand, freq: m?.freq ?? 2, drops: m?.drops ?? 1 });
            }}
          />
          {med && (
            <div className="drop-meta">
              <CapDot cap={med.cap} title={med.cap ? undefined : "Cap colour not standard"} />
              {med.lu && <span className="tag lu">LU {med.lu}</span>}
              {med.form === "suspension" && <span className="tag">Shake well</span>}
              {med.qhs && slot.freq === 1 && slot.mode !== "taper" && <span className="tag">At bedtime</span>}
            </div>
          )}
        </div>

        {active && (
          <>
            <div className="seg eye-seg" role="radiogroup" aria-label={`Eye for ${slot.brand}`}>
              {EYE_CHOICES.map(([k, l]) => (
                <button
                  key={k}
                  role="radio"
                  aria-checked={slot.eye === k}
                  className={slot.eye === k ? "on" : ""}
                  onClick={() => update({ eye: k })}
                >
                  {l}
                </button>
              ))}
            </div>
            <select
              className="select"
              aria-label={`How often for ${slot.brand}`}
              disabled={slot.mode === "taper"}
              value={slot.mode === "taper" ? slot.steps[0]?.freq ?? slot.freq : slot.freq}
              onChange={(e) => update({ freq: Number(e.target.value) })}
            >
              {FREQ_OPTIONS.map((f) => (
                <option key={f} value={f}>
                  {f}x a day
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label={`Drops each time for ${slot.brand}`}
              value={slot.drops}
              onChange={(e) => update({ drops: Number(e.target.value) })}
            >
              {DROP_OPTIONS.map((d) => (
                <option key={d} value={d}>
                  {d} drop{d > 1 ? "s" : ""}
                </option>
              ))}
            </select>
            <select
              className="select"
              aria-label={`Course for ${slot.brand}`}
              value={slot.mode}
              onChange={(e) => {
                const mode = e.target.value;
                update(mode === "taper" && !slot.steps.length ? { mode, steps: TAPER_PRESETS[0].build(slot.freq) } : { mode });
              }}
            >
              <option value="ongoing">Ongoing</option>
              <option value="duration">Set number of days</option>
              <option value="taper">Taper</option>
            </select>
            <button className="icon-btn" aria-label={`Remove ${slot.brand}`} onClick={remove}>
              ×
            </button>
          </>
        )}
      </div>

      {active && (
        <div className="drop-extra">
          {slot.mode === "duration" && (
            <label className="inline">
              For
              <input
                className="input sm num"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={slot.durationDays}
                onChange={(e) => update({ durationDays: clampDays(e.target.value) })}
              />
              days, then stop
            </label>
          )}
          {slot.startDay > 1 || slot.showStart ? (
            <label className="inline">
              Starts on day
              <input
                className="input sm num"
                type="number"
                inputMode="numeric"
                min={1}
                max={365}
                value={slot.startDay}
                onChange={(e) => update({ startDay: clampDays(e.target.value) })}
              />
              of the schedule
              <button className="link-btn" onClick={() => update({ startDay: 1, showStart: false })}>
                Start on day 1
              </button>
            </label>
          ) : (
            <button className="link-btn" onClick={() => update({ showStart: true })}>
              Start later
            </button>
          )}
        </div>
      )}
      {active && slot.mode === "taper" && <TaperEditor slot={slot} update={update} />}
    </li>
  );
}

export default function RegimenPage({ patient, setPatient, drops, setDrops, formulary, go, reset }) {
  const p = (k) => (e) => setPatient({ ...patient, [k]: e.target.value });
  const warnings = dropWarnings(drops, formulary, DRUG_CLASSES);
  const count = drops.filter((d) => d.brand).length;

  // Keep one empty row at the end, ready for the next drop.
  const last = drops[drops.length - 1];
  const rows = last && !last.brand ? drops : [...drops, newSlot(last?.eye || "OU")];
  const update = (i, patch) => {
    const next = rows.map((d, j) => (j === i ? { ...d, ...patch } : d));
    const tail = next[next.length - 1];
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

      <section className="card" aria-labelledby="pt-h">
        <div className="card-h">
          <h2 id="pt-h">Patient</h2>
        </div>
        <div className="card-b grid-4">
          <Field label="Name">
            <input className="input" value={patient.name} onChange={p("name")} autoComplete="off" />
          </Field>
          <Field label="Date of birth">
            <input
              className="input"
              type="date"
              value={patient.dob}
              onChange={p("dob")}
              max={new Date().toISOString().slice(0, 10)}
            />
          </Field>
          <Field label="Healthcare number" optional>
            <input className="input" value={patient.hcn} onChange={p("hcn")} autoComplete="off" />
          </Field>
          <Field label="Address" optional>
            <input className="input" value={patient.address} onChange={p("address")} autoComplete="off" />
          </Field>
        </div>
      </section>

      <section className="card" aria-labelledby="drops-h">
        <div className="card-h">
          <h2 id="drops-h">Drops</h2>
          <span className="muted small">
            {count ? `${count} selected` : "Pick a drop, then the eye. Defaults come from the formulary."}
          </span>
        </div>
        {count > 0 && <div className="drop-cols" aria-hidden="true">
          <span>Medication</span>
          <span>Eye</span>
          <span>How often</span>
          <span>Amount</span>
          <span>Course</span>
        </div>}
        <ol className="drops">
          {rows.map((d, i) => (
            <DropRow
              key={d.id}
              index={i}
              slot={d}
              formulary={formulary}
              update={(patch) => update(i, patch)}
              remove={() => remove(i)}
            />
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
