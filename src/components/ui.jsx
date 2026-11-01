import { CAP_COLOURS } from "../data/formulary.js";

export function Field({ label, optional, children, className = "" }) {
  return (
    <label className={`field ${className}`}>
      <span>
        {label} {optional && <em>(optional)</em>}
      </span>
      {children}
    </label>
  );
}

export function CapDot({ cap, title }) {
  const c = CAP_COLOURS[cap] || CAP_COLOURS[""];
  return (
    <span
      className={`cap ${cap ? "" : "none"}`}
      style={{ background: c.hex }}
      title={title || (cap ? `${c.label} cap` : "Cap colour not specified")}
    />
  );
}

export function EyeTag({ eye }) {
  return <span className={`tag ${eye.toLowerCase()}`}>{eye}</span>;
}

// Distinct chip colours for calendar legends. Cap colour is preferred when set
// because it is what the patient sees on the bottle.
const PALETTE = ["#1d5fa8", "#2d7650", "#a8461d", "#6a4a9c", "#0f7c86", "#9a2f5b", "#5b6b1d", "#38465a"];
const LIGHT = new Set(["yellow", "white", "tan", "pink", "blue", "orange", "grey"]);

export function chipStyle(entry, index, med) {
  const cap = med?.cap;
  if (cap && CAP_COLOURS[cap]) {
    return {
      background: CAP_COLOURS[cap].hex,
      color: LIGHT.has(cap) ? "#1b2430" : "#fff",
      border: cap === "white" ? "1px solid #1b2430" : "none",
    };
  }
  return { background: PALETTE[index % PALETTE.length], color: "#fff" };
}

export function Chip({ n, style }) {
  return (
    <span className="chip" style={style}>
      {n}
    </span>
  );
}

export const Icon = {
  print: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
      <path d="M6 14h12v8H6z" />
    </svg>
  ),
  bell: (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
    </svg>
  ),
  check: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  ),
  eye: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
};
