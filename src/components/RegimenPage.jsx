import { DRUG_CLASSES } from "../data/formulary.js";
import {
  DROP_OPTIONS,
  FREQ_OPTIONS,
  TAPER_PRESETS,
  freqAbbrev,
  newSlot,
  regimenWarnings,
  totalDays,
} from "../lib/regimen.js";
import { CapDot, Field } from "./ui.jsx";

const GLAUCOMA = new Set(["PGA", "BB", "CAI", "AA", "MIO"]);
const MAX_SLOTS = 8;

function MedSelect({ value, onChange, formulary }) {
  const sorted = [...formulary].sort((a, b) => a.brand.localeCompare(b.brand));
  const glaucoma = sorted.filter((m) => (m.cls || []).some((c) => GLAUCOMA.has(c)));
  const other = sorted.filter((m) => !glaucoma.includes(m));
  return (
    <select className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Select medication</option>
      <optgroup label="Glaucoma">
        {glaucoma.map((m) => (
          <option key={m.id} value={m.brand}>
            {m.brand}
          </option>
        ))}
      </optgroup>
      {other.length > 0 && (
        <optgroup label="Post-operative and other">
          {other.map((m) => (
            <option key={m.id} value={m.brand}>
              {m.brand}
            </option>
          ))}
        </optgroup>
      )}
    </select>
  );
}

function TaperEditor({ slot, update }) {
  const steps = slot.steps;
  const set = (steps) => update({ steps });
  const total = totalDays(slot);
  return (
    <div className="taper">
      <div className="row">
        <select
          className="select"
          style={{ maxWidth: 320 }}
          value=""
          onChange={(e) => {
            const p = TAPER_PRESETS[Number(e.target.value)];
            if (p) set(p.build(slot.freq));
          }}
        >
          <option value="">Apply a taper template</option>
          {TAPER_PRESETS.map((p, i) => (
            <option key={p.label} value={i}>
              {p.label}
            </option>
          ))}
        </select>
      </div>
      {steps.map((s, i) => (
        <div className="taper-step" key={i}>
          <span className="muted">Step {i + 1}</span>
          <select
            className="select"
            value={s.freq}
            onChange={(e) => set(steps.map((x, j) => (j === i ? { ...x, freq: Number(e.target.value) } : x)))}
          >
            {FREQ_OPTIONS.map((f) => (
              <option key={f} value={f}>
                {f}x / day
              </option>
            ))}
          </select>
          <div className="row" style={{ gap: 6, flexWrap: "nowrap" }}>
            <input
              className="input"
              type="number"
              min={1}
              max={365}
              value={s.days}
              onChange={(e) =>
                set(steps.map((x, j) => (j === i ? { ...x, days: Math.max(1, Number(e.target.value) || 1) } : x)))
              }
            />
            <span className="muted">days</span>
          </div>
          <button
            className="btn ghost sm"
            title="Remove step"
            onClick={() => set(steps.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <div className="row">
        <button
          className="btn sm"
          onClick={() => {
            const last = steps[steps.length - 1];
            set([...steps, { freq: last ? Math.max(1, last.freq - 1) : slot.freq, days: last ? last.days : 7 }]);
          }}
        >
          Add step
        </button>
        <span className="taper-sum">
          {steps.length
            ? `${steps.map((s) => freqAbbrev(s.freq)).join(" → ")} → stop · ${total} days total`
            : "No steps yet"}
        </span>
      </div>
    </div>
  );
}

function Slot({ index, slot, color, formulary, update, clear, copyToOther, otherLabel }) {
  const med = formulary.find((m) => m.brand === slot.brand);
  const active = !!slot.brand;
  return (
    <div className="slot">
      <div className="slot-main">
        <div className="slot-num" style={active ? { background: color, color: "#fff" } : null}>
          {index + 1}
        </div>
        <div>
          <MedSelect
            value={slot.brand}
            formulary={formulary}
            onChange={(brand) => {
              const m = formulary.find((x) => x.brand === brand);
              update(brand && m ? { brand, freq: m.freq, drops: m.drops } : { brand });
            }}
          />
          <div className="slot-meta">
            {med && (
              <>
                <span className="meta-info">
                <CapDot cap={med.cap} />
                <span>{med.generic}</span>
                {med.lu && <span className="tag lu">LU {med.lu}</span>}
                {med.form === "suspension" && <span className="tag">Shake well</span>}
                </span>
                <span className="meta-actions">
                <button className="link-btn" onClick={copyToOther}>
                  Copy to {otherLabel}
                </button>
                <button className="link-btn danger" onClick={clear}>
                  Remove
                </button>
                </span>
              </>
            )}
          </div>
        </div>
        <select
          className="select"
          aria-label="Times per day"
          disabled={!active || slot.mode === "taper"}
          value={slot.freq}
          onChange={(e) => update({ freq: Number(e.target.value) })}
        >
          {FREQ_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}x / day
            </option>
          ))}
        </select>
        <select
          className="select"
          aria-label="Drops per dose"
          disabled={!active}
          value={slot.drops}
          onChange={(e) => update({ drops: Number(e.target.value) })}
        >
          {DROP_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} drop{d > 1 ? "s" : ""}
            </option>
          ))}
        </select>
      </div>

      {active && (
        <div className="slot-opts">
          <div className="row">
            <div className="seg" role="group" aria-label="Course">
              {[
                ["ongoing", "Ongoing"],
                ["duration", "Fixed course"],
                ["taper", "Taper"],
              ].map(([k, l]) => (
                <button
                  key={k}
                  className={slot.mode === k ? "on" : ""}
                  onClick={() =>
                    update(
                      k === "taper" && !slot.steps.length
                        ? { mode: k, steps: TAPER_PRESETS[0].build(slot.freq) }
                        : { mode: k }
                    )
                  }
                >
                  {l}
                </button>
              ))}
            </div>
            {slot.mode === "duration" && (
              <span className="row" style={{ gap: 6 }}>
                for
                <input
                  className="input inline-num"
                  type="number"
                  min={1}
                  max={365}
                  value={slot.durationDays}
                  onChange={(e) => update({ durationDays: Math.max(1, Number(e.target.value) || 1) })}
                />
                days
              </span>
            )}
            <span className="row" style={{ gap: 6 }}>
              <span className="muted">start on day</span>
              <input
                className="input inline-num"
                type="number"
                min={1}
                max={365}
                value={slot.startDay}
                onChange={(e) => update({ startDay: Math.max(1, Number(e.target.value) || 1) })}
              />
            </span>
          </div>
          {slot.mode === "taper" && <TaperEditor slot={slot} update={update} />}
        </div>
      )}
    </div>
  );
}

