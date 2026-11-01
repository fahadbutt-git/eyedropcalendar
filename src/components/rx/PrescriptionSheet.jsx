import { fmtLong, parseISO } from "../../lib/dates.js";
import { sigText } from "../../lib/wording.js";

// Missing details show as grey placeholders on screen and print blank.
const Missing = ({ children }) => <span className="ph no-print">{children}</span>;

const Line = ({ label, children, wide }) => (
  <div style={wide ? { gridColumn: "1 / -1" } : undefined}>
    <span className="lbl">{label}</span>
    {children || <Missing>Not entered</Missing>}
  </div>
);

// The printable prescription. Optional details appear only when entered.
export default function PrescriptionSheet({ items, prescriber, patient, date, notes, start, signature }) {
  const startDate = start ? parseISO(start) : null;
  return (
    <article className="rx-sheet">
      <header className="rx-head">
        <div className="prescriber">
          <b>{prescriber.name || <Missing>Prescriber name</Missing>}</b>
          <div>{prescriber.license ? `Licence ${prescriber.license}` : <Missing>Licence number</Missing>}</div>
        </div>
        <div className="clinic">
          {prescriber.clinic && <div className="clinic-name">{prescriber.clinic}</div>}
          <div>{prescriber.street || <Missing>Practice address</Missing>}</div>
          {prescriber.city && <div>{prescriber.city}</div>}
          {prescriber.phone && <div>Tel {prescriber.phone}</div>}
          {prescriber.fax && <div>Fax {prescriber.fax}</div>}
        </div>
      </header>

      <div className="rx-pt">
        <Line label="Patient">{patient.name}</Line>
        <Line label="Date">{date && fmtLong(parseISO(date))}</Line>
        <Line label="Date of birth">{patient.dob && fmtLong(parseISO(patient.dob))}</Line>
        {patient.hcn && <Line label="Healthcare number">{patient.hcn}</Line>}
        {patient.address && (
          <Line label="Address" wide>
            {patient.address}
          </Line>
        )}
      </div>

      <div className="rx-symbol">Rx</div>
      {items.map(({ entry, med, disp, refills, lu }) => (
        <div className="rx-item" key={entry.id}>
          <div>
            <span className="name">{entry.brand}</span>
            {med?.generic && <span className="gen"> ({med.generic})</span>}
            <span className="gen"> ophthalmic {med?.form || "solution"}</span>
          </div>
          <div>
            <b>Sig:</b> {sigText(entry, med?.qhs, startDate)}
            {med?.form === "suspension" && " Shake well."}
          </div>
          <div className="meta">
            <span>
              <b>Disp:</b> {disp}
            </span>
            <span>
              <b>Refills:</b> {refills || "none"}
            </span>
            {lu && (
              <span>
                <b>LU code:</b> {lu}
              </span>
            )}
          </div>
        </div>
      ))}
      {notes && <div className="rx-notes">{notes}</div>}

      <footer className="rx-foot">
        <div className="small muted">
          {items.length} item{items.length === 1 ? "" : "s"} prescribed
        </div>
        <div className="sig-block">
          {signature && <img className="sig-img" src={signature} alt="Prescriber signature" />}
          <div className="sig-line">
            {signature ? "Electronically signed" : "Signature"}
            {prescriber.name && ` · ${prescriber.name}`}
          </div>
        </div>
      </footer>
    </article>
  );
}
