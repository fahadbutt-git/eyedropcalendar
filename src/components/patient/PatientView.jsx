import { useEffect, useMemo, useState } from "react";
import { WEEKDAYS, addDays, daysBetween, fmtLong, fmtShort, parseISO, toISO } from "../../lib/dates.js";
import { courseLastDay } from "../../lib/calendar.js";
import { changeNotes, dayName } from "../../lib/changes.js";
import { doseDayIndex, doseGroups, medOf, minutesInto, nextDose } from "../../lib/doses.js";
import { isNative, onAppResume } from "../../lib/native.js";
import { canSpeak, onVoicesChanged, speak, stopSpeaking } from "../../lib/speech.js";
import { CAP_COLOURS } from "../../data/formulary.js";
import { patientKey } from "../../lib/patientStore.js";
import { EYES } from "../../lib/regimen.js";
import { fmtTime } from "../../lib/times.js";
import { patientInstruction } from "../../lib/wording.js";
import { usePersistentState } from "../../lib/storage.js";
import { CapDot, Icon, capWords } from "../ui.jsx";
import { formInfo } from "../../data/forms.js";
import InstallTip from "./InstallTip.jsx";
import KeepPlan from "./KeepPlan.jsx";
import Reminders from "./Reminders.jsx";

// Check marks are stored per plan and per date as { "<brand>|<eye>|<dose>": time }.
const doseKey = ({ entry, dose }) => `${entry.brand}|${entry.eye}|${dose}`;
// Five minutes between drops, ten before a gel or ointment.
const waitFor = (it) => formInfo(it?.med?.form).wait * 60 * 1000;
const isObject = (v) => (v && typeof v === "object" && !Array.isArray(v) ? v : null);

// The current time, refreshed every 30 seconds and whenever the phone wakes
// the app, so "today" is always the real today.
function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const tick = () => setNow(new Date());
    const timer = setInterval(tick, 30000);
    const onVisible = () => document.visibilityState === "visible" && tick();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    const stop = onAppResume(tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
      stop();
    };
  }, []);
  return now;
}

// The cap to show for a drug: the patient's own bottle when they have set
// it, otherwise the usual colour for the drug class, shown as "usually".
// Pharmacies may switch to a generic from another maker with another cap.
const isCap = (k) => typeof k === "string" && k !== "" && Object.hasOwn(CAP_COLOURS, k);
const capFor = (myCaps, med) => {
  const mine = med?.brand && Object.hasOwn(myCaps, med.brand) ? myCaps[med.brand] : "";
  return isCap(mine) ? { cap: mine, usual: false } : { cap: med?.cap, usual: true };
};

function BottleCap({ myCaps, med }) {
  const c = capFor(myCaps, med);
  return isCap(c.cap) ? <CapDot cap={c.cap} usual={c.usual} named /> : null;
}

// What "Read it to me" says: when, which drug, which bottle, how much, where.
function spokenDose({ entry, med, time }, when, myCaps) {
  const c = capFor(myCaps, med);
  const words = capWords(c.cap, c.usual);
  return [
    `${when}, at ${fmtTime(time)}.`,
    `${entry.brand}.`,
    words && (c.usual ? `${words}. Check the name on the bottle.` : `The ${words.toLowerCase()}.`),
    `${entry.drops} drop${entry.drops > 1 ? "s" : ""} in ${entry.eye === "OU" ? "both eyes" : `the ${EYES[entry.eye].long}`}.`,
    formInfo(med?.form).advice,
  ]
    .filter(Boolean)
    .join(" ");
}

// A button that reads the dose aloud with the phone's own voice. It only
// appears when the phone has a voice that works without the internet.
function ReadAloud({ text }) {
  const [ready, setReady] = useState(canSpeak);
  useEffect(() => onVoicesChanged(() => setReady(canSpeak())), []);
  useEffect(() => () => stopSpeaking(), []);
  if (!ready) return null;
  return (
    <button className="btn read-aloud" onClick={() => speak(text)}>
      {Icon.speaker} Read it to me
    </button>
  );
}