function EyePanel({ title, code, color, slots, setSlots, otherSlots, setOtherSlots, otherLabel, formulary }) {
  const update = (i, patch) => setSlots(slots.map((s, j) => (j === i ? { ...s, ...patch } : s)));
  const copyToOther = (i) => {
    const copy = { ...slots[i], steps: slots[i].steps.map((s) => ({ ...s })) };
    const empty = otherSlots.findIndex((s) => !s.brand);
    if (empty >= 0) setOtherSlots(otherSlots.map((s, j) => (j === empty ? copy : s)));
    else if (otherSlots.length < MAX_SLOTS) setOtherSlots([...otherSlots, copy]);
  };
  return (
    <section className="card">
      <div className="eye-h" style={{ borderTopColor: color }}>
        <h2>
          {title} ({code})
        </h2>
        <span className="spacer" />
        <span className="muted small">{slots.filter((s) => s.brand).length} selected</span>
      </div>
      {slots.map((s, i) => (
        <Slot
          key={i}
          index={i}
          slot={s}
          color={color}
          formulary={formulary}
          update={(p) => update(i, p)}
          clear={() => setSlots(slots.map((x, j) => (j === i ? newSlot() : x)))}
          copyToOther={() => copyToOther(i)}
          otherLabel={otherLabel}
        />
      ))}
      {slots.length < MAX_SLOTS && (
        <div className="slot">
          <button className="btn sm" onClick={() => setSlots([...slots, newSlot()])}>
            Add another drop
          </button>
        </div>
      )}
    </section>
  );
}

export default function RegimenPage({ patient, setPatient, right, setRight, left, setLeft, formulary, go, reset }) {
  const p = (k) => (e) => setPatient({ ...patient, [k]: e.target.value });
  const warnings = [
    ...regimenWarnings(right, formulary, "right eye", DRUG_CLASSES),
    ...regimenWarnings(left, formulary, "left eye", DRUG_CLASSES),
  ];
  const any = [...right, ...left].some((s) => s.brand);

  return (
    <div className="stack">
      <div className="page-title">
        <div>
          <h1>Patient and drops</h1>
          <p>Patient details stay in this browser tab and are cleared when the tab is closed.</p>
        </div>
        <span className="spacer" />
        <button className="btn" onClick={reset}>
          Start new patient
        </button>
      </div>

      <section className="card">
        <div className="card-b grid-4">
          <Field label="Patient name">
            <input className="input" value={patient.name} onChange={p("name")} autoComplete="off" />
          </Field>
          <Field label="Date of birth">
            <input className="input" type="date" value={patient.dob} onChange={p("dob")} />
          </Field>
          <Field label="Healthcare number" optional>
            <input className="input" value={patient.hcn} onChange={p("hcn")} autoComplete="off" />
          </Field>
          <Field label="Patient address" optional>
            <input className="input" value={patient.address} onChange={p("address")} autoComplete="off" />
          </Field>
        </div>
      </section>

      {warnings.length > 0 && (
        <div className="notice warn">
          <b>Check for duplicate therapy</b>
          <ul>
            {warnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="eyes">
        <EyePanel
          title="Right eye"
          code="OD"
          color="var(--od)"
          slots={right}
          setSlots={setRight}
          otherSlots={left}
          setOtherSlots={setLeft}
          otherLabel="OS"
          formulary={formulary}
        />
        <EyePanel
          title="Left eye"
          code="OS"
          color="var(--os)"
          slots={left}
          setSlots={setLeft}
          otherSlots={right}
          setOtherSlots={setRight}
          otherLabel="OD"
          formulary={formulary}
        />
      </div>

      <div className="cta-row">
        <button className="btn" disabled={!any} onClick={() => go("rx")}>
          Prescription
        </button>
        <button className="btn primary" disabled={!any} onClick={() => go("schedule")}>
          Build patient schedule
        </button>
      </div>
    </div>
  );
}
