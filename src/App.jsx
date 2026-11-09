import { Component, useEffect, useMemo, useRef, useState } from "react";
import { APP_NAME, CONTACT_EMAIL, COPYRIGHT_YEAR, OWNERS, REPO_URL } from "./config.js";
import TermsGate, { TERMS_VERSION, legalLink } from "./components/TermsGate.jsx";
import { DRUG_CLASSES, FORMULARY_VERSION, SEED_FORMULARY } from "./data/formulary.js";
import { dropWarnings } from "./lib/checks.js";
import { isValidISO, parseISO, toISO } from "./lib/dates.js";
import { newSlot, toEntries } from "./lib/regimen.js";
import { codeFromUrl, decodeRegimen, newNonce } from "./lib/share.js";
import { isNative, onPlanLink } from "./lib/native.js";
import { adoptPlan, currentPlanCode, forgetCurrentPlan } from "./lib/patientStore.js";
import { usePersistentState } from "./lib/storage.js";
import { useIdle } from "./lib/useIdle.js";
import { isClockTime } from "./lib/times.js";
import { MAX_DROPS, cleanEntry, cleanFormulary } from "./lib/validate.js";
import { useOscarBridge } from "./lib/oscarBridge.js";
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
  size: "standard",
  nonce: newNonce(),
});

// Text from the extension or storage: trimmed, limited and without control
// or invisible formatting characters.
const cleanText = (v, max) => (typeof v === "string" ? v.replace(/[\p{Cc}\p{Cf}]/gu, "").trim().slice(0, max) : "");
const cleanFlags = (v) => (Array.isArray(v) ? v.map((f) => cleanText(f, 300)).filter(Boolean).slice(0, 10) : []);
const cleanSkipped = (v) =>
  (Array.isArray(v) ? v : [])
    .map((s) => ({ name: cleanText(s?.name, 60), why: cleanText(s?.why, 120) }))
    .filter((s) => s.name && s.why)
    .slice(0, 20);
