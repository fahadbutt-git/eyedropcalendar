import { useState } from "react";
import { SITE_URL, TERMS_VERSION } from "../config.js";
import { isNative } from "../lib/native.js";

// Shown once per browser before the clinician pages, so everyone who builds a
// plan has agreed to the terms.
export { TERMS_VERSION };
export const legalLink = (page, ext = "html") => `${isNative ? SITE_URL : ""}/${page}.${ext}`;

export default function TermsGate({ onAccept }) {
  const [agreed, setAgreed] = useState(false);
  return (
    <div className="page terms-gate">
      <h1>Before you start</h1>
      <p>
        Eye Drop Tracker is a clinical aid for licensed health professionals and the people working under their supervision. It
        does not replace clinical judgement: check every calendar, phone plan and prescription before it reaches a patient. It is
        not a licensed medical device.
      </p>
      <p>Patient details are not sent to us. They stay in this browser, the clinic's own records and the patient's phone.</p>
      <label className="check">
        <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>
          I am a health professional, or work under one, and I agree to the{" "}
          <a href={legalLink("terms")} target="_blank" rel="noopener noreferrer">
            terms of use
          </a>
          ,{" "}
          <a href={legalLink("clinic-terms")} target="_blank" rel="noopener noreferrer">
            clinic terms
          </a>{" "}
          and{" "}
          <a href={legalLink("privacy")} target="_blank" rel="noopener noreferrer">
            privacy notice
          </a>
          .
        </span>
      </label>
      <div>
        <button className="btn primary lg" disabled={!agreed} onClick={onAccept}>
          Continue
        </button>
      </div>
      <p className="terms-patient">Patient? Scan the QR code on your calendar or open the link your clinic gave you.</p>
    </div>
  );
}
