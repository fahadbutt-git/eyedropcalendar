// The header and footer shared by the clinician and patient sides.
import { legalLink } from "../components/TermsGate.jsx";
import { APP_NAME, CONTACT_EMAIL, COPYRIGHT_YEAR, OWNERS, REPO_URL } from "../config.js";
import { isNative } from "../lib/native.js";

export function Header({ children }) {
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

export function Footer({ patientView = false }) {
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
            A clinical aid that does not replace clinical judgement. Check every calendar and prescription before it goes to a patient.
            Defaults follow Canadian product monographs and the Ontario Drug Benefit formulary. Patient details are not sent to us.
          </p>
        )}
      </div>
    </footer>
  );
}

export function SkipLink({ onClick }) {
  return (
    <a className="skip" href="#main" onClick={onClick}>
      Skip to content
    </a>
  );
}
