import { useEffect, useMemo, useState } from "react";
import { APP_NAME, CONTACT_EMAIL, COPYRIGHT_YEAR, OWNERS, REPO_URL } from "./config.js";
import { FORMULARY_VERSION, SEED_FORMULARY } from "./data/formulary.js";
import { toISO } from "./lib/dates.js";
import { newSlot, toEntries } from "./lib/regimen.js";
import { codeFromUrl, decodeRegimen } from "./lib/share.js";
import { isNative, onPlanLink } from "./lib/native.js";
import { usePersistentState } from "./lib/storage.js";
import { cleanFormulary } from "./lib/validate.js";
import RegimenPage from "./components/drops/RegimenPage.jsx";
import SchedulePage from "./components/schedule/SchedulePage.jsx";
import RxPage from "./components/rx/RxPage.jsx";
import FormularyPage from "./components/formulary/FormularyPage.jsx";
import PatientView from "./components/patient/PatientView.jsx";
import PatientWelcome from "./components/patient/PatientWelcome.jsx";
import { Icon } from "./components/ui.jsx";

const STEPS = [
  ["regimen", "Patient and drops", "Drops"],
  ["schedule", "Calendar", "Calendar"],
  ["rx", "Prescription", "Rx"],
];
const BLANK_PATIENT = { name: "", dob: "", hcn: "", address: "" };
const BLANK_PRESCRIBER = { name: "", license: "", clinic: "", street: "", city: "", phone: "", fax: "" };

function Footer({ patientView }) {
  return (
    <footer className="site-foot no-print">
      <div className="site-foot-inner">
        <p>
          © {COPYRIGHT_YEAR} {OWNERS}.{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Open source
          </a>{" "}
          under the Apache 2.0 licence. Partnerships and feedback: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
        {!patientView && (
          <p>
            A clinical aid, not a substitute for clinical judgement. Check every calendar and prescription before it goes
            to a patient. Patient information never leaves this browser.
          </p>
        )}
      </div>
    </footer>
  );
}

function Header({ subtitle, children }) {
  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <a className="brand" href={isNative ? "#" : import.meta.env.BASE_URL}>
          <span className="brand-mark" aria-hidden="true">
            {Icon.eye}
          </span>
          <span>
            <span className="brand-name">{APP_NAME}</span>
            <span className="brand-sub">{subtitle}</span>
          </span>
        </a>
        {children}
      </div>
    </header>
  );
}

// ── Patient side: opened from the QR code, or the phone app ───────────────
function readPatientRoute() {
  let code = codeFromUrl(window.location.hash);
  const installed = isNative || window.matchMedia?.("(display-mode: standalone)").matches;
  if (!code && installed) {
    try {
      code = localStorage.getItem("edt.patientPlan");
    } catch {
      code = null;
    }
  }
  if (!code) return isNative ? { welcome: true } : null;
  try {
    return { code, plan: decodeRegimen(code) };
  } catch {
    return { invalid: true };
  }
}

function PatientApp({ route }) {
  const open = (code) => (window.location.hash = `#/p/${code}`);
  return (
    <>
      <Header subtitle="Your eye drops" />
      <main id="main">
        {route.welcome && <PatientWelcome onCode={open} />}
        {route.invalid && (
          <div className="card card-b pt">
            <h1>This link did not open</h1>
            <p>The link may be incomplete. Scan the QR code on your calendar again, or ask your clinic for a new one.</p>
          </div>
        )}
        {route.plan && <PatientView key={route.code} plan={route.plan} code={route.code} />}
      </main>
      <Footer patientView />
    </>
  );
}

