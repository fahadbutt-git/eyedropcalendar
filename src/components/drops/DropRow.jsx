import { DROP_OPTIONS, FREQ_OPTIONS, TAPER_PRESETS } from "../../lib/regimen.js";
import TaperEditor, { clampDays } from "./TaperEditor.jsx";
import { CapDot } from "../ui.jsx";

const GLAUCOMA = new Set(["PGA", "BB", "CAI", "AA", "MIO"]);
const EYE_CHOICES = [
  ["OD", "Right"],
  ["OS", "Left"],
  ["OU", "Both"],
];

function MedSelect({ id, value, onChange, formulary }) {
  const sorted = [...formulary].sort((a, b) => a.brand.localeCompare(b.brand));
  const groups = [
    ["Glaucoma", sorted.filter((m) => m.cls.some((c) => GLAUCOMA.has(c)))],
    ["Post-operative and other", sorted.filter((m) => !m.cls.some((c) => GLAUCOMA.has(c)))],
  ];
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{value ? "Remove this drop" : "Add a drop"}</option>
      {groups.map(
        ([label, meds]) =>
          meds.length > 0 && (
            <optgroup key={label} label={label}>
              {meds.map((m) => (
                <option key={m.id} value={m.brand}>
                  {m.brand}  ·  {m.generic.split(" (")[0]}
                </option>
              ))}
            </optgroup>
          )
      )}
    </select>
  );
}

function NumberField({ label, value, onChange, after }) {
  return (
    <label className="inline">
      {label}
      <input
        className="input sm num"
        type="number"
        inputMode="numeric"
        min={1}
        max={365}
        value={value}
        onChange={(e) => onChange(clampDays(e.target.value))}
      />
      {after}
    </label>
  );
}

export default function DropRow({ index, drop, formulary, update, remove }) {
  const med = formulary.find((m) => m.brand === drop.brand);
  const name = drop.brand;
  const pick = (brand) => {
    if (!brand) return remove();
    const m = formulary.find((x) => x.brand === brand);
    update({ brand, freq: m?.freq ?? 2, drops: m?.drops ?? 1 });
  };
  const setMode = (mode) =>
    update(mode === "taper" && !drop.steps.length ? { mode, steps: TAPER_PRESETS[0].build(drop.freq) } : { mode });

  if (!name)
    return (
      <li className="drop drop-empty">
        <label htmlFor={`med-${drop.id}`} className="sr-only">
          Drop {index + 1}
        </label>
        <MedSelect id={`med-${drop.id}`} value="" formulary={formulary} onChange={pick} />
      </li>
    );

  return (
    <li className="drop">
      <div className="drop-grid">
        <div className="drop-med">
          <label htmlFor={`med-${drop.id}`} className="sr-only">
            Drop {index + 1}
          </label>
          <MedSelect id={`med-${drop.id}`} value={name} formulary={formulary} onChange={pick} />
          {med && (
            <div className="drop-meta">
              <CapDot cap={med.cap} />
              {med.lu && <span className="tag lu">LU {med.lu}</span>}
              {med.form === "suspension" && <span className="tag">Shake well</span>}
              {med.qhs && drop.freq === 1 && drop.mode !== "taper" && <span className="tag">At bedtime</span>}
            </div>
          )}
        </div>
        <div className="seg eye-seg" role="radiogroup" aria-label={`Eye for ${name}`}>
          {EYE_CHOICES.map(([k, label]) => (
            <button key={k} role="radio" aria-checked={drop.eye === k} className={drop.eye === k ? "on" : ""} onClick={() => update({ eye: k })}>
              {label}
            </button>
          ))}
        </div>
        <select
          className="select"
          aria-label={`How often for ${name}`}
          disabled={drop.mode === "taper"}
          value={drop.mode === "taper" ? drop.steps[0]?.freq ?? drop.freq : drop.freq}
          onChange={(e) => update({ freq: Number(e.target.value) })}
        >
          {FREQ_OPTIONS.map((f) => (
            <option key={f} value={f}>
              {f}x a day
            </option>
          ))}
        </select>
        <select className="select" aria-label={`Drops each time for ${name}`} value={drop.drops} onChange={(e) => update({ drops: Number(e.target.value) })}>
          {DROP_OPTIONS.map((d) => (
            <option key={d} value={d}>
              {d} drop{d > 1 ? "s" : ""}
            </option>
          ))}
        </select>
        <select className="select" aria-label={`Course for ${name}`} value={drop.mode} onChange={(e) => setMode(e.target.value)}>
          <option value="ongoing">Ongoing</option>
          <option value="duration">Fixed course</option>
          <option value="taper">Taper</option>
        </select>
        <button className="icon-btn" aria-label={`Remove ${name}`} onClick={remove}>
          ×
        </button>
      </div>

      <div className="drop-extra">
        {drop.mode === "duration" && (
          <NumberField label="For" value={drop.durationDays} onChange={(v) => update({ durationDays: v })} after="days, then stop" />
        )}
        {drop.startDay > 1 || drop.showStart ? (
          <>
            <NumberField label="Starts on day" value={drop.startDay} onChange={(v) => update({ startDay: v })} after="of the schedule" />
            <button className="link-btn" onClick={() => update({ startDay: 1, showStart: false })}>
              Start on day 1
            </button>
          </>
        ) : (
          <button className="link-btn" onClick={() => update({ showStart: true })}>
            Start later
          </button>
        )}
      </div>
      {drop.mode === "taper" && <TaperEditor drop={drop} update={update} />}
    </li>
  );
}
