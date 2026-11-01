import { useEffect, useMemo, useState } from "react";
import { APP_NAME, CONTACT_EMAIL, COPYRIGHT_YEAR, OWNERS } from "./config.js";
import { FORMULARY_VERSION, SEED_FORMULARY } from "./data/formulary.js";
import { newSlot, toEntries, toISO } from "./lib/regimen.js";
import { usePersistentState } from "./lib/storage.js";
import { decodeRegimen } from "./lib/share.js";
import { isNative, onPlanLink } from "./lib/native.js";
import RegimenPage from "./components/RegimenPage.jsx";
import SchedulePage from "./components/SchedulePage.jsx";
import RxPage from "./components/RxPage.jsx";
import FormularyPage from "./components/FormularyPage.jsx";
import PatientView from "./components/PatientView.jsx";
import PatientWelcome from "./components/PatientWelcome.jsx";
import { Icon } from "./components/ui.jsx";

const STEPS = [
  ["regimen", "Patient and drops"],
  ["schedule", "Calendar"],
  ["rx", "Prescription"],
];

const blankPatient = { name: "", dob: "", hcn: "", address: "" };
const blankPrescriber = { name: "", license: "", clinic: "", street: "", city: "", phone: "", fax: "" };

function Footer({ compact }) {
  return (
    <footer className="site-foot no-print">
      <div className="site-foot-inner">
        <p>
          © {COPYRIGHT_YEAR} {OWNERS}. Free and open source.
          {CONTACT_EMAIL && (
            <>
              {" "}
              Partnerships and feedback: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
            </>
          )}
        </p>
        {!compact && (
          <p>
            A clinical aid, not a substitute for clinical judgement. Check every calendar and prescription before it
            goes to a patient. Patient information never leaves this browser.
          </p>
        )}
      </div>
    </footer>
  );
}

function Brand({ sub }) {
  return (
    <a className="brand" href={isNative ? "#" : import.meta.env.BASE_URL}>
      <span className="brand-mark" aria-hidden="true">
        {Icon.eye}
      </span>
      <span>
        <span className="brand-name">{APP_NAME}</span>
        <span className="brand-sub">{sub}</span>
      </span>
    </a>
  );
}

function codeFromUrl(url) {
  const m = String(url || "").match(/(?:#\/p\/|:\/\/p\/)([\w-]+)/);
  return m?.[1] || null;
}

function savedCode() {
  try {
    return localStorage.getItem("edt.patientPlan");
  } catch {
    return null;
  }
}

function readPatientPlan() {
  const standalone =
    window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
  let code = codeFromUrl(window.location.hash);
  if (!code && (standalone || isNative)) code = savedCode();
  if (!code) return isNative ? { welcome: true } : null;
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
    const off = onPlanLink((url) => {
      const code = codeFromUrl(url);
      if (code) window.location.hash = `#/p/${code}`;
    });
    return () => {
      window.removeEventListener("hashchange", h);
      off();
    };
  }, []);

  if (patientPlan) {
    return (
      <>
        <header className="topbar no-print">
          <div className="topbar-inner">
            <Brand sub="Your eye drops" />
          </div>
        </header>
        <main id="main">
          {patientPlan.welcome && <PatientWelcome onCode={(c) => (window.location.hash = `#/p/${c}`)} codeFromUrl={codeFromUrl} />}
          {patientPlan.error && (
            <div className="card card-b pt">
              <h1 style={{ fontSize: 22, marginBottom: 8 }}>This link did not open</h1>
              <p>The link may be incomplete. Scan the QR code on your calendar again, or ask your clinic for a new one.</p>
            </div>
          )}
          {patientPlan.plan && <PatientView plan={patientPlan.plan} code={patientPlan.code} />}
        </main>
        <Footer compact />
      </>
    );
  }
  return <ClinicianApp />;
}

function useFormulary() {
  // Unedited formularies follow the latest defaults automatically. Edited ones
  // are kept, and the Formulary page offers the newer defaults.
  const [store, setStore] = usePersistentState("edt.formulary.v3", {
    version: FORMULARY_VERSION,
    edited: false,
    list: SEED_FORMULARY,
  });
  const list = store.edited ? store.list : SEED_FORMULARY;
  const outdated = store.edited && store.version < FORMULARY_VERSION;
  const set = (next) => setStore({ version: store.version, edited: true, list: next });
  const restore = () => setStore({ version: FORMULARY_VERSION, edited: false, list: SEED_FORMULARY });
  return [list, set, restore, outdated];
}

function ClinicianApp() {
  const [tab, setTab] = usePersistentState("edt.tab", "regimen", "session");
  const [formulary, setFormulary, restoreFormulary, outdated] = useFormulary();
  const [prescriber, setPrescriber] = usePersistentState("edt.prescriber.v1", blankPrescriber);
  const [patient, setPatient] = usePersistentState("edt.patient", blankPatient, "session");
  const [drops, setDrops] = usePersistentState("edt.drops", () => [newSlot()], "session");
  const today = toISO(new Date());
  const [settings, setSettings] = usePersistentState(
    "edt.schedule.v2",
    { start: today, wake: "08:00", bed: "22:00", months: 1, view: "calendar", qr: true, large: false },
    "session"
  );
  const [rx, setRx] = usePersistentState("edt.rx", { date: today, notes: "", items: {} }, "session");
  const entries = useMemo(() => toEntries(drops), [drops]);
  const ready = entries.length > 0;

  const go = (t) => {
    setTab(t);
    window.scrollTo({ top: 0 });
  };
  const reset = () => {
    if (!window.confirm("Clear this patient and start again?")) return;
    setPatient(blankPatient);
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
      <header className="topbar no-print">
        <div className="topbar-inner">
          <Brand sub="Drop calendars, prescriptions and reminders" />
          <nav className="steps" aria-label="Steps">
            {STEPS.map(([k, label], i) => (
              <button
                key={k}
                className={`step ${tab === k ? "active" : ""}`}
                aria-current={tab === k ? "step" : undefined}
                disabled={i > 0 && !ready}
                onClick={() => go(k)}
              >
                <span className="step-num">{i + 1}</span>
                {label}
              </button>
            ))}
          </nav>
          <button
            className={`nav-link ${tab === "formulary" ? "active" : ""}`}
            aria-current={tab === "formulary" ? "page" : undefined}
            onClick={() => go("formulary")}
          >
            Formulary
          </button>
        </div>
      </header>
      <main id="main">
        {tab === "regimen" && (
          <RegimenPage
            patient={patient}
            setPatient={setPatient}
            drops={drops}
            setDrops={setDrops}
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
            start={settings.start}
            go={go}
          />
        )}
        {tab === "formulary" && (
          <FormularyPage
            formulary={formulary}
            setFormulary={setFormulary}
            restore={restoreFormulary}
            outdated={outdated}
          />
        )}
      </main>
      <Footer />
    </>
  );
}
