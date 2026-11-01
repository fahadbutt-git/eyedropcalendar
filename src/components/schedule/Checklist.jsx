import { WEEKDAYS, addDays, fmtShort } from "../../lib/dates.js";
import { EYES, dosesOnDay } from "../../lib/regimen.js";
import { Boxes, Chip } from "../ui.jsx";

// The same plan as a table: one row per day, one column per drug.
export default function Checklist({ items, start, days }) {
  return (
    <table className="tbl-sched">
      <thead>
        <tr>
          <th scope="col">Date</th>
          {items.map(({ entry, index, chip }) => (
            <th key={index} scope="col">
              <span className="row" style={{ justifyContent: "center", gap: 6 }}>
                <Chip n={index + 1} style={chip} /> {entry.brand}, {EYES[entry.eye].long}
              </span>
            </th>
          ))}
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: days }, (_, day) => {
          const date = addDays(start, day);
          return (
            <tr key={day}>
              <th scope="row">
                {WEEKDAYS[date.getDay()]} {fmtShort(date)}
              </th>
              {items.map(({ entry, index }) => {
                const n = dosesOnDay(entry, day);
                return <td key={index}>{n ? <Boxes n={n} /> : <span className="none">none</span>}</td>;
              })}
              <td />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