// "Cap on my bottle": the patient picks the colour of the bottle they have,
// and changes it when a refill comes with a different cap.
const CAP_CHOICES = Object.entries(CAP_COLOURS).filter(([k]) => k);
function MyCap({ med, value, onChange }) {
  const usual = isCap(med?.cap) ? CAP_COLOURS[med.cap].label.toLowerCase() : "";
  return (
    <div className="my-cap">
      <label>
        <span>Cap on my bottle</span>
        <select className="select" value={isCap(value) ? value : ""} onChange={(ev) => onChange(ev.target.value)}>
          <option value="">{usual ? `Not set (usually ${usual})` : "Not set"}</option>
          {CAP_CHOICES.map(([k, c]) => (
            <option key={k} value={k}>
              {c.label}
            </option>
          ))}
        </select>
      </label>
      {isCap(value) && <CapDot cap={value} usual={false} />}
    </div>
  );
}

function doseLabel({ entry, med }) {
  return [`${entry.drops} drop${entry.drops > 1 ? "s" : ""}, ${EYES[entry.eye].long}.`, formInfo(med?.form).advice].filter(Boolean).join(" ");
}

export default function PatientView({ plan: shared, code }) {
  const id = useMemo(() => patientKey(shared, code), [shared, code]);
  const start = useMemo(() => parseISO(shared.start), [shared.start]);
  const lastDay = courseLastDay(shared.entries);
  const now = useNow();
  // "Today" is the dose day, so doses after midnight stay with their day.
  const today = doseDayIndex(start, now, shared.wake);
  const [view, setView] = useState(null);
  const [lastTap, setLastTap] = useState(0);
  // A new day always opens on today, even if an earlier day was being viewed.
  useEffect(() => setView(null), [today]);
  const day = view ?? Math.max(0, today);
  const [taken, setTaken] = usePersistentState(`edt.taken.${id}`, {}, { check: isObject });
  const [firstSeen] = usePersistentState(`edt.seen.${id}`, toISO(now));
  const [large, setLarge] = usePersistentState("edt.largeText", false);
  // The cap colour of each of the patient's own bottles, by drug, kept on this phone.
  const [myCaps, setMyCaps] = usePersistentState(`edt.caps.${id}`, {}, { check: isObject });
  const [undo, setUndo] = useState(null);
  const [waitFrom, setWaitFrom] = useState(null);

  useEffect(() => {
    document.documentElement.classList.toggle("large-text", large);
  }, [large]);
  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 10000);
    return () => clearTimeout(t);
  }, [undo]);

  const date = addDays(start, day);
  const iso = toISO(date);
  const ticks = taken[iso] || {};
  const finished = lastDay != null && day > lastDay;
  const future = day > today;
  const groups = finished ? [] : doseGroups(shared.entries, shared.formulary, day, shared.wake, shared.bed);
  const all = groups.flatMap((g) => g.items.map((it) => ({ ...it, time: g.time })));
  const done = all.filter((it) => ticks[doseKey(it)]).length;

  // Ticks are written to the day they belong to, which Undo also uses.
  const setTick = (it, on, dayIso = iso) =>
    setTaken((prev) => {
      const dayTicks = { ...(prev[dayIso] || {}) };
      if (on) dayTicks[doseKey(it)] = Date.now();
      else delete dayTicks[doseKey(it)];
      return { ...prev, [dayIso]: dayTicks };
    });
  const toggle = (it) => {
    const on = !ticks[doseKey(it)];
    setTick(it, on);
    setUndo({ it, on, iso });
    if (on && day === today) setWaitFrom(Date.now());
  };

  // The dose to put in front of the patient (see nextDose for the rules).
  const minutes = minutesInto(start, day, now);
  const pick = day === today && !finished ? nextDose(all, (it) => !!ticks[doseKey(it)], minutes) : { item: null, state: "none", missed: new Set() };
  const next = pick.item;
  const isMissed = (it, time) => [...pick.missed].some((m) => m.time === time && doseKey(m) === doseKey(it));
  const waitLeft = waitFrom ? Math.max(0, waitFor(next) - (now - waitFrom)) : 0;
  const nextIsSoon = next && waitLeft > 0 && all.some((it) => ticks[doseKey(it)] && it.time === next.time);
  // A second tap in quick succession is ignored, so a double tap cannot tick two doses.
  const tapNext = () => {
    if (Date.now() - lastTap < 1500) return;
    setLastTap(Date.now());
    toggle(next);
  };

  const upcoming = changeNotes(shared.entries, start, Math.max(1, today + 1), Math.max(1, today + 7), { thisWeek: false });
  const counted = Math.max(0, daysBetween(start, parseISO(firstSeen)));
  let due = 0;
  let got = 0;
  let daysCounted = 0;
  for (let i = Math.max(counted, today - 7); i < Math.min(today, (lastDay ?? today) + 1); i++) {
    daysCounted++;
    const t = taken[toISO(addDays(start, i))] || {};
    for (const g of doseGroups(shared.entries, shared.formulary, i, shared.wake, shared.bed))
      for (const it of g.items) {
        due++;
        if (t[doseKey(it)]) got++;
      }
  }

  const heading = day === today ? "Today" : day === today + 1 ? "Tomorrow" : day === today - 1 ? "Yesterday" : WEEKDAYS[date.getDay()];

  return (
    <div className="pt">
      <div className="pt-head">
        <div>
          <h1>
            {heading}, {fmtShort(date)}
          </h1>
          <p className="mono" aria-live="polite">
            {all.length ? `${done} of ${all.length} done` : finished ? "Course finished" : "No drops this day"}
          </p>
        </div>
        <button className="btn text-size" onClick={() => setLarge(!large)} aria-pressed={large}>
          <span aria-hidden="true" className="aa">
            Aa
          </span>
          Larger text
        </button>
      </div>

      {today < 0 && view == null && (
        <p className="pt-note">
          Your drops start on {fmtLong(start)}. There is nothing to take until then.
        </p>
      )}
      {finished && (
        <p className="pt-note">
          This course of drops ended on {dayName(addDays(start, lastDay))}. Follow your clinic&apos;s advice about what comes next.
        </p>
      )}

      {next && (
        <section className="next" aria-labelledby="next-h">
          <h2 id="next-h">
            {nextIsSoon ? "Wait, then" : pick.state === "due" ? "Due now" : "Next"} · <span className="mono">{fmtTime(next.time)}</span>
          </h2>
          <div className="next-name">{next.entry.brand}</div>
          <div>{doseLabel(next)}</div>
          <BottleCap myCaps={myCaps} med={next.med} />
          {nextIsSoon ? (
            <p className="next-wait" role="timer">
              Wait <span className="mono">{Math.max(1, Math.round(waitLeft / 60000))} min</span> so the last drop can soak in.
            </p>
          ) : null}
          {pick.state !== "later" && (
            <button className="btn next-btn" onClick={tapNext} aria-label={`I have put in ${next.entry.brand}, ${EYES[next.entry.eye].long}`}>
              I have put it in
            </button>
          )}
          <ReadAloud text={spokenDose(next, nextIsSoon ? "Wait, then" : pick.state === "due" ? "Due now" : "Next", myCaps)} />
        </section>
      )}

      <section className="pt-day" aria-labelledby="day-h">
        <div className="daybar">
          <button className="btn icon" disabled={day <= 0} onClick={() => setView(day - 1)} aria-label="Previous day">
            ‹
          </button>
          <h2 id="day-h">{dayName(date)}</h2>
          <button className="btn icon" onClick={() => setView(day + 1)} aria-label="Next day" disabled={finished}>
            ›
          </button>
        </div>
        {day !== Math.max(0, today) && (
          <button className="link-btn back-today" onClick={() => setView(null)}>
            Back to today
          </button>
        )}
        {future && all.length > 0 && <p className="pt-note small">You can tick these off on the day.</p>}
        {groups.map(({ time, items }) => (
          <div key={time} className="time-group" role="group" aria-label={fmtTime(time)}>
            <h3 className="time-h mono">
              {fmtTime(time)}
              {items.length > 1 && <span> · 5 minutes apart, in this order</span>}
            </h3>
            {items.map((it) => {
              const isDone = !!ticks[doseKey(it)];
              const missed = !isDone && isMissed(it, time);
              const label = `${it.entry.brand} at ${fmtTime(time)}, ${dayName(date)}, ${EYES[it.entry.eye].long}. ${isDone ? "Done" : missed ? "Missed" : "Not done yet"}`;
              return (
                <div key={doseKey(it)} className={`dose-row ${isDone ? "is-done" : ""} ${next && next.time === time && doseKey(next) === doseKey(it) ? "is-next" : ""}`}>
                  <div className="dose-text">
                    <span className="n">{it.entry.brand}</span>
                    <span className="d">
                      {doseLabel(it)} <BottleCap myCaps={myCaps} med={it.med} />
                    </span>
                    {missed && <span className="missed">Missed. Do not double up: take the next dose at its time.</span>}
                  </div>
                  <button className="tick" aria-pressed={isDone} aria-label={label} disabled={future} onClick={() => toggle({ ...it, time })}>
                    {isDone && Icon.check}
                  </button>
                </div>
              );
            })}
          </div>
        ))}
      </section>

      {undo && (
        <div className="toast" role="status">
          <span>
            {undo.it.entry.brand} marked {undo.on ? "done" : "not done"}.
          </span>
          <button
            className="link-btn"
            onClick={() => {
              setTick(undo.it, !undo.on, undo.iso);
              setUndo(null);
              setWaitFrom(null);
            }}
          >
            Undo
          </button>
        </div>
      )}

      {upcoming.length > 0 && (
        <section className="pt-card" aria-labelledby="up-h">
          <h2 id="up-h">Coming up</h2>
          <ul>
            {upcoming.map((n) => (
              <li key={n}>{n}</li>
            ))}
          </ul>
        </section>
      )}

      {due > 0 && (
        <p className="pt-note small">
          Last {daysCounted === 1 ? "day" : `${daysCounted} days`}: {got} of {due} drops ticked off.
        </p>
      )}

      <Reminders plan={shared} id={id} code={code} />
      {!isNative && <InstallTip />}
      <KeepPlan code={code} />

      <section className="pt-card" aria-labelledby="mine-h">
        <h2 id="mine-h">My drops</h2>
        {shared.entries.map((e, i) => {
          const med = medOf(shared.formulary, e);
          return (
            <div key={i} className="drug">
              <div className="drug-name">
                <b>{e.brand}</b> <span>{med?.generic}</span>
              </div>
              <div>{patientInstruction(e, med?.qhs, start)}</div>
              <MyCap med={med} value={Object.hasOwn(myCaps, e.brand) ? myCaps[e.brand] : ""} onChange={(v) => setMyCaps((prev) => ({ ...prev, [e.brand]: v }))} />
            </div>
          );
        })}
        <p className="small">
          Your pharmacy may give you a generic bottle with a different cap colour, and it can change between refills. Always check the
          drug name on the label, and set the cap colour here when your bottle changes.
        </p>
        <p className="small">Follow your eye doctor if their instructions differ from this plan. Your check marks stay on this phone.</p>
        <p className="small urgent">
          If your eye becomes very painful or red, or your vision suddenly gets worse, contact your eye clinic right away or go to
          the nearest emergency department.
        </p>
      </section>
    </div>
  );
}
