import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { DAY_INDEX_NAMES, MONTHS, scheduleSpan } from "../lib/calendar.js";
import {
  addDays,
  daysBetween,
  dosesOnDay,
  doseTimes,
  fmtTime,
  freqWords,
  parseISO,
} from "../lib/regimen.js";
import { buildICS, downloadFile } from "../lib/ics.js";
import { encodeRegimen, patientLink } from "../lib/share.js";
import { CapDot, Chip, Field, Icon, chipStyle } from "./ui.jsx";

// Patient-facing wording: no Latin abbreviations on anything the patient reads.
const EYE_WORD = { OD: "Right", OS: "Left", OU: "Both" };
const EYE_PHRASE = { OD: "right eye", OS: "left eye", OU: "both eyes" };
const shortMonth = (d) => MONTHS[d.getMonth()].slice(0, 3);
const fmtDay = (d) => `${shortMonth(d)} ${d.getDate()}`;

function planWords(e, qhs) {
  if (e.mode === "taper" && e.steps.length)
    return (
      e.steps.map((s) => `${freqWords(s.freq).replace(" daily", " a day").replace("once a day", "once a day")} for ${s.days} days`).join(", then ") +
      ", then stop"
    );
  const base = qhs && e.freq === 1 ? "once a day at bedtime" : freqWords(e.freq).replace(" daily", " a day");
  return e.mode === "duration" ? `${base} for ${e.durationDays} days, then stop` : base;
}

