import { useId, useRef, useState } from "react";

const GLAUCOMA = new Set(["PGA", "BB", "CAI", "AA", "MIO"]);

// Type to search the formulary, then choose with the mouse or the arrow keys
// and Enter. Nothing is chosen until the clinician confirms a drug, so
// moving through the list can never change a drop by accident.
export default function MedPicker({ formulary, onPick, onCancel, label, autoFocus = false }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const input = useRef(null);

  const q = query.trim().toLowerCase();
  const matches = [...formulary]
    .filter((m) => !q || `${m.brand} ${m.generic}`.toLowerCase().includes(q))
    .sort((a, b) => {
      const ga = a.cls.some((c) => GLAUCOMA.has(c)) ? 0 : 1;
      const gb = b.cls.some((c) => GLAUCOMA.has(c)) ? 0 : 1;
      const starts = (m) => (m.brand.toLowerCase().startsWith(q) ? 0 : 1);
      return (q ? starts(a) - starts(b) : ga - gb) || a.brand.localeCompare(b.brand);
    });

  const choose = (m) => {
    setQuery("");
    setOpen(false);
    onPick(m.brand);
  };
  const onKey = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      // The first press only opens the list, on the top match.
      if (!open) setOpen(true);
      else setActive((i) => Math.min(i + 1, matches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open && matches[active]) {
      e.preventDefault();
      choose(matches[active]);
    } else if (e.key === "Escape") {
      setActive(0);
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
        placeholder="Type a drug name"
        autoComplete="off"
        autoFocus={autoFocus}
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        onKeyDown={onKey}
      />
      {open && (
        <ul className="picker-list" id={listId} role="listbox" aria-label="Formulary">
          {matches.length === 0 && <li className="picker-none">No match. Add it in the Formulary first.</li>}
          {matches.map((m, i) => {
            const group = q ? null : m.cls.some((c) => GLAUCOMA.has(c)) ? "Glaucoma" : "Post-operative and other";
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
              </li>,
            ];
          })}
        </ul>
      )}
    </div>
  );
}
