import { useEffect, useMemo, useRef, useState } from "react";
import { useSheetMeasure } from "./useSheetMeasure.js";
import { addDays, fmtShort, isValidISO, parseISO } from "../../lib/dates.js";
import { scheduleSpan } from "../../lib/calendar.js";
import { dosesOnDay } from "../../lib/regimen.js";
import { chartNote } from "../../lib/chartNote.js";
import AddToChart from "./AddToChart.jsx";
import { codeFromUrl, encodeRegimen, patientLink } from "../../lib/share.js";
import { isClockTime } from "../../lib/times.js";
import { CopyButton, Field, Icon, capTint, chipStyle, printSheets } from "../ui.jsx";
import Warnings from "../Warnings.jsx";
import { PRINT_SIZES, buildPages, checklistPageCount } from "./layout.js";
import { CAP_COLOURS } from "../../data/formulary.js";

// Checklist rows that fit on a page at each print size.
import Legend from "./Legend.jsx";
import CalendarGrid from "./CalendarGrid.jsx";
import DailyChart, { chartPages } from "./DailyChart.jsx";
import Checklist from "./Checklist.jsx";


export const PAGE_TYPES = [
  ["calendar", "Month calendar", "A tick box for each dose on a calendar page"],
  ["chart", "Daily chart", "One page a week, a row for each time of day"],
  ["checklist", "Checklist", "A plain table, one row per day"],
];

// Medium error correction survives a creased or smudged page. A very long
// plan falls back to low correction, and if it still does not fit the QR is
// left off and the clinician is told to share the link instead.
function useQrCode(text, enabled) {
  const [src, setSrc] = useState("");
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    if (!enabled || !text) {
      setSrc("");
      setFailed(false);
      return;
    }
    import("qrcode")
      .then((QR) =>
        QR.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: "M" }).catch(() =>
          QR.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: "L" })
        )
      )
      .then((url) => live && (setSrc(url), setFailed(false)))
      .catch(() => live && (setSrc(""), setFailed(true)));
    return () => {
      live = false;
    };
  }, [text, enabled]);
  return [src, failed];
}

