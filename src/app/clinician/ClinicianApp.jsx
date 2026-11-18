// The clinician side: a visit in three steps (patient and drops, calendar,
// prescription) and the clinic's formulary. Everything about the patient is
// kept in this browser tab only.
import { useEffect, useMemo, useRef, useState } from "react";
import RegimenPage from "../../components/drops/RegimenPage.jsx";
import FormularyPage from "../../components/formulary/FormularyPage.jsx";
import RxPage from "../../components/rx/RxPage.jsx";
import SchedulePage from "../../components/schedule/SchedulePage.jsx";
import TermsGate, { TERMS_VERSION } from "../../components/TermsGate.jsx";
import { APP_NAME } from "../../config.js";
import { DRUG_CLASSES } from "../../data/formulary.js";
import { useIdle } from "../../hooks/useIdle.js";
import { useOscarBridge } from "../../hooks/useOscarBridge.js";
import { usePersistentState } from "../../hooks/usePersistentState.js";
import { useWhenVisible } from "../../hooks/useWhenVisible.js";
import { dropWarnings } from "../../lib/checks.js";
import { parseISO, todayISO } from "../../lib/dates.js";
import { newId, newSlot, toEntries } from "../../lib/regimen.js";
import { differentPerson } from "../../lib/samePerson.js";
import { decodeRegimen, newNonce } from "../../lib/share.js";
import { cleanText } from "../../lib/validate.js";
import { Footer, Header, SkipLink } from "../Layout.jsx";
import PatientBar from "./PatientBar.jsx";
import {
  BLANK_OWNER,
  BLANK_PATIENT,
  blankRx,
  checkDrops,
  checkImport,
  checkOwner,
  checkRx,
  checkSettings,
  cleanSkipped,
  defaultSettings,
  dropsFromOscar,
  patientFromOscar,
} from "./state.js";
import StepNav, { TITLES } from "./StepNav.jsx";
import { useFormulary } from "./useFormulary.js";
import { usePrescriber } from "./usePrescriber.js";

// On a shared clinic computer, a patient left open is cleared after 30
// minutes without use, so the next person at the desk never sees them.
const IDLE_MS = 30 * 60 * 1000;
const session = { kind: "session" };

