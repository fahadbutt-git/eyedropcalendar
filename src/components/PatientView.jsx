import { useEffect, useMemo, useState } from "react";
import { MONTHS, DAY_INDEX_NAMES, scheduleSpan } from "../lib/calendar.js";
import { EYES, addDays, daysBetween, dosesOnDay, doseTimes, fmtTime, parseISO, patientInstruction, toISO } from "../lib/regimen.js";
import { buildICS, downloadFile } from "../lib/ics.js";
import { usePersistentState } from "../lib/storage.js";
import { APP_SCHEME, isNative, onAppResume, scheduleReminders, cancelReminders } from "../lib/native.js";
import { CapDot, Icon, chipStyle } from "./ui.jsx";
import { APP_NAME } from "../config.js";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent);
const isPhone = () => /iphone|ipod|android/i.test(navigator.userAgent);
const fmtLong = (d) => `${MONTHS[d.getMonth()]} ${d.getDate()}`;

export default function PatientView({ plan, code }) {
  const start = parseISO(plan.start);
  const span = scheduleSpan(plan.entries, 3, start);
  const todayIdx = daysBetween(start, new Date());
  const clampDay = (d) => Math.min(Math.max(d, 0), span.days - 1);
  const [day, setDay] = useState(clampDay(todayIdx));
  const [taken, setTaken] = usePersistentState(`edt.taken.${code.slice(0, 48)}`, {});
  const [large, setLarge] = usePersistentState("edt.largeText", false);
  const [alarms, setAlarms] = usePersistentState(`edt.alarms.${code.slice(0, 48)}`, null);
  const [alarmMsg, setAlarmMsg] = useState("");
  const [installEvt, setInstallEvt] = useState(null);
  const [showInstall, setShowInstall] = useState(false);

  const nativePlan = useMemo(
    () => ({ entries: plan.entries, formulary: plan.formulary, start, days: span.days, wake: plan.wake, bed: plan.bed }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [code]
  );

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

  // In the phone app, top up the rolling window of reminders on every open.
  useEffect(() => {
    if (!isNative || !alarms) return;
    const refresh = () => scheduleReminders(nativePlan).then((r) => r.ok && setAlarms({ until: r.until?.toISOString() }));
    refresh();
    return onAppResume(refresh);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nativePlan, !!alarms]);

  useEffect(() => {
    document.body.classList.toggle("large-text", !!large);
  }, [large]);

  const date = addDays(start, day);
  const dateKey = toISO(date);
  const isToday = day === todayIdx;

  const groups = useMemo(() => {
    const byTime = new Map();
    plan.entries.forEach((e, i) => {
      const n = dosesOnDay(e, day);
      const med = plan.formulary.find((m) => m.brand === e.brand);
      doseTimes(n, plan.wake, plan.bed, med?.qhs).forEach((t, k) => {
        if (!byTime.has(t)) byTime.set(t, []);
        byTime.get(t).push({ e, i, med, id: `${i}-${k}` });
      });
    });
    return [...byTime.entries()].sort((a, b) => a[0] - b[0]);
  }, [plan, day]);

  const done = taken[dateKey] || {};
  const toggle = (id) => setTaken({ ...taken, [dateKey]: { ...done, [id]: !done[id] } });
  const total = groups.reduce((a, [, l]) => a + l.length, 0);
  const doneCount = groups.reduce((a, [, l]) => a + l.filter((d) => done[d.id]).length, 0);

  const week = useMemo(() => {
    let due = 0;
    let got = 0;
    for (let i = Math.max(0, todayIdx - 7); i < Math.min(todayIdx, span.days); i++) {
      const k = toISO(addDays(start, i));
      plan.entries.forEach((e, ei) => {
        for (let j = 0; j < dosesOnDay(e, i); j++) {
          due++;
          if (taken[k]?.[`${ei}-${j}`]) got++;
        }
      });
    }
    return due ? { due, got } : null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taken, todayIdx]);

  const turnOnNative = async () => {
    const r = await scheduleReminders(nativePlan, { ask: true });
    if (r.ok) {
      setAlarms({ until: r.until?.toISOString() });
      setAlarmMsg("");
    } else if (r.denied) setAlarmMsg("Notifications are off for this app. Turn them on in your phone's Settings, then try again.");
  };
  const turnOffNative = async () => {
    await cancelReminders();
    setAlarms(null);
  };
  const ics = () =>
    downloadFile(
      "eye-drop-reminders.ics",
      buildICS({ ...nativePlan }),
      "text/calendar"
    );

  const notStarted = todayIdx < 0;
  const finished = todayIdx >= span.days;

  return (
    <div className="pt stack">
      <div className="pt-top">
        <h1>My eye drops</h1>
        <button className="btn sm" onClick={() => setLarge(!large)} aria-pressed={!!large}>
          {large ? "Smaller text" : "Larger text"}
        </button>
      </div>

      {notStarted && <div className="notice info">Your drops start on {fmtLong(start)}.</div>}
      {finished && <div className="notice info">This plan has finished. Follow your clinic&apos;s advice for what comes next.</div>}

      <section className="card" aria-labelledby="day-h">
        <div className="daybar">
          <button className="btn icon" disabled={day <= 0} onClick={() => setDay(day - 1)} aria-label="Previous day">
            ‹
          </button>
          <div className="daybar-mid">
            <div id="day-h" className="daybar-day">
              {isToday ? "Today" : DAY_INDEX_NAMES[date.getDay()]}, {fmtLong(date)}
            </div>
            <div className="small muted" aria-live="polite">
              {total ? `${doneCount} of ${total} done` : "No drops this day"}
            </div>
          </div>
          <button className="btn icon" disabled={day >= span.days - 1} onClick={() => setDay(day + 1)} aria-label="Next day">
            ›
          </button>
        </div>
        {total > 0 && (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(100 * doneCount) / total}%` }} />
          </div>
        )}
        {!isToday && todayIdx >= 0 && todayIdx < span.days && (
          <button className="link-btn back-today" onClick={() => setDay(todayIdx)}>
            Back to today
          </button>
        )}
        {groups.map(([t, list]) => (
          <div key={t} className="time-group">
            <div className="time-h">
              {fmtTime(t)}
              {list.length > 1 && <span> · wait 5 minutes between drops</span>}
            </div>
            {list.map(({ e, i, med, id }) => {
              const style = chipStyle(e, i, med);
              const on = !!done[id];
              return (
                <button key={id} className={`dose-card ${on ? "is-done" : ""}`} onClick={() => toggle(id)} aria-pressed={on}>
                  <span className="bar" style={{ background: style.background, border: style.border }} />
                  <span className="dose-text">
                    <span className="n">{e.brand}</span>
                    <span className="d">
                      {e.drops} drop{e.drops > 1 ? "s" : ""} in {e.eye === "OU" ? "" : "the "}
                      {EYES[e.eye].long}
                      {med?.form === "suspension" ? ". Shake first." : ""}
                    </span>
                  </span>
                  <span className={`tick ${on ? "done" : ""}`} aria-hidden="true">
                    {on && Icon.check}
                  </span>
                  <span className="sr-only">{on ? "Done. Tap to undo." : "Tap when done."}</span>
                </button>
              );
            })}
          </div>
        ))}
      </section>

      {week && week.due > 0 && (
        <p className="small muted">
          Last 7 days: {week.got} of {week.due} doses checked off.
        </p>
      )}

      <section className="card card-b stack" style={{ gap: 12 }} aria-labelledby="rem-h">
        <h2 id="rem-h" className="pt-h2">
          Reminders
        </h2>
        {isNative ? (
          alarms ? (
            <>
              <p>
                {Icon.bell} Reminders are on. Your phone will alert you at each dose time.
              </p>
              <button className="btn" onClick={turnOffNative}>
                Turn reminders off
              </button>
            </>
          ) : (
            <>
              <p>Get an alert on this phone at each dose time.</p>
              <button className="btn primary" onClick={turnOnNative}>
                {Icon.bell} Turn on reminders
              </button>
            </>
          )
        ) : (
          <>
            <p>Add an alarm to your phone&apos;s calendar for every dose in this plan.</p>
            <button className="btn primary" onClick={ics}>
              {Icon.bell} Add alarms to my calendar
            </button>
            <p className="small muted">Open the file that downloads and choose Add All.</p>
            {isPhone() && (
              <a className="small" href={`${APP_SCHEME}://p/${code}`}>
                Have the {APP_NAME} app? Open this plan in the app
              </a>
            )}
          </>
        )}
        {alarmMsg && (
          <p className="notice warn small" role="alert">
            {alarmMsg}
          </p>
        )}
      </section>

      {!isNative && !isStandalone() && (
        <section className="card card-b stack" style={{ gap: 10 }}>
          <h2 className="pt-h2">Keep this on your phone</h2>
          <p>Add this page to your home screen so you can open it like an app, even without internet.</p>
          <button
            className="btn"
            onClick={() => {
              if (installEvt) {
                installEvt.prompt();
                setInstallEvt(null);
              } else setShowInstall(true);
            }}
          >
            Add to home screen
          </button>
          {showInstall && (
            <p className="notice info small">
              {isIOS()
                ? "In Safari, tap the Share button (square with an arrow), then Add to Home Screen."
                : "Open your browser menu (three dots), then tap Install app or Add to Home screen."}
            </p>
          )}
        </section>
      )}

      <section className="card card-b stack" style={{ gap: 14 }} aria-labelledby="mine-h">
        <h2 id="mine-h" className="pt-h2">
          My drops
        </h2>
        {plan.entries.map((e, i) => {
          const med = plan.formulary.find((m) => m.brand === e.brand);
          return (
            <div key={i} className="drug">
              <div className="drug-name">
                <CapDot cap={med?.cap} /> <b>{e.brand}</b> <span className="muted">{med?.generic}</span>
              </div>
              <div>{patientInstruction(e, med?.qhs, start)}</div>
            </div>
          );
        })}
        <p className="small muted">
          Follow your eye doctor if their instructions differ from this plan. Your check marks stay on this phone only.
        </p>
      </section>
    </div>
  );
}
