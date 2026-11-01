import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS, addDays, daysBetween, fmtLong, fmtShort, parseISO, toISO } from "../../lib/dates.js";
import { scheduleSpan } from "../../lib/calendar.js";
import { doseGroups } from "../../lib/doses.js";
import { isNative } from "../../lib/native.js";
import { EYES, dosesOnDay } from "../../lib/regimen.js";
import { fmtTime } from "../../lib/times.js";
import { patientInstruction } from "../../lib/wording.js";
import { usePersistentState } from "../../lib/storage.js";
import { CapDot, Icon, chipStyle } from "../ui.jsx";
import InstallTip from "./InstallTip.jsx";
import Reminders from "./Reminders.jsx";

// Ticked doses are stored per day as { "<drug index>-<dose number>": true }.
const doseKey = (index, dose) => `${index}-${dose}`;

function DoseButton({ entry, med, chip, done, onToggle }) {
  return (
    <button className={`dose-card ${done ? "is-done" : ""}`} onClick={onToggle} aria-pressed={done}>
      <span className="bar" style={{ background: chip.background, border: chip.border }} />
      <span className="dose-text">
        <span className="n">{entry.brand}</span>
        <span className="d">
          {entry.drops} drop{entry.drops > 1 ? "s" : ""} in {entry.eye === "OU" ? "" : "the "}
          {EYES[entry.eye].long}
          {med?.form === "suspension" && ". Shake first."}
        </span>
      </span>
      <span className={`tick ${done ? "done" : ""}`} aria-hidden="true">
        {done && Icon.check}
      </span>
      <span className="sr-only">{done ? "Done. Tap to undo." : "Tap when done."}</span>
    </button>
  );
}

function weekSummary(entries, start, today, taken) {
  let due = 0;
  let got = 0;
  for (let i = Math.max(0, today - 7); i < today; i++) {
    const ticks = taken[toISO(addDays(start, i))] || {};
    entries.forEach((e, index) => {
      for (let d = 0; d < dosesOnDay(e, i); d++) {
        due++;
        if (ticks[doseKey(index, d)]) got++;
      }
    });
  }
  return { due, got };
}

export default function PatientView({ plan: shared, code }) {
  const start = parseISO(shared.start);
  const span = scheduleSpan(shared.entries, 3, start);
  const plan = useMemo(() => ({ ...shared, start, days: span.days }), [code]); // eslint-disable-line react-hooks/exhaustive-deps
  const storeKey = code.slice(0, 48);
  const today = daysBetween(start, new Date());
  const [day, setDay] = useState(Math.min(Math.max(today, 0), span.days - 1));
  const [taken, setTaken] = usePersistentState(`edt.taken.${storeKey}`, {}, { check: (v) => (v && typeof v === "object" ? v : null) });
  const [large, setLarge] = usePersistentState("edt.largeText", false);

  useEffect(() => {
    try {
      localStorage.setItem("edt.patientPlan", code);
    } catch {
      // Without storage the plan simply opens from the link each time.
    }
  }, [code]);
  useEffect(() => {
    document.body.classList.toggle("large-text", large);
  }, [large]);

  const date = addDays(start, day);
  const ticks = taken[toISO(date)] || {};
  const toggle = (key) => setTaken({ ...taken, [toISO(date)]: { ...ticks, [key]: !ticks[key] } });
  const groups = doseGroups(shared.entries, shared.formulary, day, shared.wake, shared.bed);
  const total = groups.reduce((n, g) => n + g.items.length, 0);
  const done = groups.reduce((n, g) => n + g.items.filter((it) => ticks[doseKey(it.index, it.dose)]).length, 0);
  const week = weekSummary(shared.entries, start, Math.min(today, span.days), taken);
  const medOf = (entry) => shared.formulary.find((m) => m.brand === entry.brand);

  return (
    <div className="pt stack">
      <div className="pt-top">
        <h1>My eye drops</h1>
        <button className="btn sm" onClick={() => setLarge(!large)} aria-pressed={large}>
          {large ? "Smaller text" : "Larger text"}
        </button>
      </div>

      {today < 0 && <div className="notice info">Your drops start on {fmtLong(start)}.</div>}
      {today >= span.days && <div className="notice info">This plan has finished. Follow your clinic&apos;s advice for what comes next.</div>}

      <section className="card" aria-labelledby="day-h">
        <div className="daybar">
          <button className="btn icon" disabled={day <= 0} onClick={() => setDay(day - 1)} aria-label="Previous day">
            ‹
          </button>
          <div className="daybar-mid">
            <div id="day-h" className="daybar-day">
              {day === today ? "Today" : WEEKDAYS[date.getDay()]}, {fmtShort(date)}
            </div>
            <div className="small muted" aria-live="polite">
              {total ? `${done} of ${total} done` : "No drops this day"}
            </div>
          </div>
          <button className="btn icon" disabled={day >= span.days - 1} onClick={() => setDay(day + 1)} aria-label="Next day">
            ›
          </button>
        </div>
        {total > 0 && (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(100 * done) / total}%` }} />
          </div>
        )}
        {day !== today && today >= 0 && today < span.days && (
          <button className="link-btn back-today" onClick={() => setDay(today)}>
            Back to today
          </button>
        )}
        {groups.map(({ time, items }) => (
          <div key={time} className="time-group">
            <div className="time-h">
              {fmtTime(time)}
              {items.length > 1 && <span> · wait 5 minutes between drops</span>}
            </div>
            {items.map(({ entry, index, dose }) => {
              const key = doseKey(index, dose);
              const med = medOf(entry);
              return (
                <DoseButton key={key} entry={entry} med={med} chip={chipStyle(index, med)} done={!!ticks[key]} onToggle={() => toggle(key)} />
              );
            })}
          </div>
        ))}
      </section>

      {week.due > 0 && (
        <p className="small muted">
          Last 7 days: {week.got} of {week.due} doses checked off.
        </p>
      )}

      <Reminders plan={plan} code={code} storeKey={storeKey} />
      {!isNative && <InstallTip />}

      <section className="card card-b stack" style={{ gap: 14 }} aria-labelledby="mine-h">
        <h2 id="mine-h" className="pt-h2">
          My drops
        </h2>
        {shared.entries.map((e, i) => {
          const med = medOf(e);
          return (
            <div key={i} className="drug">
              <div className="drug-name">
                <CapDot cap={med?.cap} /> <b>{e.brand}</b> <span className="muted">{med?.generic}</span>
              </div>
              <div>{patientInstruction(e, med?.qhs, start)}</div>
            </div>
          );
        })}
        <p className="small muted">Follow your eye doctor if their instructions differ from this plan. Your check marks stay on this phone only.</p>
      </section>
    </div>
  );
}
