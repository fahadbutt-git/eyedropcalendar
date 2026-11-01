import { useState } from "react";

export default function PatientWelcome({ onCode, codeFromUrl }) {
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
      <section className="card card-b stack" style={{ gap: 14 }}>
        <h2 className="pt-h2">Load your drop plan</h2>
        <ol className="pt-steps">
          <li>Find the calendar your eye clinic gave you.</li>
          <li>Open your phone&apos;s camera and point it at the square QR code.</li>
          <li>Tap the link that appears, then tap Open in the app.</li>
        </ol>
      </section>
      <form className="card card-b stack" style={{ gap: 12 }} onSubmit={open}>
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
            placeholder="https://eyedroptracker.com/#/p/..."
          />
        </label>
        {error && (
          <p className="notice warn small" role="alert">
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
