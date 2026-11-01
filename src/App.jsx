import { Component, useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME, CONTACT_EMAIL, COPYRIGHT_YEAR, OWNERS, REPO_URL, SITE_URL } from "./config.js";
import { DRUG_CLASSES, FORMULARY_VERSION, SEED_FORMULARY } from "./data/formulary.js";
import { dropWarnings } from "./lib/checks.js";
import { isValidISO, parseISO, toISO } from "./lib/dates.js";
import { toEntries } from "./lib/regimen.js";
import { codeFromUrl, decodeRegimen, newNonce } from "./lib/share.js";
import { isNative, onPlanLink } from "./lib/native.js";
import { usePersistentState } from "./lib/storage.js";
import { useIdle } from "./lib/useIdle.js";
import { isClockTime } from "./lib/times.js";
import { cleanEntry, cleanFormulary } from "./lib/validate.js";
import RegimenPage from "./components/drops/RegimenPage.jsx";
import SchedulePage from "./components/schedule/SchedulePage.jsx";
import RxPage from "./components/rx/RxPage.jsx";
import FormularyPage from "./components/formulary/FormularyPage.jsx";
import PatientView from "./components/patient/PatientView.jsx";
import PatientWelcome from "./components/patient/PatientWelcome.jsx";

const STEPS = [
  ["regimen", "Patient and drops", "Drops"],
  ["schedule", "Calendar", "Calendar"],
  ["rx", "Prescription", "Rx"],
];
const TITLES = { regimen: "Patient and drops", schedule: "Calendar", rx: "Prescription", formulary: "Formulary" };
const IDLE_MS = 30 * 60 * 1000;
const blankRx = () => ({ date: toISO(new Date()), notes: "", items: {} });
const BLANK_PATIENT = { name: "", dob: "", hcn: "", address: "" };
const BLANK_PRESCRIBER = { name: "", license: "", clinic: "", street: "", city: "", phone: "", fax: "" };
const defaultSettings = () => ({
  start: toISO(new Date()),
  wake: "08:00",
  bed: "22:00",
  months: 1,
  pages: { calendar: true, chart: false, checklist: false },
  qr: true,
  large: false,
  nonce: newNonce(),
});

// Stored settings are repaired field by field, so a bad value can never break a page.
function checkSettings(s) {
  if (!s || typeof s !== "object") return null;
  const d = defaultSettings();
  const pages = s.pages && typeof s.pages === "object" ? s.pages : d.pages;
  return {
    start: isValidISO(s.start) ? s.start : d.start,
    wake: isClockTime(s.wake) ? s.wake : d.wake,
    bed: isClockTime(s.bed) ? s.bed : d.bed,
    months: [1, 2, 3].includes(Number(s.months)) ? Number(s.months) : 1,
    pages: { calendar: pages.calendar === true, chart: pages.chart === true, checklist: pages.checklist === true },
    qr: s.qr !== false,
    large: s.large === true,
    nonce: typeof s.nonce === "string" && /^[a-z0-9]{4,16}$/.test(s.nonce) ? s.nonce : d.nonce,
  };
}
const checkDrops = (list) =>
  Array.isArray(list)
    ? list.slice(0, 12).flatMap((d) => {
        const clean = d?.brand ? cleanEntry(d) : null;
        return clean ? [{ ...clean, id: typeof d.id === "string" ? d.id : `d${Math.random().toString(36).slice(2)}` }] : [];
      })
    : null;

function Footer({ patientView }) {
  return (
    <footer className="site-foot no-print">
      <div className="site-foot-inner">
        <p>
          © {COPYRIGHT_YEAR} {OWNERS}.{" "}
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Open source
          </a>{" "}
          under the Apache 2.0 licence. No ads and no industry funding. Feedback and errors:{" "}
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.{" "}
          <a href={`${isNative ? SITE_URL : ""}/privacy.html`}>Privacy</a>
        </p>
        {!patientView && (
          <p>
            A clinical aid, not a substitute for clinical judgement. Check every calendar and prescription before it goes to a
            patient. Defaults follow Canadian product monographs and the Ontario Drug Benefit formulary. Patient details are never
            sent anywhere.
          </p>
        )}
      </div>
    </footer>
  );
}

