import { WEEKDAYS, daysBetween, fmtShort } from "../../lib/dates.js";
import { dosesOnDay } from "../../lib/regimen.js";
import { Boxes, Chip } from "../ui.jsx";

const EYE_WORD = { OD: "Right", OS: "Left", OU: "Both" };

// One day: a tick box per dose for each drug, plus markers on the days a
// drug starts, changes frequency or stops.
function DayCell({ label, dayIndex, items }) {
  return (
    <td>
      <div className="dnum">
        <span>{label}</span>
        {dayIndex === 0 && <span className="flag">Start</span>}
      </div>
      {items.map(({ entry, index, chip }) => {
        const n = dosesOnDay(entry, dayIndex);
        const prev = dayIndex > 0 ? dosesOnDay(entry, dayIndex - 1) : 0;
        if (!n && !prev) return null;
        if (!n)
          return (
            <div className="dose stop" key={index}>
              <Chip n={index + 1} style={chip} /> Stop
            </div>
          );
        const change = dayIndex === 0 ? null : !prev ? "start" : prev !== n ? `${n < prev ? "↓" : "↑"}${n}x` : null;
        return (
          <div className="dose" key={index}>
            <Chip n={index + 1} style={chip} />
            <span className="eye">{EYE_WORD[entry.eye]}</span>
            <Boxes n={n} />
            {change && <span className="change">{change}</span>}
          </div>
        );
      })}
    </td>
  );
}

export default function CalendarGrid({ weeks, items, start, lastIndex, month, rowHeight }) {
  return (
    <div className="cal-wrap" style={{ "--row-h": `${rowHeight}px` }}>
      <table className="cal">
        <thead>
          <tr>
            {WEEKDAYS.map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week, wi) => (
            <tr key={wi}>
              {week.map((date, di) => {
                if (!date || (month != null && date.getMonth() !== month)) return <td key={di} className="out" />;
                const dayIndex = daysBetween(start, date);
                const label = date.getDate() === 1 || (wi === 0 && di === 0) ? fmtShort(date) : date.getDate();
                if (dayIndex < 0 || dayIndex > lastIndex)
                  return (
                    <td key={di} className="inactive">
                      <div className="dnum">{label}</div>
                    </td>
                  );
                return <DayCell key={di} label={label} dayIndex={dayIndex} items={items} />;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