// ── Clinician side ─────────────────────────────────────────────────────────
// An unedited formulary follows the latest defaults. An edited one is kept,
// and the Formulary page says when newer defaults exist.
function useFormulary() {
  const [store, setStore] = usePersistentState(
    "edt.formulary.v3",
    { version: FORMULARY_VERSION, edited: false, list: SEED_FORMULARY },
    { check: (s) => (s?.edited ? { ...s, list: cleanFormulary(s.list) || SEED_FORMULARY } : s) }
  );
  const list = store.edited ? store.list : SEED_FORMULARY;
  const save = (next) => setStore({ version: store.version, edited: true, list: next });
  const restore = () => setStore({ version: FORMULARY_VERSION, edited: false, list: SEED_FORMULARY });
  return { list, save, restore, outdated: store.edited && store.version < FORMULARY_VERSION };
}

function ClinicianApp() {
  const today = toISO(new Date());
  const session = { kind: "session" };
  const formulary = useFormulary();
  const [tab, setTab] = usePersistentState("edt.tab", "regimen", session);
  const [prescriber, setPrescriber] = usePersistentState("edt.prescriber.v1", BLANK_PRESCRIBER);
  const [patient, setPatient] = usePersistentState("edt.patient", BLANK_PATIENT, session);
  const [drops, setDrops] = usePersistentState("edt.drops", () => [newSlot()], session);
  const [settings, setSettings] = usePersistentState(
    "edt.schedule.v2",
    { start: today, wake: "08:00", bed: "22:00", months: 1, view: "calendar", qr: true, large: false },
    session
  );
  const [rx, setRx] = usePersistentState("edt.rx", { date: today, notes: "", items: {} }, session);
  const entries = useMemo(() => toEntries(drops), [drops]);

  const go = (next) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };
  const reset = () => {
    if (!window.confirm("Clear this patient and start again?")) return;
    setPatient(BLANK_PATIENT);
    setDrops([newSlot()]);
    setRx({ date: today, notes: "", items: {} });
    setSettings({ ...settings, start: today });
    go("regimen");
  };

  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header subtitle="Drop calendars, prescriptions and reminders">
        <nav className="steps" aria-label="Steps">
          {STEPS.map(([key, label, short], i) => (
            <button
              key={key}
              className={`step ${tab === key ? "active" : ""}`}
              aria-current={tab === key ? "step" : undefined}
              disabled={i > 0 && !entries.length}
              onClick={() => go(key)}
            >
              <span className="step-num">{i + 1}</span>
              <span className="long">{label}</span>
              <span className="short" aria-hidden="true">
                {short}
              </span>
            </button>
          ))}
        </nav>
        <button className={`nav-link ${tab === "formulary" ? "active" : ""}`} aria-current={tab === "formulary" ? "page" : undefined} onClick={() => go("formulary")}>
          Formulary
        </button>
      </Header>
      <main id="main">
        {tab === "regimen" && (
          <RegimenPage patient={patient} setPatient={setPatient} drops={drops} setDrops={setDrops} formulary={formulary.list} go={go} reset={reset} />
        )}
        {tab === "schedule" && (
          <SchedulePage entries={entries} formulary={formulary.list} patient={patient} settings={settings} setSettings={setSettings} go={go} />
        )}
        {tab === "rx" && (
          <RxPage
            entries={entries}
            formulary={formulary.list}
            patient={patient}
            prescriber={prescriber}
            setPrescriber={setPrescriber}
            rx={rx}
            setRx={setRx}
            start={settings.start}
            go={go}
          />
        )}
        {tab === "formulary" && (
          <FormularyPage formulary={formulary.list} setFormulary={formulary.save} restore={formulary.restore} outdated={formulary.outdated} />
        )}
      </main>
      <Footer />
    </>
  );
}

// The phone app only ever shows the patient side.
export default function App() {
  const [route, setRoute] = useState(readPatientRoute);
  useEffect(() => {
    const update = () => setRoute(readPatientRoute());
    window.addEventListener("hashchange", update);
    const stop = onPlanLink((url) => {
      const code = codeFromUrl(url);
      if (code) window.location.hash = `#/p/${code}`;
    });
    return () => {
      window.removeEventListener("hashchange", update);
      stop();
    };
  }, []);
  return route ? <PatientApp route={route} /> : <ClinicianApp />;
}