// Any unexpected error shows a way back instead of a blank page.
class ErrorBoundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const restart = () => {
      try {
        sessionStorage.clear();
      } catch {
        // Nothing to clear.
      }
      window.location.reload();
    };
    if (this.props.patient)
      return (
        <main className="empty" id="main">
          <h1>Something went wrong</h1>
          <p>Your drop plan and check marks are safe on this phone. Tap below to open it again.</p>
          <button className="btn primary" onClick={() => window.location.reload()}>
            Open my drops again
          </button>
        </main>
      );
    return (
      <main className="empty" id="main">
        <h1>Something went wrong</h1>
        <p>Your formulary and prescriber details are safe. The current patient will need to be entered again.</p>
        <button className="btn primary" onClick={restart}>
          Start again
        </button>
      </main>
    );
  }
}

function Header({ children }) {
  return (
    <header className="topbar no-print">
      <div className="topbar-inner">
        <a className="brand" href={isNative ? "#" : import.meta.env.BASE_URL}>
          {APP_NAME}
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
  if (!code) return installed ? { welcome: true } : null;
  try {
    return { code, plan: decodeRegimen(code) };
  } catch {
    return { invalid: true, installed };
  }
}

function PatientApp({ route }) {
  const open = (code) => (window.location.hash = `#/p/${code}`);
  useEffect(() => {
    document.title = `My eye drops · ${APP_NAME}`;
  }, []);
  return (
    <>
      <a className="skip" href="#main">
        Skip to content
      </a>
      <Header />
      <main id="main" tabIndex={-1}>
        {route.welcome && <PatientWelcome onCode={open} />}
        {route.invalid && (
          <div className="pt">
            <h1>This link did not open</h1>
            <p>The link is damaged or out of date. Scan the QR code on your printed calendar again, or ask your eye clinic for a new one.</p>
            {route.installed && (
              <button
                className="btn primary"
                onClick={() => {
                  try {
                    localStorage.removeItem("edt.patientPlan");
                  } catch {
                    // Nothing stored.
                  }
                  window.location.hash = "";
                  window.dispatchEvent(new HashChangeEvent("hashchange"));
                }}
              >
                Enter a new link
              </button>
            )}
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
  const session = { kind: "session" };
  const formulary = useFormulary();
  const [tab, setTab] = usePersistentState("edt.tab", "regimen", { ...session, check: (t) => (TITLES[t] ? t : null) });
  const [prescriber, setPrescriber] = usePersistentState("edt.prescriber.v1", BLANK_PRESCRIBER);
  const [patient, setPatient] = usePersistentState("edt.patient", BLANK_PATIENT, session);
  const [drops, setDrops] = usePersistentState("edt.drops", [], { ...session, check: checkDrops });
  const [settings, setSettings] = usePersistentState("edt.schedule.v3", defaultSettings, { ...session, check: checkSettings });
  const [rx, setRx] = usePersistentState("edt.rx", blankRx, session);
  // Any change to the drops or patient means the prescription has not been
  // reviewed in its new form, so the electronic signature comes off.
  useEffect(() => {
    setRx((r) => (r.esign ? { ...r, esign: false } : r));
  }, [drops, patient, setRx]);
  const entries = useMemo(() => toEntries(drops), [drops]);
  const warnings = useMemo(() => dropWarnings(drops, formulary.list, DRUG_CLASSES, { dob: patient.dob }), [drops, formulary.list, patient.dob]);
  const mainRef = useRef(null);
  const first = useRef(true);

  // Each step gets its own page title, and focus moves to its heading.
  useEffect(() => {
    document.title = `${TITLES[tab]} · ${APP_NAME}`;
    if (first.current) {
      first.current = false;
      return;
    }
    const target = mainRef.current?.querySelector("h1") || mainRef.current;
    target?.setAttribute("tabindex", "-1");
    target?.focus({ preventScroll: true });
  }, [tab]);

  const go = (next) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  };
  // Everything about the current patient, cleared together.
  const clearPatient = () => {
    setPatient(BLANK_PATIENT);
    setDrops([]);
    setRx(blankRx());
    setSettings(defaultSettings());
    go("regimen");
  };
  const reset = () => window.confirm("Clear this patient and start again?") && clearPatient();

  // On a shared clinic computer, a patient left open is cleared after 30
  // minutes without use, so the next person at the desk never sees them.
  const [cleared, setCleared] = useState(false);
  const hasPatient = Object.values(patient).some(Boolean) || drops.length > 0;
  useIdle(hasPatient, IDLE_MS, () => {
    clearPatient();
    setCleared(true);
  });

  // A plan opened from a patient's link keeps its start date, dose times and
  // plan ID. Each drop gets a fresh row id for editing.
  const openPlan = (plan) => {
    setDrops(plan.entries.map((e, i) => ({ ...e, id: `d${Date.now().toString(36)}o${i}` })));
    setSettings((s) => ({ ...s, start: plan.start, wake: plan.wake, bed: plan.bed, nonce: plan.nonce || s.nonce }));
  };

  return (
    <>
      <a className="skip" href="#main" onClick={(e) => (e.preventDefault(), mainRef.current?.focus())}>
        Skip to content
      </a>
      <Header>
        <nav className="steps" aria-label="Steps">
          {STEPS.map(([key, label, short], i) => (
            <button
              key={key}
              className={`step ${tab === key ? "active" : ""}`}
              aria-current={tab === key ? "step" : undefined}
              disabled={i > 0 && !entries.length}
              onClick={() => go(key)}
            >
              <span className="step-num">{i + 1}</span> <span className="long">{label}</span>
              <span className="short">{short}</span>
            </button>
          ))}
          <button className={`step plain ${tab === "formulary" ? "active" : ""}`} aria-current={tab === "formulary" ? "page" : undefined} onClick={() => go("formulary")}>
            Formulary
          </button>
        </nav>
      </Header>
      <main id="main" ref={mainRef} tabIndex={-1}>
        {cleared && (
          <p className="notice idle-notice" role="status">
            The last patient was cleared after 30 minutes without use.{" "}
            <button className="link-btn" onClick={() => setCleared(false)}>
              Dismiss
            </button>
          </p>
        )}
        {tab === "regimen" && (
          <RegimenPage
            patient={patient}
            setPatient={setPatient}
            drops={drops}
            setDrops={setDrops}
            formulary={formulary.list}
            startDate={parseISO(settings.start)}
            warnings={warnings}
            go={go}
            reset={reset}
            openPlan={openPlan}
          />
        )}
        {tab === "schedule" && (
          <SchedulePage entries={entries} formulary={formulary.list} patient={patient} settings={settings} setSettings={setSettings} warnings={warnings} go={go} />
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
            warnings={warnings}
            go={go}
          />
        )}
        {tab === "formulary" && (
          <FormularyPage
            formulary={formulary.list}
            setFormulary={formulary.save}
            restore={formulary.restore}
            outdated={formulary.outdated}
            inUse={drops.map((d) => d.brand)}
          />
        )}
      </main>
      <Footer />
    </>
  );
}

// The phone app only ever shows the patient side. A link that would replace
// a saved plan asks first.
export default function App() {
  const [route, setRoute] = useState(readPatientRoute);
  useEffect(() => {
    const update = () => setRoute(readPatientRoute());
    window.addEventListener("hashchange", update);
    const stop = onPlanLink((url) => {
      const code = codeFromUrl(url);
      if (!code) return;
      let saved = null;
      try {
        saved = localStorage.getItem("edt.patientPlan");
      } catch {
        saved = null;
      }
      if (saved && saved !== code) {
        let names = "";
        try {
          names = decodeRegimen(code).entries.map((e) => e.brand).join(", ");
        } catch {
          names = "";
        }
        if (!window.confirm(`Replace your current drop plan with this one${names ? ` (${names})` : ""}?`)) return;
      }
      window.location.hash = `#/p/${code}`;
    });
    return () => {
      window.removeEventListener("hashchange", update);
      stop();
    };
  }, []);
  return <ErrorBoundary patient={!!route}>{route ? <PatientApp route={route} /> : <ClinicianApp />}</ErrorBoundary>;
}
