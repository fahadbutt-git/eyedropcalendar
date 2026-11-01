import { useEffect, useMemo, useState } from "react";
import { APP_NAME, CONTACT_EMAIL, COPYRIGHT_YEAR, OWNERS } from "./config.js";
import { SEED_FORMULARY } from "./data/formulary.js";
import { mergeEyes, newSlot, toISO } from "./lib/regimen.js";
import { usePersistentState } from "./lib/storage.js";
import { decodeRegimen } from "./lib/share.js";
import RegimenPage from "./components/RegimenPage.jsx";
import SchedulePage from "./components/SchedulePage.jsx";
import RxPage from "./components/RxPage.jsx";
import FormularyPage from "./components/FormularyPage.jsx";
import PatientView from "./components/PatientView.jsx";
import { Icon } from "./components/ui.jsx";

const TABS = [
  ["regimen", "Patient and drops"],
  ["schedule", "Schedule"],
  ["rx", "Prescription"],
  ["formulary", "Formulary"],
];

const slots = (n = 4) => Array.from({ length: n }, newSlot);
const blankPatient = { name: "", dob: "", hcn: "", address: "" };
const blankPrescriber = { name: "", license: "", clinic: "", street: "", city: "", phone: "", fax: "" };

function Footer() {
  return (
    <footer className="site-foot no-print">
      <div className="site-foot-inner">
        <p>
          © {COPYRIGHT_YEAR} {OWNERS}. Open-source project.
          {CONTACT_EMAIL ? (
            <>
              {" "}For partnerships or feedback, contact <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
            </>
          ) : null}
        </p>
        <p>
          A clinical aid for preparing patient drop schedules. It does not replace clinical judgement. Verify every
          prescription before signing. Patient information never leaves this browser.
        </p>
      </div>
    </footer>
  );
}

function Brand({ sub }) {
  return (
    <a className="brand" href={import.meta.env.BASE_URL}>
      <span className="brand-mark">{Icon.eye}</span>
      <span>
        <div className="brand-name">{APP_NAME}</div>
        <div className="brand-sub">{sub}</div>
      </span>
    </a>
  );
}

function readPatientPlan() {
  const m = window.location.hash.match(/^#\/p\/([\w-]+)/);
  let code = m?.[1];
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  if (!code && standalone) {
    try {
      code = localStorage.getItem("edt.patientPlan");
    } catch {
      /* ignore */
    }
  }
  if (!code) return null;
  try {
    return { code, plan: decodeRegimen(code) };
  } catch {
    return { code, error: true };
  }
}

export default function App() {
  const [patientPlan, setPatientPlan] = useState(readPatientPlan);
  useEffect(() => {
    const h = () => setPatientPlan(readPatientPlan());
    window.addEventListener("hashchange", h);
    return () => window.removeEventListener("hashchange", h);
  }, []);

  if (patientPlan) {
    return (
      <>
        <header className="topbar no-print">
          <div className="topbar-inner">
            <Brand sub="Your drop plan" />
          </div>
        </header>
        <main id="main">
          {patientPlan.error ? (
            <div className="card card-b">This link could not be opened. Ask your clinic for a new one.</div>
          ) : (
            <PatientView plan={patientPlan.plan} code={patientPlan.code} />
          )}
        </main>
        <Footer />
      </>
    );
  }
  return <ClinicianApp />;
}

function ClinicianApp() {
  const [tab, setTab] = usePersistentState("edt.tab", "regimen", "session");
  const [formulary, setFormulary] = usePersistentState("edt.formulary.v2", SEED_FORMULARY);
  const [prescriber, setPrescriber] = usePersistentState("edt.prescriber.v1", blankPrescriber);
  const [patient, setPatient] = usePersistentState("edt.patient", blankPatient, "session");
  const [right, setRight] = usePersistentState("edt.right", () => slots(), "session");
  const [left, setLeft] = usePersistentState("edt.left", () => slots(), "session");
  const today = toISO(new Date());
  const [settings, setSettings] = usePersistentState(
    "edt.schedule",
    { start: today, wake: "08:00", bed: "22:00", months: 1, view: "weeks", qr: true, large: false },
    "session"
  );
  const [rx, setRx] = usePersistentState("edt.rx", { date: today, notes: "", items: {} }, "session");

  const entries = useMemo(() => mergeEyes(right, left), [right, left]);

  const go = (t) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const reset = () => {
    if (!confirm("Clear this patient and their drops?")) return;
    setPatient(blankPatient);
    setRight(slots());
    setLeft(slots());
    setRx({ date: today, notes: "", items: {} });
    setSettings({ ...settings, start: today });
    go("regimen");
  };

  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <header className="topbar no-print">
        <div className="topbar-inner">
          <Brand sub="Drop schedules, prescriptions and reminders" />
          <nav className="tabs" aria-label="Sections">
            {TABS.map(([k, label]) => (
              <button key={k} className={`tab ${tab === k ? "active" : ""}`} aria-current={tab === k ? "page" : undefined} onClick={() => go(k)}>
                {label}
              </button>
            ))}
          </nav>
        </div>
      </header>
      <main id="main">
        {tab === "regimen" && (
          <RegimenPage
            patient={patient}
            setPatient={setPatient}
            right={right}
            setRight={setRight}
            left={left}
            setLeft={setLeft}
            formulary={formulary}
            go={go}
            reset={reset}
          />
        )}
        {tab === "schedule" && (
          <SchedulePage
            entries={entries}
            formulary={formulary}
            patient={patient}
            settings={settings}
            setSettings={setSettings}
            go={go}
          />
        )}
        {tab === "rx" && (
          <RxPage
            entries={entries}
            formulary={formulary}
            patient={patient}
            prescriber={prescriber}
            setPrescriber={setPrescriber}
            rx={rx}
            setRx={setRx}
            go={go}
          />
        )}
        {tab === "formulary" && <FormularyPage formulary={formulary} setFormulary={setFormulary} />}
      </main>
      <Footer />
    </>
  );
}
