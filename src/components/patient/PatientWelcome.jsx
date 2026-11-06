import { useState } from "react";
import { SITE_URL } from "../../config.js";
import { codeFromUrl } from "../../lib/share.js";

// First screen of the phone app before a plan has been opened.

export default function PatientWelcome({ onCode }) {
  const [text, setText] = useState("");
  const [error, setError] = useState("");
  const open = (e) => {
    e.preventDefault();
    const code = codeFromUrl(text.trim());
    if (code) onCode(code);
    else setError("That does not look like a plan link. Copy the whole link your clinic sent, or scan the QR code.");
  };
  return (
    <div className="pt stack">
      <div>
        <h1>Welcome</h1>
        <p className="lede">This app reminds you when to use your eye drops and keeps track of each dose.</p>
      </div>
      <section className="pt-card">
        <h2>Load your drop plan</h2>
        <ol className="pt-steps">
          <li>Find the calendar your eye clinic gave you.</li>
          <li>Open your phone&apos;s camera and point it at the square QR code.</li>
          <li>Tap the link that appears, then tap Open in the app.</li>
        </ol>
        <p className="pt-note small">Lost your calendar? Call your eye clinic. They can print it again from your chart, or send you the link.</p>
      </section>
      <form className="pt-card" onSubmit={open}>
        <label className="field" htmlFor="plan-link">
          <span>Or paste the link from your clinic</span>
          <input
            id="plan-link"
            className="input"
            inputMode="url"
            autoCapitalize="off"
            autoCorrect="off"
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setError("");
            }}
            placeholder={`${SITE_URL}/#/p/...`}
          />
        </label>
        {error && (
          <p className="notice warn" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary" type="submit" disabled={!text.trim()}>
          Open my plan
        </button>
      </form>
    </div>
  );
}
