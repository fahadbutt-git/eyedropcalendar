// Small shared pieces of interface.
import { useEffect, useId, useState } from "react";
import { CAP_COLOURS } from "../data/formulary.js";

export function Field({ label, optional, hint, children }) {
  return (
    <label className="field">
      <span className="field-label">
        {label} {optional && <em>(optional)</em>}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

// Cap colour as a swatch plus its name, so it never relies on colour alone.
export function CapDot({ cap, named = false }) {
  const c = CAP_COLOURS[cap];
  if (!cap || !c) return named ? <span className="cap-name muted">Cap colour not standard</span> : null;
  return (
    <span className="cap-wrap">
      <span className={`cap ${cap === "white" ? "light" : ""}`} style={{ background: c.hex }} role="img" aria-label={`${c.label} cap`} />
      {named && <span className="cap-name">{c.label} cap</span>}
    </span>
  );
}

// Numbered marker that ties a calendar mark to its drug. The bottle's cap
// colour is used when known, so the patient can match the bottle. Without a
// standard cap colour the marker stays plain ink, so it never suggests a
// colour the bottle does not have.
const DARK_TEXT = new Set(["yellow", "white", "tan", "pink", "blue", "orange", "grey", "lightgreen"]);

export function chipStyle(med) {
  const cap = med?.cap;
  if (!cap || !CAP_COLOURS[cap]) return { background: "#111111", color: "#fff" };
  return {
    background: CAP_COLOURS[cap].hex,
    color: DARK_TEXT.has(cap) ? "#111111" : "#fff",
    boxShadow: "inset 0 0 0 1.5px #111111",
  };
}

export const Chip = ({ n, style }) => (
  <span className="chip" style={style} aria-hidden="true">
    {n}
  </span>
);

// One tick box per dose.
export const Boxes = ({ n }) => (
  <span className="boxes" role="img" aria-label={`${n} dose${n > 1 ? "s" : ""}`}>
    {Array.from({ length: n }, (_, k) => (
      <i key={k} />
    ))}
  </span>
);

// A row of choices built on native radio buttons, so arrow keys, screen
// readers and high contrast mode all work as expected.
export function Choice({ legend, value, options, onChange, hideLegend = false, className = "" }) {
  const name = useId();
  return (
    <fieldset className={`choice ${className}`}>
      <legend className={hideLegend ? "sr-only" : "field-label"}>{legend}</legend>
      <div className="choice-row">
        {options.map(([v, label]) => (
          <label key={v} className={value === v ? "on" : ""}>
            <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
            <span>{label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

// A whole number field. What is typed is only saved when the field is left
// or Enter is pressed, so typing "400" can never save "40" on the way. A
// number outside the range is not saved and stays marked until corrected.
export function NumberInput({ value, onChange, min = 1, max = 365, label, className = "", ...rest }) {
  const [text, setText] = useState(String(value));
  useEffect(() => {
    setText(String(value));
  }, [value]);
  const n = Number(text);
  const valid = /^\d+$/.test(text) && n >= min && n <= max;
  const commit = () => valid && n !== value && onChange(n);
  return (
    <span className="num-wrap">
      <input
        className={`input num ${valid ? "" : "invalid"} ${className}`}
        inputMode="numeric"
        aria-label={label}
        aria-invalid={!valid}
        value={text}
        onChange={(e) => setText(e.target.value.replace(/[^\d]/g, "").slice(0, 3))}
        onBlur={commit}
        onKeyDown={(e) => e.key === "Enter" && commit()}
        {...rest}
      />
      {!valid && (
        <span className="num-error" role="alert">
          Not saved: enter {min} to {max}
        </span>
      )}
    </span>
  );
}

const svg = (children, size = 18, width = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={width} aria-hidden="true">
    {children}
  </svg>
);

export const Icon = {
  print: svg(
    <>
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </>
  ),
  bell: svg(<path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />),
  check: svg(<path d="M20 6 9 17l-5-5" />, 26, 3.5),
};

// Shows the matching print sheets while the print dialog is open.
export function printSheets(kind) {
  const cls = `print-${kind}`;
  document.body.classList.add(cls);
  const done = () => {
    document.body.classList.remove(cls);
    window.removeEventListener("afterprint", done);
  };
  window.addEventListener("afterprint", done);
  window.print();
}
