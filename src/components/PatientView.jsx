import { useEffect, useMemo, useState } from "react";
import { MONTHS, DAY_INDEX_NAMES, scheduleSpan } from "../lib/calendar.js";
import {
  EYES,
  addDays,
  daysBetween,
  dosesOnDay,
  doseTimes,
  fmtTime,
  parseISO,
  sigText,
  toISO,
} from "../lib/regimen.js";
import { buildICS, downloadFile } from "../lib/ics.js";
import { usePersistentState } from "../lib/storage.js";
import { CapDot, Icon, chipStyle } from "./ui.jsx";
import { APP_NAME } from "../config.js";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

export default function PatientView({ plan, code }) {
  const start = parseISO(plan.start);
  const span = scheduleSpan(plan.entries, 3, start);
  const todayIdx = daysBetween(start, new Date());
  const [day, setDay] = useState(Math.min(Math.max(todayIdx, 0), span.days - 1));
  const [taken, setTaken] = usePersistentState(`edt.taken.${code.slice(0, 40)}`, {});
  const [large, setLarge] = usePersistentState("edt.largeText", false);
  const [installEvt, setInstallEvt] = useState(null);
  const [showIOS, setShowIOS] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem("edt.patientPlan", code);
    } catch {
      /* ignore */
    }
    const h = (e) => {
      e.preventDefault();
      setInstallEvt(e);
    };
    window.addEventListener("beforeinstallprompt", h);
    return () => window.removeEventListener("beforeinstallprompt", h);
  }, [code]);

  useEffect(() => {
    document.body.classList.toggle("large-text", !!large);
  }, [large]);

  const date = addDays(start, day);
  const dateKey = toISO(date);

  const doses = useMemo(() => {
    const list = [];
    plan.entries.forEach((e, i) => {
      const n = dosesOnDay(e, day);
      const med = plan.formulary.find((m) => m.brand === e.brand);
      doseTimes(n, plan.wake, plan.bed, med?.qhs).forEach((t, k) =>
        list.push({ e, i, med, t, id: `${i}-${k}` })
      );
    });
    return list.sort((a, b) => a.t - b.t || a.i - b.i);
  }, [plan, day]);

  const done = taken[dateKey] || {};
  const toggle = (id) => setTaken({ ...taken, [dateKey]: { ...done, [id]: !done[id] } });
  const doneCount = doses.filter((d) => done[d.id]).length;

  // Adherence over the past 7 recorded days
  const adherence = useMemo(() => {
    let due = 0;
    let got = 0;
    for (let i = Math.max(0, todayIdx - 7); i < Math.min(todayIdx, span.days); i++) {
      const k = toISO(addDays(start, i));
      plan.entries.forEach((e, ei) => {
        const n = dosesOnDay(e, i);
        for (let j = 0; j < n; j++) {
          due++;
          if (taken[k]?.[`${ei}-${j}`]) got++;
        }
      });
    }
    return due ? Math.round((100 * got) / due) : null;
  }, [taken, plan, todayIdx, span.days, start]);

  const ics = () =>
    downloadFile(
      "eye-drop-reminders.ics",
      buildICS({ entries: plan.entries, formulary: plan.formulary, start, days: span.days, wake: plan.wake, bed: plan.bed }),
      "text/calendar"
    );

  const install = async () => {
    if (installEvt) {
      installEvt.prompt();
      setInstallEvt(null);
    } else setShowIOS(true);
  };

  return (
    <div className="pt stack">
      <div className="row">
        <div>
          <h1 style={{ fontSize: 22, letterSpacing: "-0.01em" }}>My eye drops</h1>
          <div className="muted small">Plan started {MONTHS[start.getMonth()]} {start.getDate()}, {start.getFullYear()}</div>
        </div>
        <span className="spacer" />
        <button className="btn sm" onClick={() => setLarge(!large)} aria-pressed={!!large}>
          {large ? "Normal text" : "Larger text"}
        </button>
      </div>

      <section className="card">
        <div className="card-h">
          <div className="daynav">
            <button className="btn sm" disabled={day <= 0} onClick={() => setDay(day - 1)} aria-label="Previous day">‹</button>
            <div>
              <div style={{ fontWeight: 650 }}>
                {day === todayIdx ? "Today" : DAY_INDEX_NAMES[date.getDay()]}, {MONTHS[date.getMonth()].slice(0, 3)} {date.getDate()}
              </div>
              <div className="small muted">Day {day + 1}</div>
            </div>
            <button className="btn sm" disabled={day >= span.days - 1} onClick={() => setDay(day + 1)} aria-label="Next day">›</button>
          </div>
          <span className="spacer" />
          <span className="small muted">{doneCount} of {doses.length} done</span>
        </div>
        {doses.length === 0 && <div className="card-b muted">No drops scheduled for this day.</div>}
        {doses.map(({ e, i, med, t, id }, k) => {
          const style = chipStyle(e, i, med);
          const first = k === 0 || doses[k - 1].t !== t;
          const group = doses.filter((d) => d.t === t).length;
          return (
            <div key={id}>
              {first && (
                <div className="time-h">
                  {fmtTime(t)}
                  {group > 1 && <span> · {group} drops, wait 5 minutes between each</span>}
                </div>
              )}
            <div className="dose-card">
              <span className="bar" style={{ background: style.background, border: style.border }} />
              <div>
                <div className="n">{e.brand}</div>
                <div className="d">
                  {e.drops} drop{e.drops > 1 ? "s" : ""} in {e.eye === "OU" ? "" : "the "}{EYES[e.eye].long}
                  {med?.form === "suspension" ? " · shake well" : ""}
                </div>
              </div>
              <button className={`tick ${done[id] ? "done" : ""}`} onClick={() => toggle(id)} aria-label={done[id] ? "Mark not taken" : "Mark taken"}>
                {done[id] && Icon.check}
              </button>
            </div>
            </div>
          );
        })}
      </section>

      {adherence != null && (
        <div className="notice info small">Doses checked off in the last 7 days: {adherence}%</div>
      )}

      <section className="card">
        <div className="card-h"><h2>Reminders</h2></div>
        <div className="card-b stack" style={{ gap: 10 }}>
          <button className="btn primary" onClick={ics}>{Icon.bell} Add alarms to my phone calendar</button>
          <p className="small muted">
            This adds an alert to your calendar at each dose time for the whole plan. Open the downloaded file and
            choose Add All.
          </p>
          {!isStandalone() && (
            <button className="btn" onClick={install}>Add {APP_NAME} to my home screen</button>
          )}
          {showIOS && (
            <div className="notice info small">
              {isIOS()
                ? "In Safari, tap the Share button, then Add to Home Screen."
                : "Open your browser menu and choose Install app or Add to Home screen."}
            </div>
          )}
        </div>
      </section>

      <section className="card">
        <div className="card-h"><h2>My drops</h2></div>
        <div className="card-b stack" style={{ gap: 12 }}>
          {plan.entries.map((e, i) => {
            const med = plan.formulary.find((m) => m.brand === e.brand);
            return (
              <div key={i} className="drug">
                <div className="row" style={{ gap: 8 }}>
                  <CapDot cap={med?.cap} />
                  <b>{e.brand}</b>
                  <span className="muted small">{med?.generic}</span>
                </div>
                <div>{sigText(e, e.eye, med?.qhs)}</div>
              </div>
            );
          })}
          <p className="small muted">
            Wait 5 minutes between different drops. Follow your eye doctor&apos;s instructions if they differ from this
            plan. Your check marks are saved only on this phone.
          </p>
        </div>
      </section>
    </div>
  );
}
