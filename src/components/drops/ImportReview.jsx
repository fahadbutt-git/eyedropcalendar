import { EYES } from "../../lib/regimen.js";

// Drops read from an Oscar chart note are a draft. Each one shows what had
// to be assumed, and the calendar and prescription stay closed until the
// clinician has checked every drop against the chart.
export default function ImportReview({ imported, drops, setReviewed }) {
  const list = drops.filter((d) => d.brand);
  if (imported.reviewed)
    return (
      <p className="notice info small import-done" role="status">
        {imported.fromLink ? "Plan opened from the link in the Oscar chart and checked." : "Drops read from the Oscar chart and checked."}{" "}
        <button className="link-btn" onClick={() => setReviewed(false)}>
          Show again
        </button>
      </p>
    );
  return (
    <section className="notice caution import-review" aria-labelledby="import-h">
      <h2 id="import-h">{imported.fromLink ? "Opened from the plan link in the Oscar chart" : "Read from the Oscar chart: check before going on"}</h2>
      <p>
        {imported.fromLink
          ? "This is the plan exactly as it was last saved, and the patient keeps their check marks. Make today's changes below, then confirm."
          : "These drops were read from the chart note. Anything listed under a drop was assumed, not written in the note. Correct the drops below, then confirm."}
      </p>
      <ol className="import-list">
        {list.map((d) => (
          <li key={d.id}>
            <b>{d.brand}</b>, {EYES[d.eye].long}
            {imported.flags[d.id]?.length > 0 ? (
              <ul>
                {imported.flags[d.id].map((f) => (
                  <li key={f}>{f}</li>
                ))}
              </ul>
            ) : (
              <span className="hint">{imported.fromLink ? " As saved." : " Written in full in the note."}</span>
            )}
          </li>
        ))}
      </ol>
      {imported.skipped.length > 0 && (
        <>
          <h3>Seen in the note but not added</h3>
          <ul>
            {imported.skipped.map((s) => (
              <li key={s.name + s.why}>
                <b>{s.name}</b>: {s.why}
              </li>
            ))}
          </ul>
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={false} onChange={() => setReviewed(true)} />
        <span>I have checked every drop, eye, frequency and date against the chart</span>
      </label>
    </section>
  );
}
