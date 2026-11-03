import { WEEKDAYS, addDays, fmtShort } from "../../lib/dates.js";
import { changeNotes } from "../../lib/changes.js";
import { doseGroups } from "../../lib/doses.js";
import { EYES } from "../../lib/regimen.js";
import { fmtTime } from "../../lib/times.js";
import { Chip } from "../ui.jsx";

const ROWS_PER_PAGE = { standard: 11, large: 7, compact: 13 };
// One page per week (more if the rows do not fit): a row for each drug at
// each time of day, and a tick box for each day it is due.
export function chartPages({ items, entries, formulary, start, days, wake, bed, size }) {
  const pages = [];
  for (let first = 0; first < days; first += 7) {
    const last = Math.min(days - 1, first + 6);
    const cols = Array.from({ length: 7 }, (_, k) => first + k);
    const rows = new Map();
    for (let i = first; i <= last; i++) {
      for (const g of doseGroups(entries, formulary, i, wake, bed)) {
        g.items.forEach((it, order) => {
          const key = `${g.time}|${it.index}`;
          if (!rows.has(key)) rows.set(key, { time: g.time, order, item: items[it.index], due: new Set() });
          rows.get(key).due.add(i);
        });
      }
    }
    const sorted = [...rows.values()].sort((a, b) => a.time - b.time || a.order - b.order);
    const notes = changeNotes(entries, start, first, last);
    const per = ROWS_PER_PAGE[size] || ROWS_PER_PAGE.standard;
    for (let r = 0; r < Math.max(1, sorted.length); r += per) {
      pages.push({ week: first / 7 + 1, first, last, cols, rows: sorted.slice(r, r + per), notes: r === 0 ? notes : [], part: r / per });
    }
  }
  return pages;
}

export default function DailyChart({ page, start, lastIndex }) {
  const { cols, rows, notes } = page;
  return (
    <>
      {notes.length > 0 && (
        <ul className="week-band">
          {notes.map((n) => (
            <li key={n}>{n}</li>
          ))}
        </ul>
      )}
      <table className="chart">
        <thead>
          <tr>
            <th scope="col" className="c-time">
              Time
            </th>
            <th scope="col" className="c-drop">
              Drop
            </th>
            {cols.map((i) => {
              const d = addDays(start, i);
              return (
                <th scope="col" key={i} className={i > lastIndex ? "off" : ""}>
                  {WEEKDAYS[d.getDay()]}
                  <span>{fmtShort(d)}</span>
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ time, item, due }, r) => {
            const lastOfTime = rows[r + 1]?.time !== time;
            return (
              <tr key={`${time}-${item.index}`} className={lastOfTime ? "end" : ""}>
                <th scope="row" className="c-time mono">
                  {rows[r - 1]?.time === time ? "" : fmtTime(time)}
                </th>
                <td className="c-drop" style={item.tint ? { background: item.tint } : undefined}>
                  <div className="c-drop-in">
                    <Chip n={item.index + 1} style={item.chip} />
                    <span>
                      <b>{item.entry.brand}</b> {EYES[item.entry.eye].long}
                    </span>
                  </div>
                </td>
                {cols.map((i) => (
                  <td key={i} className={due.has(i) ? "due" : "none"}>
                    {due.has(i) ? <i className="box" aria-label="dose" role="img" /> : i <= lastIndex ? "" : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </>
  );
}