function checkImport(v) {
  if (!v || typeof v !== "object" || !v.flags || typeof v.flags !== "object") return null;
  return {
    handoff: cleanText(v.handoff, 64),
    flags: Object.fromEntries(Object.entries(v.flags).slice(0, 20).map(([k, f]) => [cleanText(k, 40), cleanFlags(f)])),
    skipped: cleanSkipped(v.skipped),
    sources: Object.fromEntries(Object.entries(v.sources && typeof v.sources === "object" ? v.sources : {}).slice(0, 20).map(([k, t]) => [cleanText(k, 40), cleanText(t, 200)])),
    confirmed: Array.isArray(v.confirmed) ? v.confirmed.slice(0, 20).map((k) => cleanText(k, 40)) : [],
    reviewed: v.reviewed === true,
    fromLink: v.fromLink === true,
    patient: { name: cleanText(v.patient?.name, 80), dob: isValidISO(v.patient?.dob) ? v.patient.dob : "" },
  };
}

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
    // "standard" is two weeks a page, "large" one week, "compact" a month.
    // Older saved settings had only a large print tick box.
    size: ["standard", "large", "compact"].includes(s.size) ? s.size : s.large === true ? "large" : "standard",
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
          <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>
        </p>
        <p className="legal-links">
          <a href={legalLink("terms")}>Terms of use</a>
          {!patientView && <a href={legalLink("clinic-terms")}>Clinic terms</a>}
          <a href={legalLink("privacy")}>Privacy</a>
          <a href={legalLink("security")}>Security</a>
          <a href={legalLink("accessibility")}>Accessibility</a>
          <a href={legalLink("licenses", "txt")}>Open source licences</a>
        </p>
        {!patientView && (
          <p>
            A clinical aid, not a substitute for clinical judgement. Check every calendar and prescription before it goes to a
            patient. Defaults follow Canadian product monographs and the Ontario Drug Benefit formulary. Patient details are not
            sent to us.
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
  if (!code && installed) code = currentPlanCode();
  if (!code) return installed ? { welcome: true } : null;
  let plan;
  try {
    plan = decodeRegimen(code);
  } catch {
    return { invalid: true, installed };
  }
  // The plan becomes this phone's current plan, keeping the patient's ticks.
  adoptPlan(code, plan);
  return { code, plan };
}

function PatientApp({ route }) {
  const open = (code) => (window.location.hash = `#/p/${code}`);
  // The patient pages follow the phone's own text size (see .patient in the styles).
  useEffect(() => {
    document.title = `My eye drops · ${APP_NAME}`;
    document.documentElement.classList.add("patient");
    return () => document.documentElement.classList.remove("patient");
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
                  forgetCurrentPlan();
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
  const [terms, setTerms] = usePersistentState("edt.terms", "");
  const [tab, setTab] = usePersistentState("edt.tab", "regimen", { ...session, check: (t) => (TITLES[t] ? t : null) });
  const [prescriber, setPrescriber] = usePersistentState("edt.prescriber.v1", BLANK_PRESCRIBER);
  const [patient, setPatient] = usePersistentState("edt.patient", BLANK_PATIENT, session);
  const [drops, setDrops] = usePersistentState("edt.drops", [], { ...session, check: checkDrops });
  const [settings, setSettings] = usePersistentState("edt.schedule.v3", defaultSettings, { ...session, check: checkSettings });
  const [rx, setRx] = usePersistentState("edt.rx", blankRx, session);
  // A signature is drawn for one prescription and held in memory only, never
  // in browser storage. Any change to the drops or patient means the
  // prescription has not been reviewed in its new form, so it comes off.
  const [signature, setSignature] = useState("");
  useEffect(() => setSignature(""), [drops, patient]);
  // Signatures saved by earlier versions are removed.
  useEffect(() => {
    try {
      localStorage.removeItem("edt.signature.v1");
    } catch {
      // Nothing stored.
    }
    // eslint-disable-next-line no-unused-vars
    setRx(({ sig, esign, ...r }) => r);
  }, [setRx]);
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
  // Drops read from Oscar through the extension, with what had to be assumed
  // for each, until the clinician has checked them.
  const [imported, setImported] = usePersistentState("edt.import", null, { ...session, check: checkImport });
  const needsReview = !!imported && !imported.reviewed;

  // Everything about the current patient, cleared together.
  const clearPatient = () => {
    setImported(null);
    setPatient(BLANK_PATIENT);
    setDrops([]);
    setRx(blankRx());
    setSignature("");
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
  // The notice is for whoever comes back to the desk. It goes once a new
  // patient is started.
  useEffect(() => {
    if (hasPatient) setCleared(false);
  }, [hasPatient]);

  // The extension's drops are checked like any other outside data, and only
  // drugs in this clinic's drug list are taken.
  const oscar = useOscarBridge((d) => {
    const patientFromOscar = { ...BLANK_PATIENT, name: cleanText(d.patient?.name, 80), dob: isValidISO(d.patient?.dob) ? d.patient.dob : "" };
    // A plan link from an earlier Eye Drop Tracker chart note opens exactly
    // as saved, keeping its patient code so the patient's ticks carry over.
    if (typeof d.code === "string" && d.code) {
      let plan;
      try {
        plan = decodeRegimen(d.code);
      } catch {
        return;
      }
      if (hasPatient && !window.confirm("Replace the patient on screen with the one from Oscar?")) return;
      clearPatient();
      setPatient(patientFromOscar);
      openPlan(plan);
      setImported({ handoff: cleanText(d.handoff, 64), patient: patientFromOscar, flags: {}, skipped: [], reviewed: false, fromLink: true });
      return;
    }
    const known = new Set(formulary.list.map((m) => m.brand));
    const rows = (Array.isArray(d.drops) ? d.drops : [])
      .slice(0, MAX_DROPS)
      .map((x) => ({ entry: cleanEntry(x), flags: cleanFlags(x?.flags), source: cleanText(x?.source, 200) }))
      .filter((r) => r.entry && known.has(r.entry.brand));
    // With no drops recognised, the patient still comes across, so the
    // clinician adds the drops by hand and can still add the plan to the chart.
    if (hasPatient && !window.confirm("Replace the patient on screen with the one from Oscar?")) return;
    clearPatient();
    const stamp = Date.now().toString(36);
    const ids = rows.map((_, i) => `d${stamp}x${i}`);
    setPatient(patientFromOscar);
    setDrops(rows.length ? rows.map((r, i) => ({ ...r.entry, id: ids[i] })) : [newSlot()]);
    setImported({
      handoff: cleanText(d.handoff, 64),
      patient: patientFromOscar,
      flags: Object.fromEntries(rows.map((r, i) => [ids[i], r.flags])),
      sources: Object.fromEntries(rows.map((r, i) => [ids[i], r.source])),
      confirmed: [],
      skipped: cleanSkipped(d.skipped),
      // Nothing read from the chart means nothing to tick. The clinician adds
      // the drops by hand.
      reviewed: rows.length === 0,
    });
  });

  // A plan opened from a patient's link keeps its start date, dose times and
  // plan ID. Each drop gets a fresh row id for editing.
  const openPlan = (plan) => {
    setDrops(plan.entries.map((e, i) => ({ ...e, id: `d${Date.now().toString(36)}o${i}` })));
    setSettings((s) => ({ ...s, start: plan.start, wake: plan.wake, bed: plan.bed, nonce: plan.nonce || s.nonce }));
  };

  // A plan opened by hand (Change a plan from an earlier visit) is no longer
  // the one read from Oscar, so the link back to that chart is dropped.
  const openPlanByHand = (plan) => {
    setImported(null);
    openPlan(plan);
  };
  // The plan goes back to Oscar only while the patient on screen is still the
  // one it was read from.
  const samePatient = !!imported?.patient && imported.patient.name === patient.name && imported.patient.dob === patient.dob;
  const chartTarget = oscar.available && imported?.handoff && samePatient ? imported.patient.name : "";

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
              disabled={i > 0 && (!entries.length || needsReview)}
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
        {terms !== TERMS_VERSION && <TermsGate onAccept={() => setTerms(TERMS_VERSION)} />}
        {terms === TERMS_VERSION && cleared && (
          <p className="notice idle-notice" role="status">
            The last patient was cleared after 30 minutes without use.{" "}
            <button className="link-btn" onClick={() => setCleared(false)}>
              Dismiss
            </button>
          </p>
        )}
        {terms === TERMS_VERSION && tab === "regimen" && (
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
            openPlan={openPlanByHand}
            imported={imported}
            setReviewed={(reviewed) => setImported((v) => (v ? { ...v, reviewed, confirmed: reviewed ? v.confirmed : [] } : v))}
            setConfirmed={(confirmed, reviewed) => setImported((v) => (v ? { ...v, confirmed, reviewed } : v))}
          />
        )}
        {terms === TERMS_VERSION && tab === "schedule" && (
          <SchedulePage
            entries={entries}
            formulary={formulary.list}
            patient={patient}
            settings={settings}
            setSettings={setSettings}
            warnings={warnings}
            go={go}
            addToChart={chartTarget ? { patient: chartTarget, add: (code) => oscar.addToChart(imported.handoff, code) } : null}
          />
        )}
        {terms === TERMS_VERSION && tab === "rx" && (
          <RxPage
            entries={entries}
            formulary={formulary.list}
            patient={patient}
            prescriber={prescriber}
            setPrescriber={setPrescriber}
            rx={rx}
            setRx={setRx}
            signature={signature}
            setSignature={setSignature}
            start={settings.start}
            warnings={warnings}
            go={go}
          />
        )}
        {terms === TERMS_VERSION && tab === "formulary" && (
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
      const saved = currentPlanCode();
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