// Start date and dose times only change when the new value is complete and
// valid, so clearing a field can never break the page.
function Settings({ s, setSettings, span, sheetCount, count, link, note, qr, addToChart, print, go }) {
  const [times, setTimes] = useState({ wake: s.wake, bed: s.bed });
  const [startText, setStartText] = useState(s.start);
  const setStart = (v) => {
    setStartText(v);
    if (isValidISO(v) && Number(v.slice(0, 4)) >= 2000) set({ start: v });
  };
  const set = (patch) => setSettings({ ...s, ...patch });
  const setTime = (key, value) => {
    setTimes({ ...times, [key]: value });
    if (isClockTime(value)) set({ [key]: value });
  };
  const togglePage = (key) => set({ pages: { ...s.pages, [key]: !s.pages[key] } });
  const nothing = !Object.values(s.pages).some(Boolean);

  return (
    <aside className="sched-aside no-print" aria-label="Calendar settings">
      <Field label="Start date">
        <input className="input mono" type="date" value={startText} aria-invalid={startText !== s.start} onChange={(e) => setStart(e.target.value)} />
        {startText !== s.start && <span className="num-error">Incomplete date. Still using {fmtShort(parseISO(s.start))}, {s.start.slice(0, 4)}.</span>}
      </Field>
      {span.hasOngoing && (
        <Field label="Print ongoing drops for">
          <select className="select" value={s.months} onChange={(e) => set({ months: Number(e.target.value) })}>
            {[1, 2, 3].map((m) => (
              <option key={m} value={m}>
                {m} month{m > 1 ? "s" : ""}
              </option>
            ))}
          </select>
        </Field>
      )}
      <fieldset className="choice-list">
        <legend className="field-label">Pages to print</legend>
        {PAGE_TYPES.map(([key, label, hint]) => (
          <label className="check" key={key}>
            <input type="checkbox" checked={!!s.pages[key]} onChange={() => togglePage(key)} />
            <span>
              <b>{label}</b>
              <span className="hint">{hint}</span>
            </span>
          </label>
        ))}
        <p className="hint">Ask the patient which they find easiest. Any mix can be printed.</p>
        {count > 4 && s.pages.calendar && !s.pages.chart && (
          <p className="hint">
            <b>{count} drops</b> make a busy month calendar. The daily chart is easier to read.
          </p>
        )}
      </fieldset>
      <fieldset className="choice-list">
        <legend className="field-label">Print size</legend>
        {Object.entries(PRINT_SIZES).map(([key, p]) => (
          <label className="check" key={key}>
            <input type="radio" name="print-size" checked={s.size === key} onChange={() => set({ size: key })} />
            <span>
              <b>{p.label}</b>
              <span className="hint">{p.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <label className="check">
        <input type="checkbox" checked={s.qr} onChange={(e) => set({ qr: e.target.checked })} />
        <span>
          <b>QR code</b>
          <span className="hint">Opens the plan on the patient&apos;s phone for reminders</span>
        </span>
      </label>
      <details className="more">
        <summary>Dose times</summary>
        <div className="grid-2">
          <Field label="First dose">
            <input className="input mono" type="time" value={times.wake} aria-invalid={!isClockTime(times.wake)} onChange={(e) => setTime("wake", e.target.value)} />
          </Field>
          <Field label="Bedtime">
            <input className="input mono" type="time" value={times.bed} aria-invalid={!isClockTime(times.bed)} onChange={(e) => setTime("bed", e.target.value)} />
          </Field>
        </div>
        <p className="hint">Doses are spread through the day from the first dose. Bedtime drops go at bedtime.</p>
      </details>
      <button className="btn primary lg" onClick={print} disabled={nothing}>
        {Icon.print} Print {sheetCount} page{sheetCount === 1 ? "" : "s"}
      </button>
      <p className="hint mono">
        {fmtShort(parseISO(s.start))} to {fmtShort(span.end)}, {span.end.getFullYear()} · {span.days} days
      </p>
      <div className="link-box">
        <h2 className="field-label">Patient phone reminders</h2>
        {qr && (
          <div className="aside-qr">
            <img src={qr} alt="QR code that opens this drop plan on a phone" />
            <p>The patient can scan this now with their phone camera, or from the printed page.</p>
          </div>
        )}
        <p className="hint">The link holds the drops and dates only, never the patient&apos;s name or health details.</p>
        <div className="row">
          <CopyButton text={link}>Copy link</CopyButton>
          <a className="btn sm" href={link} target="_blank" rel="noopener noreferrer">
            Preview on phone
          </a>
        </div>
        <div className="chart-note">
          <CopyButton text={note}>Copy for chart note</CopyButton>
          <p className="hint">The plan and its link, to paste into the clinic note. Paste the link back in at the next visit to change the plan.</p>
          {addToChart && <AddToChart code={codeFromUrl(link)} patient={addToChart.patient} add={addToChart.add} />}
        </div>
      </div>
      <button className="btn" onClick={() => go("rx")}>
        Next: prescription
      </button>
    </aside>
  );
}

export default function SchedulePage({ entries, formulary, patient, settings: s, setSettings, warnings, go, addToChart }) {
  const start = parseISO(s.start);
  const span = scheduleSpan(entries, s.months, start);
  const size = s.size;
  const items = entries.map((entry, index) => {
    const med = formulary.find((m) => m.brand === entry.brand);
    return { entry, index, med, chip: chipStyle(med), tint: capTint(med), capName: CAP_COLOURS[med?.cap]?.label || "" };
  });
  const link = useMemo(
    () => (entries.length ? patientLink(encodeRegimen({ entries, formulary, start: s.start, wake: s.wake, bed: s.bed, nonce: s.nonce })) : ""),
    [entries, formulary, s.start, s.wake, s.bed, s.nonce]
  );
  const [qr, qrFailed] = useQrCode(link, s.qr);
  const sheetsRef = useRef(null);
  const measured = useSheetMeasure(sheetsRef, size, [entries, formulary, size, s.start, s.wake, s.bed, s.qr, qr, patient.name, patient.dob]);

  if (!entries.length)
    return (
      <div className="empty">
        <h1>No drops yet</h1>
        <p>Add the patient&apos;s drops first.</p>
        <button className="btn primary" onClick={() => go("regimen")}>
          Add drops
        </button>
      </div>
    );

  const peaks = entries.map((e) => Math.max(...Array.from({ length: span.days }, (_, i) => dosesOnDay(e, i))));
  const changes = entries.map((e) => e.mode !== "ongoing" || e.startDay > 1);
  const cal = buildPages({ size, start, span, peaks, changes, qr: s.qr && !!qr, measured });
  const chart = s.pages.chart ? chartPages({ items, entries, formulary, start, days: span.days, wake: s.wake, bed: s.bed, size }) : [];
  // The checklist flows onto more pages when the plan is long.
  const checklistPages = s.pages.checklist ? checklistPageCount({ size, days: span.days, measured }) : 0;
  // The full legend (doses, times, taper steps, shake well) always prints:
  // on calendar page 1 when it fits, otherwise on a page of its own first.
  const legendPage = !(s.pages.calendar && cal.combined) && (s.pages.calendar || chart.length > 0 || s.pages.checklist);
  const sheetCount = (legendPage ? 1 : 0) + (s.pages.calendar ? cal.pages.length : 0) + chart.length + checklistPages;

  const dob = patient.dob && isValidISO(patient.dob) ? parseISO(patient.dob) : null;
  // The first printed page carries the QR code in its top right corner.
  let qrShown = false;
  const header = (kicker, title) => {
    const withQr = s.qr && qr && !qrShown;
    qrShown = qrShown || withQr;
    return (
      <div className="sheet-h">
        <div>
          <div className="kicker">{kicker}</div>
          <h2>{title}</h2>
        </div>
        <div className="sheet-h-right">
          <div className="who">
            {patient.name && <div className="who-name">{patient.name}</div>}
            {dob && (
              <div className="mono">
                Born {fmtShort(dob)}, {dob.getFullYear()}
              </div>
            )}
          </div>
          {withQr && (
            <div className="sheet-qr">
              <img src={qr} alt="QR code that opens this drop plan on a phone" />
              <div>
                <b>Reminders on your phone</b>
                <ol>
                  <li>Open your phone camera</li>
                  <li>Point it at this square</li>
                  <li>Tap the link that appears</li>
                </ol>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };
  const range = `${fmtShort(start)} to ${fmtShort(span.end)}, ${span.end.getFullYear()}`;
  const legend = <Legend items={items} start={start} wake={s.wake} bed={s.bed} />;
  const compact = <Legend compact items={items} />;

  return (
    <div className="sched-layout">
      <h1 className="sr-only">Calendar</h1>
      <Settings
        s={s}
        setSettings={setSettings}
        span={span}
        sheetCount={sheetCount}
        count={entries.length}
        link={link}
        note={chartNote({ entries, formulary, start: s.start, wake: s.wake, bed: s.bed, link })}
        qr={qr}
        addToChart={addToChart}
        print={() => printSheets("schedule")}
        go={go}
      />
      <div className={`sched-print ${size}`} ref={sheetsRef}>
        <div className="no-print">
          <Warnings warnings={warnings} compact />
          {qrFailed && (
            <p className="notice warn small" role="status">
              This plan is too long for a QR code. Use Copy link and send it to the patient instead.
            </p>
          )}
        </div>
        {legendPage && (
          <section className="sheet flow">
            {header("Eye drop plan", "Your drops and when to use them")}
            {legend}
          </section>
        )}
        {s.pages.calendar &&
          cal.pages.map((p, i) => (
            <section className="sheet" key={`cal-${p.title}`}>
              {header(cal.pages.length > 1 ? `Calendar, page ${i + 1} of ${cal.pages.length}` : "Eye drop calendar", p.title)}
              {cal.combined && i === 0 ? legend : compact}
              <CalendarGrid weeks={p.weeks} items={items} start={start} lastIndex={span.days - 1} month={p.month} rowHeight={p.rowHeight} scale={p.scale} perLine={p.perLine} />
            </section>
          ))}
        {chart.map((p) => (
          <section className="sheet" key={`chart-${p.first}-${p.part}`}>
            {header(
              `Daily chart, week ${p.week} of ${Math.ceil(span.days / 7)}${p.part ? ", continued" : ""}`,
              `${fmtShort(addDays(start, p.first))} to ${fmtShort(addDays(start, p.first + 6))}, ${addDays(start, p.first + 6).getFullYear()}`
            )}
            <DailyChart page={p} start={start} lastIndex={span.days - 1} />
            <p className="chart-foot">Tick each box when you use the drop. Wait 5 minutes between drops, in the order shown.</p>
          </section>
        ))}
        {s.pages.checklist && (
          <section className="sheet flow">
            {header("Eye drop checklist", range)}
            {compact}
            <Checklist items={items} start={start} days={span.days} />
          </section>
        )}
      </div>
    </div>
  );
}
