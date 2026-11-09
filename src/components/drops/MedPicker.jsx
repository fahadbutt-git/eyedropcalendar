import { useId, useRef, useState } from "react";
import { searchFormulary, soleMatch } from "../../lib/drugSearch.js";

// Search results are grouped the way clinicians think about them.
const GROUPS = [
  ["Glaucoma", (c) => c.some((x) => ["PGA", "BB", "CAI", "AA", "MIO"].includes(x))],
  ["Steroid and antibiotic", (c) => c.includes("STER") && c.includes("ABX")],
  ["Corticosteroids", (c) => c.includes("STER")],
  ["NSAIDs", (c) => c.includes("NSAID")],
  ["Antibiotics", (c) => c.includes("ABX")],
  ["Anti-allergy", (c) => c.includes("ALG")],
  ["Dry eye", (c) => c.includes("IMM") || c.includes("LUB")],
  ["Antiviral and antifungal", (c) => c.includes("AV") || c.includes("AF")],
  ["Dilating and cycloplegic", (c) => c.includes("CYC")],
  ["Other", () => true],
];
const groupOf = (m) => GROUPS.findIndex(([, test]) => test(m.cls));

// Type to search the formulary, then choose with the mouse or the arrow keys
// and Enter. Nothing is chosen until the clinician confirms a drug, so
// moving through the list can never change a drop by accident. Enter alone
// picks only a single match or an exact name: when several strengths or
// forms match, the clinician highlights one first.
export default function MedPicker({ formulary, onPick, onCancel, label, autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  // -1 is no highlight: nothing has been pointed at yet.
  const [active, setActive] = useState(-1);
  const [ask, setAsk] = useState(false);
  const listId = useId();
  const hintId = useId();
  const input = useRef(null);

  const q = query.trim().toLowerCase();
  const matches = searchFormulary(formulary, query, groupOf);

  const choose = (m) => {
    setQuery("");
    setOpen(false);
    setActive(-1);
    setAsk(false);
    onPick(m.brand);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setAsk(false);
      setActive((i) => (open ? Math.min(i + 1, matches.length - 1) : Math.max(i, 0)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAsk(false);
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      const pick = matches[active] || soleMatch(matches, query);
      if (pick) choose(pick);
      else if (matches.length > 1) setAsk(true);
    } else if (e.key === "Escape") {
      setActive(-1);
      setAsk(false);
      if (open) setOpen(false);
      else onCancel?.();
    }
  };

  let lastGroup = null;
  return (
    <div className="picker">
      <input
        ref={input}
        className="input"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && matches[active] ? `${listId}-${matches[active].id}` : undefined}
        aria-describedby={ask ? hintId : undefined}
        placeholder="Type a drug name"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(-1);
          setAsk(false);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {open && ask && (
        <p className="picker-ask" id={hintId} role="status">
          More than one product matches. Use the arrow keys to choose one, then press Enter.
        </p>
      )}
      {open && (
        <ul className="picker-list" id={listId} role="listbox" aria-label="Formulary">
          {matches.length === 0 && <li className="picker-none">No match. Add it in the Formulary first.</li>}
          {matches.map((m, i) => {
            const group = q ? null : GROUPS[groupOf(m)][0];
            const heading = group !== lastGroup ? group : null;
            lastGroup = group;
            return [
              heading && (
                <li key={`g-${group}`} className="picker-group" role="presentation">
                  {heading}
                </li>
              ),
              <li
                key={m.id}
                id={`${listId}-${m.id}`}
                role="option"
                aria-selected={i === active}
                className={i === active ? "active" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(m);
                }}
                onMouseEnter={() => setActive(i)}
              >
                <b>{m.brand}</b> <span>{m.generic}</span>
                {m.aka && <span> · also {m.aka}</span>}
              </li>,
            ];
          })}
        </ul>
      )}
    </div>
  );
}
