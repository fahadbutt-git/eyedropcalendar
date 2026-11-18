import { fmtLong, isValidISO, parseISO } from "../../lib/dates.js";

// Who the calendar or prescription is for, so a plan is never printed under
// the wrong name.
export default function PatientBar({ patient, go }) {
  const dob = isValidISO(patient.dob) ? fmtLong(parseISO(patient.dob)) : "";
  const name = patient.name.trim();
  return (
    <p className={`patient-bar no-print ${name ? "" : "missing"}`}>
      {name ? (
        <>
          <span className="field-label">Patient</span> <b>{name}</b>
          {dob && <span className="mono">Born {dob}</span>}
        </>
      ) : (
        <b>No patient name entered</b>
      )}
      <button className="link-btn" onClick={() => go("regimen")}>
        {name ? "Change" : "Add the patient"}
      </button>
    </p>
  );
}
