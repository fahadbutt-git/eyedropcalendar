import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";
import { fmtShort, parseISO } from "../../lib/dates.js";
import { scheduleSpan } from "../../lib/calendar.js";
import { encodeRegimen, patientLink } from "../../lib/share.js";
import { Field, Icon, chipStyle } from "../ui.jsx";
import { buildPages } from "./layout.js";
import Legend from "./Legend.jsx";
import CalendarGrid from "./CalendarGrid.jsx";
import Checklist from "./Checklist.jsx";
import Instructions from "./Instructions.jsx";

function useQrCode(text, enabled) {
  const [src, setSrc] = useState("");
  useEffect(() => {
    let live = true;
    if (!enabled || !text) return setSrc("");
    QRCode.toDataURL(text, { margin: 0, width: 320, errorCorrectionLevel: "L" })
      .then((url) => live && setSrc(url))
      .catch(() => live && setSrc(""));
    return () => {
      live = false;
    };
  }, [text, enabled]);
  return src;
}

function Settings({ s, setSettings, span, pageLabel, link, print, go }) {
  const [copied, setCopied] = useState(false);
  const set = (key) => (e) => setSettings({ ...s, [key]: e.target.type === "checkbox" ? e.target.checked : e.target.value });
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copy this link", link);
    }
  };
  return (
    <aside className="card no-print sched-aside">
      <div className="card-h">
        <h2>Calendar</h2>
      </div>
      <div className="card-b stack" style={{ gap: 16 }}>
        <Field label="Start date">
          <input className="input" type="date" value={s.start} onChange={set("start")} />
        </Field>
        {span.hasOngoing && (
          <Field label="Cover ongoing drops for">
            <select className="select" value={s.months} onChange={set("months")}>
              {[1, 2, 3].map((m) => (
                <option key={m} value={m}>
                  {m} month{m > 1 ? "s" : ""}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field label="Layout">
          <div className="seg full" role="radiogroup" aria-label="Layout">
            {[
              ["calendar", "Calendar"],
              ["table", "Checklist"],
            ].map(([k, label]) => (
              <button key={k} role="radio" aria-checked={s.view === k} className={s.view === k ? "on" : ""} onClick={() => setSettings({ ...s, view: k })}>
                {label}
              </button>
            ))}
          </div>
        </Field>
        <label className="check">
          <input type="checkbox" checked={s.large} onChange={set("large")} />
          <span>
            <b>Large print</b>
            <span className="muted"> for low vision</span>
          </span>
        </label>
        <label className="check">
          <input type="checkbox" checked={s.qr} onChange={set("qr")} />
          <span>
            <b>QR code</b>
            <span className="muted"> so the patient can get phone reminders</span>
          </span>
        </label>
        <details className="more">
          <summary>Dose times</summary>
          <div className="grid-2" style={{ marginTop: 10 }}>
            <Field label="First dose">
              <input className="input" type="time" value={s.wake} onChange={set("wake")} />
            </Field>
            <Field label="Bedtime">
              <input className="input" type="time" value={s.bed} onChange={set("bed")} />
            </Field>
          </div>
          <p className="small muted" style={{ marginTop: 8 }}>
            Doses are spread over the day from the first dose. Bedtime drops use the bedtime.
          </p>
        </details>
        <button className="btn primary lg" onClick={print}>
          {Icon.print} Print {pageLabel}
        </button>
        <p className="small muted">
          {fmtShort(parseISO(s.start))} to {fmtShort(span.end)}, {span.days} days.
        </p>
        <hr className="rule" />
        <div className="stack" style={{ gap: 8 }}>
          <div className="small" style={{ fontWeight: 700 }}>
            Patient phone link
          </div>
          <p className="small muted">Holds the drops and dates only, never the patient&apos;s name or health details.</p>
          <div className="row">
            <button className="btn sm" onClick={copy}>
              {copied ? "Copied" : "Copy link"}
            </button>
            <a className="btn sm" href={link} target="_blank" rel="noopener noreferrer">
              Preview on phone
            </a>
          </div>
        </div>
        <button className="btn ghost sm" onClick={() => go("rx")}>
          Next: prescription →
        </button>
      </div>
    </aside>
  );
}

export default function SchedulePage({ entries, formulary, patient, settings: s, setSettings, go }) {
  const start = parseISO(s.start);
  const span = scheduleSpan(entries, Number(s.months), start);
  const size = s.large ? "large" : "standard";
  const items = entries.map((entry, index) => {
    const med = formulary.find((m) => m.brand === entry.brand);
    return { entry, index, med, chip: chipStyle(index, med) };
  });
  const link = useMemo(
    () => (entries.length ? patientLink(encodeRegimen({ entries, formulary, start: s.start, wake: s.wake, bed: s.bed })) : ""),
    [entries, formulary, s.start, s.wake, s.bed]
  );
  const qr = useQrCode(link, s.qr);

  if (!entries.length)
    return (
      <div className="card card-b empty">
        <h2>No drops yet</h2>
        <p className="muted">Add the patient&apos;s drops first.</p>
        <button className="btn primary" onClick={() => go("regimen")}>
          Add drops
        </button>
      </div>
    );

  const { pages, combined } = buildPages({ size, start, span, count: entries.length });
  const pageCount = pages.length + (combined ? 0 : 1);
  const table = s.view === "table";
  const print = () => {
    document.body.classList.add("print-schedule");
    window.print();
    document.body.classList.remove("print-schedule");
  };

  const dob = patient.dob ? parseISO(patient.dob) : null;
  const header = (kicker, title) => (
    <div className="sheet-h">
      <div>
        <div className="kicker">{kicker}</div>
        <h2>{title}</h2>
      </div>
      <div className="who">
        {patient.name && <div className="who-name">{patient.name}</div>}
        {dob && (
          <div>
            Born {fmtShort(dob)}, {dob.getFullYear()}
          </div>
        )}
        <div>
          From {fmtShort(start)}, {start.getFullYear()}
        </div>
      </div>
    </div>
  );
  const legend = <Legend items={items} start={start} wake={s.wake} bed={s.bed} />;
  const instructions = <Instructions items={items} wake={s.wake} bed={s.bed} qr={s.qr ? qr : ""} />;

  return (
    <div className="sched-layout">
      <Settings
        s={s}
        setSettings={setSettings}
        span={span}
        pageLabel={table ? "checklist" : pageCount > 1 ? `${pageCount} pages` : "calendar"}
        link={link}
        print={print}
        go={go}
      />
      <div className={`sched-print ${size}`}>
        {table ? (
          <section className="sheet flow">
            {header("Eye drop checklist", `${fmtShort(start)} to ${fmtShort(span.end)}, ${span.end.getFullYear()}`)}
            {legend}
            <Checklist items={items} start={start} days={span.days} />
            {instructions}
          </section>
        ) : (
          <>
            {!combined && (
              <section className="sheet flow">
                {header("Eye drop plan", "Your drops and how to use them")}
                {legend}
                {instructions}
              </section>
            )}
            {pages.map((p, i) => {
              const first = combined && i === 0;
              const n = i + 1 + (combined ? 0 : 1);
              return (
                <section className="sheet" key={p.title}>
                  {header(pageCount > 1 ? `Eye drop calendar, page ${n} of ${pageCount}` : "Eye drop calendar", p.title)}
                  {first ? legend : <Legend compact items={items} />}
                  <CalendarGrid weeks={p.weeks} items={items} start={start} lastIndex={span.days - 1} month={p.month} rowHeight={p.rowHeight} />
                  {first && instructions}
                </section>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
