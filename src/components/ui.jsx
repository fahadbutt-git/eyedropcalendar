// Small shared pieces of interface.
import { CAP_COLOURS } from "../data/formulary.js";

export function Field({ label, optional, children }) {
  return (
    <label className="field">
      <span>
        {label} {optional && <em>(optional)</em>}
      </span>
      {children}
    </label>
  );
}

export function CapDot({ cap }) {
  const c = CAP_COLOURS[cap] || CAP_COLOURS[""];
  return (
    <span
      className={`cap ${cap ? "" : "none"}`}
      style={{ background: c.hex }}
      title={cap ? `${c.label} cap` : "Cap colour not standard"}
    />
  );
}

// Numbered marker that ties a calendar mark to its drug. The bottle's cap
// colour is used when known, so the patient can match the bottle.
const PALETTE = ["#1d5fa8", "#2d7650", "#a8461d", "#6a4a9c", "#0f7c86", "#9a2f5b", "#5b6b1d", "#38465a"];
const DARK_TEXT = new Set(["yellow", "white", "tan", "pink", "blue", "orange", "grey"]);

export function chipStyle(index, med) {
  const cap = med?.cap;
  if (!cap || !CAP_COLOURS[cap]) return { background: PALETTE[index % PALETTE.length], color: "#fff" };
  return {
    background: CAP_COLOURS[cap].hex,
    color: DARK_TEXT.has(cap) ? "#17202b" : "#fff",
    border: cap === "white" ? "1px solid #17202b" : "none",
  };
}

export const Chip = ({ n, style }) => (
  <span className="chip" style={style}>
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

const svg = (children, size = 16, stroke = "currentColor", width = 2) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={width} aria-hidden="true">
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
  check: svg(<path d="M20 6 9 17l-5-5" />, 20, "currentColor", 3),
  eye: svg(
    <>
      <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z" />
      <circle cx="12" cy="12" r="3" />
    </>,
    18,
    "#fff"
  ),
};
