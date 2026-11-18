// The patient side: opened from the QR code, or the phone app.
import { useEffect } from "react";
import PatientView from "../../components/patient/PatientView.jsx";
import PatientWelcome from "../../components/patient/PatientWelcome.jsx";
import { APP_NAME } from "../../config.js";
import { isNative } from "../../lib/native.js";
import { adoptPlan, currentPlanCode, forgetCurrentPlan } from "../../lib/patientStore.js";
import { codeFromUrl, decodeRegimen } from "../../lib/share.js";
import { Footer, Header, SkipLink } from "../Layout.jsx";

// What the address asks for: a plan, a damaged link, the app's welcome page,
// or null for the clinician side. An installed app with no link opens the
// plan it last showed.
export function readPatientRoute() {
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

const openCode = (code) => (window.location.hash = `#/p/${code}`);

function InvalidLink({ installed }) {
  const enterNew = () => {
    forgetCurrentPlan();
    window.location.hash = "";
    window.dispatchEvent(new HashChangeEvent("hashchange"));
  };
  return (
    <div className="pt">
      <h1>This link did not open</h1>
      <p>The link is damaged or out of date. Scan the QR code on your printed calendar again, or ask your eye clinic for a new one.</p>
      {installed && (
        <button className="btn primary" onClick={enterNew}>
          Enter a new link
        </button>
      )}
    </div>
  );
}

export default function PatientApp({ route }) {
  // The patient pages follow the phone's own text size (see .patient in the styles).
  useEffect(() => {
    document.title = `My eye drops · ${APP_NAME}`;
    document.documentElement.classList.add("patient");
    return () => document.documentElement.classList.remove("patient");
  }, []);
  return (
    <>
      <SkipLink />
      <Header />
      <main id="main" tabIndex={-1}>
        {route.welcome && <PatientWelcome onCode={openCode} />}
        {route.invalid && <InvalidLink installed={route.installed} />}
        {route.plan && <PatientView key={route.code} plan={route.plan} code={route.code} />}
      </main>
      <Footer patientView />
    </>
  );
}