export default function ClinicianApp() {
  const formulary = useFormulary();
  const rxer = usePrescriber();
  const [terms, setTerms] = usePersistentState("edt.terms", "");
  const [tab, setTab] = usePersistentState("edt.tab", "regimen", { ...session, check: (t) => (TITLES[t] ? t : null) });
  const [patient, setPatient] = usePersistentState("edt.patient", BLANK_PATIENT, session);
  const [drops, setDrops] = usePersistentState("edt.drops", [], { ...session, check: checkDrops });
  const [settings, setSettings] = usePersistentState("edt.schedule.v3", defaultSettings, { ...session, check: checkSettings });
  const [rx, setRx] = usePersistentState("edt.rx", blankRx, { ...session, check: checkRx });
  // The person the plan on screen was made for. A different name or date of
  // birth typed over it asks whether this is a new patient.
  const [owner, setOwner] = usePersistentState("edt.owner", BLANK_OWNER, { ...session, check: checkOwner });
  // Drops read from Oscar through the extension, with what had to be assumed
  // for each, until the clinician has checked them.
  const [imported, setImported] = usePersistentState("edt.import", null, { ...session, check: checkImport });
  const [askNew, setAskNew] = useState(false);
  const [cleared, setCleared] = useState(false);
  // Today, refreshed when the tab comes back into use, so dates never go
  // stale in a tab left open overnight.
  const [today, setToday] = useState(todayISO);
  // A signature belongs to one prescription and is held in memory only. Any
  // change to the drops or patient means the prescription has not been
  // reviewed in its new form, so it comes off.
  const [signature, setSignature] = useState("");
  useEffect(() => setSignature(""), [drops, patient]);

  const entries = useMemo(() => toEntries(drops), [drops]);
  const warnings = useMemo(() => dropWarnings(drops, formulary.list, DRUG_CLASSES, { dob: patient.dob }), [drops, formulary.list, patient.dob]);
  const needsReview = !!imported && !imported.reviewed;
  const hasPatient = Object.values(patient).some(Boolean) || drops.length > 0;
  const accepted = terms === TERMS_VERSION;

  // Each step gets its own page title, and focus moves to its heading.
  const mainRef = useRef(null);
  const first = useRef(true);
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
    setImported(null);
    setPatient(BLANK_PATIENT);
    setOwner(BLANK_OWNER);
    setAskNew(false);
    setDrops([]);
    setRx(blankRx());
    setSignature("");
    setSettings(defaultSettings());
    go("regimen");
  };
  const reset = () => window.confirm("Clear this patient and start again?") && clearPatient();

  useIdle(hasPatient, IDLE_MS, () => {
    clearPatient();
    rxer.forgetConfirmation();
    setCleared(true);
  });
  // The idle notice is for whoever comes back to the desk. It goes once a
  // new patient is started.
  useEffect(() => {
    if (hasPatient) setCleared(false);
  }, [hasPatient]);

  // A name or date of birth changed while drops are on screen: same person,
  // or a new patient? Blank details are filled in without asking.
  const checkIdentity = () => {
    if (!drops.length) return;
    if (differentPerson(owner, patient)) setAskNew(true);
    else {
      setAskNew(false);
      setOwner({ name: patient.name.trim() || owner.name, dob: patient.dob || owner.dob });
    }
  };
  // New patient: the plan, dates, print choices and patient code all start
  // again. Only the details just typed for the new person stay.
  const startNewPatient = () => {
    const keep = {
      ...BLANK_PATIENT,
      name: !owner.name || differentPerson({ name: owner.name }, { name: patient.name }) ? patient.name : "",
      dob: !owner.dob || owner.dob !== patient.dob ? patient.dob : "",
    };
    clearPatient();
    setPatient(keep);
    setOwner({ name: keep.name.trim(), dob: keep.dob });
  };
  const keepSamePatient = () => {
    setAskNew(false);
    setOwner({ name: patient.name.trim(), dob: patient.dob });
  };

  // The first drop for a patient. If the name or date of birth on screen is
  // not the person the last plan was for, that plan's dates, print choices
  // and patient code do not carry over. A start date left in the past by an
  // idle tab moves to today, unless the plan was opened from a link.
  const dropCount = useRef(drops.length);
  useEffect(() => {
    const was = dropCount.current;
    dropCount.current = drops.length;
    if (was > 0 || !drops.length) return;
    setAskNew(false);
    if (differentPerson(owner, patient)) {
      setSettings(defaultSettings());
      setRx(blankRx());
    } else if (!settings.opened && settings.start < todayISO()) setSettings((s) => ({ ...s, start: todayISO() }));
    setOwner({ name: patient.name.trim() || owner.name, dob: patient.dob || owner.dob });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drops.length]);

  useWhenVisible(() => {
    const now = todayISO();
    setToday(now);
    setSettings((s) => (!dropCount.current && !s.opened && s.start < now ? { ...s, start: now } : s));
  });

  // The QR code library is fetched while online, so a calendar opened later
  // without a connection still gets its code.
  useEffect(() => {
    import("qrcode").catch(() => {});
  }, []);

  // A plan opened from a patient's link keeps its start date, dose times and
  // patient code. Each drop gets a fresh row id for editing, and print
  // choices start fresh.
  const openPlan = (plan) => {
    dropCount.current = plan.entries.length;
    setDrops(plan.entries.map((e) => ({ ...e, id: newId() })));
    setSettings({ ...defaultSettings(), start: plan.start, wake: plan.wake, bed: plan.bed, nonce: plan.nonce || newNonce(), opened: plan.start });
  };

  // A plan opened by hand (Change a plan from an earlier visit) is no longer
  // the one read from Oscar, so the link back to that chart is dropped. The
  // link carries no patient details, so none are kept from the last patient.
  const openPlanByHand = (plan) => {
    setImported(null);
    setPatient(BLANK_PATIENT);
    setOwner(BLANK_OWNER);
    setAskNew(false);
    setRx(blankRx());
    setSignature("");
    openPlan(plan);
  };

  // A chart read by the extension. Its data is checked like any other outside
  // data. A plan link from an earlier Eye Drop Tracker chart note opens
  // exactly as saved, keeping its patient code so the patient's ticks carry
  // over. Otherwise the drops come across for the clinician to check, and with
  // none recognised the patient still comes across for drops added by hand.
  const oscar = useOscarBridge((d) => {
    const fromOscar = patientFromOscar(d.patient);
    const handoff = cleanText(d.handoff, 64);
    rxer.fillFromOscar(d.clinician);
    let plan = null;
    if (typeof d.code === "string" && d.code) {
      try {
        plan = decodeRegimen(d.code);
      } catch {
        return;
      }
    }
    if (hasPatient && !window.confirm("Replace the patient on screen with the one from Oscar?")) return;
    clearPatient();
    setPatient(fromOscar);
    setOwner({ name: fromOscar.name, dob: fromOscar.dob });
    if (plan) {
      openPlan(plan);
      setImported({ handoff, patient: fromOscar, flags: {}, skipped: [], reviewed: false, fromLink: true });
      return;
    }
    const rows = dropsFromOscar(d.drops, formulary.list).map((r) => ({ ...r, id: newId() }));
    setDrops(rows.length ? rows.map((r) => ({ ...r.entry, id: r.id })) : [newSlot()]);
    setImported({
      handoff,
      patient: fromOscar,
      flags: Object.fromEntries(rows.map((r) => [r.id, r.flags])),
      sources: Object.fromEntries(rows.map((r) => [r.id, r.source])),
      confirmed: [],
      skipped: cleanSkipped(d.skipped),
      // Nothing read from the chart means nothing to tick.
      reviewed: rows.length === 0,
    });
  });

  // The plan goes back to Oscar only while the patient on screen is still the
  // one it was read from.
  const samePatient = !!imported?.patient && imported.patient.name === patient.name && imported.patient.dob === patient.dob;
  const chartTarget = oscar.available && imported?.handoff && samePatient ? imported.patient.name : "";

  return (
    <>
      <SkipLink onClick={(e) => (e.preventDefault(), mainRef.current?.focus())} />
      <Header>
        <StepNav tab={tab} go={go} locked={!entries.length || needsReview || askNew} />
      </Header>
      <main id="main" ref={mainRef} tabIndex={-1}>
        {!accepted && <TermsGate onAccept={() => setTerms(TERMS_VERSION)} />}
        {accepted && cleared && (
          <p className="notice idle-notice" role="status">
            The last patient was cleared after 30 minutes without use.{" "}
            <button className="link-btn" onClick={() => setCleared(false)}>
              Dismiss
            </button>
          </p>
        )}
        {accepted && tab === "regimen" && (
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
            checkIdentity={checkIdentity}
            askNew={askNew}
            startNewPatient={startNewPatient}
            keepSamePatient={keepSamePatient}
            imported={imported}
            setReviewed={(reviewed) => setImported((v) => (v ? { ...v, reviewed, confirmed: reviewed ? v.confirmed : [] } : v))}
            setConfirmed={(confirmed, reviewed) => setImported((v) => (v ? { ...v, confirmed, reviewed } : v))}
          />
        )}
        {accepted && (tab === "schedule" || tab === "rx") && entries.length > 0 && <PatientBar patient={patient} go={go} />}
        {accepted && tab === "schedule" && (
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
        {accepted && tab === "rx" && (
          <RxPage
            entries={entries}
            formulary={formulary.list}
            patient={patient}
            prescriber={rxer.prescriber}
            setPrescriber={rxer.edit}
            prescriberConfirmed={rxer.confirmed}
            confirmPrescriber={rxer.confirm}
            today={today}
            setToday={setToday}
            rx={rx}
            setRx={setRx}
            signature={signature}
            setSignature={setSignature}
            savedSignature={rxer.savedSignature}
            saveSignature={rxer.saveSignature}
            start={settings.start}
            warnings={warnings}
            go={go}
          />
        )}
        {accepted && tab === "formulary" && (
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