// ── Page building ───────────────────────────────────────────────────────────
function monthWeeks(year, month) {
  const first = new Date(year, month, 1);
  const cells = [];
  for (let i = 0; i < first.getDay(); i++) cells.push(null);
  const n = new Date(year, month + 1, 0).getDate();
  for (let d = 1; d <= n; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

function rollingWeeks(start, end) {
  const first = addDays(start, -start.getDay());
  const weeks = [];
  for (let d = first; d <= end; d = addDays(d, 7)) weeks.push(Array.from({ length: 7 }, (_, i) => addDays(d, i)));
  return weeks;
}

// Print budget in CSS pixels for a letter landscape page (0.35 in margins).
// Calendar pages carry a one-line legend. The full legend and instructions sit
// on page 1 when they fit, otherwise on a cover page in front of the calendars.
const PAGE = 745;
const SIZES = {
  standard: { header: 78, thead: 32, compactRow: 24, fullRow: 60, cols: 3, dnum: 28, dose: 19, footer: 195, maxWeeks: 5 },
  large: { header: 92, thead: 42, compactRow: 34, fullRow: 84, cols: 2, dnum: 42, dose: 31, footer: 390, maxWeeks: 2 },
};

function buildPages({ view, size, start, span, n }) {
  const z = SIZES[size];
  const base = PAGE - z.header - z.thead - 16;
  const compactAvail = base - Math.ceil(n / z.cols) * z.compactRow;
  const fullAvail = base - Math.ceil(n / z.cols) * z.fullRow - z.footer;
  const need = z.dnum + n * z.dose;
  const fitWeeks = Math.max(1, Math.floor(compactAvail / need));

  let pages;
  let monthFallback = false;
  if (view === "month") {
    const months = span.months.map(({ year, month }) => ({
      title: `${MONTHS[month]} ${year}`,
      weeks: monthWeeks(year, month),
      month,
    }));
    if (size === "standard" && months.every((m) => m.weeks.length <= fitWeeks)) pages = months;
    else monthFallback = true;
  }
  if (!pages) {
    const all = rollingWeeks(start, span.end);
    const cap = Math.min(z.maxWeeks, fitWeeks);
    const count = Math.ceil(all.length / cap);
    const per = Math.ceil(all.length / count);
    pages = [];
    for (let i = 0; i < all.length; i += per) {
      const wk = all.slice(i, i + per);
      const a = wk[0][0];
      const b = wk[wk.length - 1][6];
      pages.push({ title: `${fmtDay(a)} to ${fmtDay(b)}, ${b.getFullYear()}`, weeks: wk, month: null });
    }
  }
  const singleFirst = pages[0].weeks.length * need <= fullAvail;
  pages.forEach((pg, i) => {
    const avail = singleFirst && i === 0 ? fullAvail : compactAvail;
    pg.rowH = Math.max(need, Math.floor(avail / pg.weeks.length) - 2);
  });
  return { pages, singleFirst, monthFallback };
}

// ── Pieces ──────────────────────────────────────────────────────────────────
function Legend({ entries, formulary, wake, bed, compact }) {
  if (compact)
    return (
      <div className="legend compact">
        {entries.map((e, i) => {
          const med = formulary.find((m) => m.brand === e.brand);
          return (
            <div className="legend-item" key={i}>
              <Chip n={i + 1} style={chipStyle(e, i, med)} />
              <div>
                <b>{e.brand}</b> <span className="legend-eye">{EYE_PHRASE[e.eye]}</span>
              </div>
            </div>
          );
        })}
      </div>
    );
  return (
    <div className="legend">
      {entries.map((e, i) => {
        const med = formulary.find((m) => m.brand === e.brand);
        const times =
          e.mode !== "taper" ? doseTimes(e.freq, wake, bed, med?.qhs).map(fmtTime).join(", ") : "";
        return (
          <div className="legend-item" key={i}>
            <Chip n={i + 1} style={chipStyle(e, i, med)} />
            <div>
              <div>
                <b>{e.brand}</b> <span className="legend-eye">{EYE_PHRASE[e.eye]}</span>
              </div>
              <div className="legend-plan">
                {e.drops} drop{e.drops > 1 ? "s" : ""} {planWords(e, med?.qhs)}
                {e.startDay > 1 ? `, starting day ${e.startDay}` : ""}
                {times && <span className="muted"> ({times})</span>}
              </div>
              <div className="legend-sub">
                {med?.cap && (
                  <span className="row" style={{ display: "inline-flex", gap: 4 }}>
                    <CapDot cap={med.cap} /> cap ·{" "}
                  </span>
                )}
                {med?.generic}
                {med?.form === "suspension" ? " · shake well" : ""}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Calendar({ weeks, entries, formulary, start, endIndex, month, rowH }) {
  return (
    <div className="cal-wrap" style={{ "--row-h": `${rowH}px` }}>
      <table className="cal">
        <thead>
          <tr>
            {DAY_INDEX_NAMES.map((d) => (
              <th key={d} scope="col">
                {d}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((w, wi) => (
            <tr key={wi}>
              {w.map((date, di) => {
                if (!date || (month != null && date.getMonth() !== month)) return <td key={di} className="out" />;
                const idx = daysBetween(start, date);
                const inRange = idx >= 0 && idx <= endIndex;
                const label = date.getDate() === 1 || (wi === 0 && di === 0) ? fmtDay(date) : date.getDate();
                const doses = inRange
                  ? entries
                      .map((e, i) => ({ e, i, n: dosesOnDay(e, idx), prev: idx > 0 ? dosesOnDay(e, idx - 1) : 0 }))
                      .filter((x) => x.n > 0 || x.prev > 0)
                  : [];
                return (
                  <td key={di} className={inRange ? "" : "inactive"}>
                    <div className="dnum">
                      <span>{label}</span>
                      {idx === 0 && <span className="flag">Start</span>}
                    </div>
                    {doses.map(({ e, i, n, prev }) => {
                      const med = formulary.find((m) => m.brand === e.brand);
                      if (n === 0)
                        return (
                          <div className="dose stop" key={i}>
                            <Chip n={i + 1} style={chipStyle(e, i, med)} /> Stop
                          </div>
                        );
                      const changed = idx > 0 && prev > 0 && prev !== n;
                      const started = prev === 0 && idx > 0;
                      return (
                        <div className="dose" key={i}>
                          <Chip n={i + 1} style={chipStyle(e, i, med)} />
                          <span className="eye">{EYE_WORD[e.eye]}</span>
                          <span className="boxes" aria-label={`${n} doses`}>
                            {Array.from({ length: n }, (_, k) => (
                              <i key={k} />
                            ))}
                          </span>
                          {(changed || started) && <span className="change">{started ? "Start" : `now ${n}x`}</span>}
                        </div>
                      );
                    })}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function ChecklistTable({ entries, formulary, start, days }) {
  return (
    <table className="tbl-sched">
      <thead>
        <tr>
          <th scope="col">Date</th>
          {entries.map((e, i) => {
            const med = formulary.find((m) => m.brand === e.brand);
            return (
              <th key={i} scope="col">
                <span className="row" style={{ justifyContent: "center", gap: 6 }}>
                  <Chip n={i + 1} style={chipStyle(e, i, med)} /> {e.brand}, {EYE_WORD[e.eye].toLowerCase()}
                </span>
              </th>
            );
          })}
          <th scope="col">Notes</th>
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: days }, (_, idx) => {
          const date = addDays(start, idx);
          return (
            <tr key={idx}>
              <th scope="row">
                {DAY_INDEX_NAMES[date.getDay()]} {fmtDay(date)}
              </th>
              {entries.map((e, i) => {
                const n = dosesOnDay(e, idx);
                return (
                  <td key={i}>
                    {n ? (
                      <span className="boxes">
                        {Array.from({ length: n }, (_, k) => (
                          <i key={k} />
                        ))}
                      </span>
                    ) : (
                      <span className="muted">none</span>
                    )}
                  </td>
                );
              })}
              <td />
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Instructions({ entries, formulary, wake, bed, qr }) {
  const med = (e) => formulary.find((m) => m.brand === e.brand);
  const isQhs = (e) => e.mode !== "taper" && e.freq === 1 && !!med(e)?.qhs;
  const freqs = new Set();
  entries.forEach((e) => {
    if (e.mode === "taper") e.steps.forEach((s) => freqs.add(s.freq));
    else if (!isQhs(e)) freqs.add(e.freq);
  });
  const qhsNames = entries.filter(isQhs).map((e) => e.brand);
  const anySusp = entries.some((e) => med(e)?.form === "suspension");
  const anyGel = entries.some((e) => med(e)?.form === "gel");
  return (
    <div className="sheet-foot">
      <div>
        <h3>How to use your drops</h3>
        <ol>
          <li>Wash your hands. Tilt your head back and gently pull down your lower eyelid.</li>
          <li>Squeeze one drop into the pocket. Do not let the bottle touch your eye.</li>
          <li>Close your eye and press gently on the inner corner for 1 minute.</li>
          {entries.length > 1 && <li>Wait at least 5 minutes between different drops.</li>}
          {anySusp && <li>Shake bottles marked "shake well" before each use.</li>}
          {anyGel && <li>Use gel drops last, at least 10 minutes after other drops.</li>}
          <li>Tick a box each time you use a drop. Bring this sheet to your next visit.</li>
        </ol>
      </div>
      <div>
        <h3>Suggested times</h3>
        <ul>
          {[...freqs]
            .sort((a, b) => a - b)
            .map((f) => (
              <li key={f}>
                {f === 1 ? "Once" : `${f} times`} a day: {doseTimes(f, wake, bed).map(fmtTime).join(", ")}
              </li>
            ))}
          {qhsNames.length > 0 && (
            <li>
              At bedtime, {fmtTime(doseTimes(1, wake, bed, true)[0])}: {qhsNames.join(", ")}
            </li>
          )}
        </ul>
      </div>
      {qr && (
        <div className="qr-box">
          <img src={qr} alt="QR code that opens this drop plan on a phone" />
          <div>
            <b>Reminders on your phone</b>
            <div>Scan with your phone camera to see today&apos;s drops and set alarms.</div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function SchedulePage({ entries, formulary, patient, settings, setSettings, go }) {
  const s = settings;
  const set = (k) => (e) =>
    setSettings({ ...s, [k]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const start = parseISO(s.start);
  const span = scheduleSpan(entries, Number(s.months), start);
  const size = s.large ? "large" : "standard";
  const view = s.view === "table" ? "table" : s.view === "month" ? "month" : "weeks";
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  const link = useMemo(
    () =>
      entries.length
        ? patientLink(encodeRegimen({ entries, formulary, start: s.start, wake: s.wake, bed: s.bed }))
        : "",
    [entries, formulary, s.start, s.wake, s.bed]
  );

  useEffect(() => {
    let live = true;
    if (!link || !s.qr) {
      setQr("");
      return;
    }
    QRCode.toDataURL(link, { margin: 0, width: 320, errorCorrectionLevel: "L" })
      .then((u) => live && setQr(u))
      .catch(() => live && setQr(""));
    return () => {
      live = false;
    };
  }, [link, s.qr]);

  if (!entries.length)
    return (
      <div className="card card-b empty">
        <h2>No drops selected</h2>
        <p className="muted">Choose medications first, then come back to build the calendar.</p>
        <button className="btn primary" onClick={() => go("regimen")}>
          Select drops
        </button>
      </div>
    );

  const { pages, singleFirst, monthFallback } = buildPages({ view, size, start, span, n: entries.length });
  const pageCount = pages.length + (singleFirst ? 0 : 1);

  const print = () => {
    document.body.classList.add("print-schedule");
    window.print();
    document.body.classList.remove("print-schedule");
  };
  const ics = () =>
    downloadFile(
      "eye-drop-reminders.ics",
      buildICS({ entries, formulary, start, days: span.days, wake: s.wake, bed: s.bed }),
      "text/calendar"
    );
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", link);
    }
  };

  const head = (kicker, title) => (
    <div className="sheet-h">
      <div>
        <div className="kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <div className="who">
        {patient.name && <div className="who-name">{patient.name}</div>}
        {patient.dob && <div>Born {fmtDay(parseISO(patient.dob))}, {parseISO(patient.dob).getFullYear()}</div>}
        <div>Started {fmtDay(start)}, {start.getFullYear()}</div>
      </div>
    </div>
  );
  const legend = <Legend entries={entries} formulary={formulary} wake={s.wake} bed={s.bed} />;
  const legendCompact = <Legend compact entries={entries} formulary={formulary} />;
  const instructions = (
    <Instructions entries={entries} formulary={formulary} wake={s.wake} bed={s.bed} qr={s.qr ? qr : ""} />
  );

  return (
    <div className="sched-layout">
      <aside className="card no-print">
        <div className="card-h">
          <h2>Schedule settings</h2>
        </div>
        <div className="card-b stack" style={{ gap: 14 }}>
          <Field label="Start date">
            <input className="input" type="date" value={s.start} onChange={set("start")} />
          </Field>
          <div className="grid-2">
            <Field label="First dose">
              <input className="input" type="time" value={s.wake} onChange={set("wake")} />
            </Field>
            <Field label="Bedtime">
              <input className="input" type="time" value={s.bed} onChange={set("bed")} />
            </Field>
          </div>
          {span.hasOngoing && (
            <Field label="Length for ongoing drops">
              <select className="select" value={s.months} onChange={set("months")}>
                {[1, 2, 3, 6].map((m) => (
                  <option key={m} value={m}>
                    {m} month{m > 1 ? "s" : ""}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <Field label="Layout">
            <div className="seg" role="group" aria-label="Layout">
              {[
                ["weeks", "Calendar"],
                ["month", "By month"],
                ["table", "Checklist"],
              ].map(([k, l]) => (
                <button key={k} className={view === k ? "on" : ""} aria-pressed={view === k} onClick={() => setSettings({ ...s, view: k })}>
                  {l}
                </button>
              ))}
            </div>
          </Field>
          {monthFallback && (
            <div className="notice info small">
              {size === "large"
                ? "Large print uses the weekly calendar."
                : "Too many drops to fit a whole month on one page, so the weekly calendar is used."}
            </div>
          )}
          <label className="check">
            <input type="checkbox" checked={!!s.large} onChange={set("large")} />
            <span>
              <b>Large print</b>
              <span className="muted"> for low vision. Bigger text and boxes, 2 weeks per page.</span>
            </span>
          </label>
          <label className="check">
            <input type="checkbox" checked={!!s.qr} onChange={set("qr")} />
            <span>Include QR code for phone reminders</span>
          </label>
          <p className="small muted">
            {span.days} days, {fmtDay(start)} to {fmtDay(span.end)}. Prints {view === "table" ? "as a checklist" : `${pageCount} page${pageCount > 1 ? "s" : ""}`}.
          </p>
          <button className="btn primary" onClick={print}>
            {Icon.print} Print schedule
          </button>
          <hr className="rule" />
          <div>
            <div className="small" style={{ fontWeight: 650, marginBottom: 4 }}>
              Phone reminders
            </div>
            <p className="small muted">
              The QR code and link carry the drop plan only. The patient&apos;s name and health details are never included.
            </p>
          </div>
          <div className="row">
            <button className="btn sm" onClick={copy}>
              {copied ? "Link copied" : "Copy patient link"}
            </button>
            <a className="btn sm" href={link} target="_blank" rel="noreferrer">
              Preview phone view
            </a>
          </div>
          <button className="btn sm" onClick={ics}>
            {Icon.bell} Download calendar alarms
          </button>
        </div>
      </aside>

      <div className={`sched-print ${size === "large" ? "large" : ""}`}>
        {view === "table" ? (
          <section className="sheet flow">
            {head("Eye drop checklist", `${fmtDay(start)} to ${fmtDay(span.end)}, ${span.end.getFullYear()}`)}
            {legend}
            <ChecklistTable entries={entries} formulary={formulary} start={start} days={span.days} />
            {instructions}
          </section>
        ) : (
          <>
            {!singleFirst && (
              <section className="sheet flow">
                {head("Eye drop plan", "Your drops and how to use them")}
                {legend}
                {instructions}
              </section>
            )}
            {pages.map((p, i) => {
              const n = i + 1 + (singleFirst ? 0 : 1);
              const full = singleFirst && i === 0;
              return (
                <section className="sheet" key={p.title}>
                  {head(pageCount > 1 ? `Eye drop calendar, page ${n} of ${pageCount}` : "Eye drop calendar", p.title)}
                  {full ? legend : legendCompact}
                  <Calendar
                    weeks={p.weeks}
                    entries={entries}
                    formulary={formulary}
                    start={start}
                    endIndex={span.days - 1}
                    month={p.month}
                    rowH={p.rowH}
                  />
                  {full && instructions}
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
