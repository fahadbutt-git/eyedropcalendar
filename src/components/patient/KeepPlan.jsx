import { useState } from "react";
import { SITE_URL } from "../../config.js";
import { CopyButton } from "../ui.jsx";

// A way back to the plan if the printed calendar is lost or the phone is
// changed. The plan lives only in its link, so the patient sends that link to
// themselves or to someone who helps them. The link holds drops and dates,
// never a name.
export default function KeepPlan({ code }) {
  const link = `${SITE_URL}/#/p/${code}`;
  const [note, setNote] = useState("");
  const canShare = typeof navigator.share === "function";
  const share = async () => {
    try {
      await navigator.share({ title: "My eye drop plan", url: link });
      setNote("");
    } catch (e) {
      if (e?.name !== "AbortError") setNote("Sharing did not open. Use Copy link instead.");
    }
  };
  return (
    <section className="pt-card" aria-labelledby="keep-h">
      <h2 id="keep-h">Keep a copy of your plan</h2>
      <p>If you lose your calendar or get a new phone, this link opens your plan again. Send it to yourself by text or email, or to someone who helps you with your drops.</p>
      <div className="row">
        {canShare && (
          <button type="button" className="btn" onClick={share}>
            Send the link
          </button>
        )}
        <CopyButton text={link} className={canShare ? "btn sm" : "btn"}>
          Copy link
        </CopyButton>
      </div>
      {note && (
        <p className="notice warn small" role="status">
          {note}
        </p>
      )}
      <p className="pt-note small">Anyone with this link can see your drops and dates, but not your name. Send it only to people you trust. Your eye clinic can also print your calendar again from your chart.</p>
    </section>
  );
}
