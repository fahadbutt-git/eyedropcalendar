// The root: the patient side when the address holds a plan link (always, in
// the phone app), otherwise the clinician side.
import { useEffect, useState } from "react";
import { onPlanLink } from "../lib/native.js";
import { currentPlanCode } from "../lib/patientStore.js";
import { codeFromUrl, decodeRegimen } from "../lib/share.js";
import ClinicianApp from "./clinician/ClinicianApp.jsx";
import ErrorBoundary from "./ErrorBoundary.jsx";
import PatientApp, { readPatientRoute } from "./patient/PatientApp.jsx";

// A link opened in the phone app that would replace a saved plan asks first.
function confirmReplace(code) {
  const saved = currentPlanCode();
  if (!saved || saved === code) return true;
  let names = "";
  try {
    names = decodeRegimen(code)
      .entries.map((e) => e.brand)
      .join(", ");
  } catch {
    // A damaged link is refused on the plan page itself.
  }
  return window.confirm(`Replace your current drop plan with this one${names ? ` (${names})` : ""}?`);
}

export default function App() {
  const [route, setRoute] = useState(readPatientRoute);
  useEffect(() => {
    const update = () => setRoute(readPatientRoute());
    window.addEventListener("hashchange", update);
    const stop = onPlanLink((url) => {
      const code = codeFromUrl(url);
      if (code && confirmReplace(code)) window.location.hash = `#/p/${code}`;
    });
    return () => {
      window.removeEventListener("hashchange", update);
      stop();
    };
  }, []);
  return <ErrorBoundary patient={!!route}>{route ? <PatientApp route={route} /> : <ClinicianApp />}</ErrorBoundary>;
}
