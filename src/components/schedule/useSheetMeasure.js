import { useLayoutEffect, useState } from "react";
import { PRINT_SIZES } from "./layout.js";

// Printable width of a letter landscape sheet inside its margins.
const PRINT_WIDTH = "10.3in";

// Measures how tall a sheet's header, legends and column headings will be on
// paper, so the page budget for print uses real heights rather than
// estimates (long taper wording can wrap onto extra lines). The first sheet
// with each part is copied into a hidden box at the printed width and scale,
// so wrapping matches paper whatever the screen size. Heights come back in
// units of the sheet scale and update only when one changes by more than a
// tenth of a unit, so the layout settles at once.
export function useSheetMeasure(root, size, deps) {
  const [measured, setMeasured] = useState({});
  useLayoutEffect(() => {
    const el = root.current;
    const s = PRINT_SIZES[size]?.s;
    if (!el || !s) return;
    const box = document.createElement("div");
    box.className = `sched-print ${size} sheet-measure`;
    box.style.setProperty("--s", `${s}px`);
    box.style.width = PRINT_WIDTH;
    document.body.appendChild(box);
    const units = (selector, within) => {
      const source = [...el.querySelectorAll(".sheet")].find((sh) => sh.querySelector(selector) && (!within || within(sh)));
      if (!source) return undefined;
      box.replaceChildren(source.cloneNode(true));
      const node = box.querySelector(selector);
      const cs = getComputedStyle(node);
      return (node.getBoundingClientRect().height + parseFloat(cs.marginTop) + parseFloat(cs.marginBottom)) / s;
    };
    const next = {
      header: units(".sheet-h", (sh) => !sh.querySelector(".sheet-qr")),
      headerQr: units(".sheet-h", (sh) => !!sh.querySelector(".sheet-qr")),
      full: units(".legend:not(.compact)"),
      compact: units(".legend.compact"),
      thead: units(".cal thead"),
      chkHead: units(".tbl-sched thead"),
    };
    // Checklist rows differ in height (a day with many doses wraps), so each
    // one is measured. The table is already in the box from chkHead.
    const rows = box.querySelectorAll(".tbl-sched tbody tr");
    if (rows.length) next.chkRows = [...rows].map((r) => r.getBoundingClientRect().height / s);
    box.remove();
    const total = (v) => (Array.isArray(v) ? v.reduce((t, h) => t + h, 0) + v.length * 1000 : v || 0);
    const changed = Object.keys(next).some((k) => Math.abs(total(next[k]) - total(measured[k])) > 0.1);
    if (changed) setMeasured(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return measured;
}
