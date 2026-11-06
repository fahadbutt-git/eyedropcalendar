import { EYES } from "../../lib/regimen.js";

// Drops read from an Oscar chart note are a draft. Each one shows the
// sentence it came from and what had to be assumed, and the clinician
// confirms each drop against the chart. The calendar and prescription stay
// closed until every drop read from the chart is confirmed.
export default function ImportReview({ imported, drops, setReviewed, setConfirmed }) {
  const list = drops.filter((d) => d.brand);
  // Only drops read from the chart need a tick. Drops added by hand are the
  // clinician's own.
  const fromChart = list.filter((d) => d.id in imported.flags);
  const confirmed = new Set(imported.confirmed || []);
  const toggle = (id, on) => {
    const next = new Set(confirmed);
    if (on) next.add(id);
    else next.delete(id);
    setConfirmed([...next], fromChart.every((d) => next.has(d.id)));
  };

  if (imported.reviewed)
    return (
      <p className="notice info small import-done" role="status">
        {imported.fromLink ? "Plan opened from the link in the Oscar chart and checked." : "Drops read from the Oscar chart and checked."}{" "}
        <button className="link-btn" onClick={() => setReviewed(false)}>
          Show again
        </button>
      </p>
    );

  if (imported.fromLink)
    return (
      <section className="notice caution import-review" aria-labelledby="import-h">
        <h2 id="import-h">Opened from the plan link in the Oscar chart</h2>
        <p>This is the plan exactly as it was last saved, and the patient keeps their check marks. Make today's changes below, then confirm.</p>
        <label className="check">
          <input type="checkbox" checked={false} onChange={() => setReviewed(true)} />
          <span>I have checked every drop, eye, frequency and date against the chart</span>
        </label>
      </section>
    );

  const left = fromChart.filter((d) => !confirmed.has(d.id)).length;
  return (
    <section className="notice caution import-review" aria-labelledby="import-h">
      <h2 id="import-h">Read from the Oscar chart: check each drop</h2>
      <p>Each drop shows the sentence it was read from. Anything listed under a drop was assumed, not written in the note. Correct the drop below if needed, then tick it.</p>
      <ol className="import-list">
        {fromChart.map((d) => {
          const flags = imported.flags[d.id] || [];
          const strength = flags.some((f) => f.startsWith("Strength:"));
          return (
            <li key={d.id}>
              <b>{d.brand}</b>, {EYES[d.eye].long}
              {imported.sources?.[d.id] && <q className="import-source">{imported.sources[d.id]}</q>}
              {flags.length > 0 ? (
                <ul>
                  {flags.map((f) => (
                    <li key={f}>{f}</li>
                  ))}
                </ul>
              ) : (
                <span className="hint"> Written in full in the note.</span>
              )}
              <label className="check">
                <input type="checkbox" checked={confirmed.has(d.id)} onChange={(e) => toggle(d.id, e.target.checked)} />
                <span>{strength ? "Checked against the chart, including the strength" : "Checked against the chart"}</span>
              </label>
            </li>
          );
        })}
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
      <p className="hint" role="status">
        {left ? `${left} of ${fromChart.length} drop${fromChart.length > 1 ? "s" : ""} still to check.` : "All drops checked."}
      </p>
    </section>
  );
}
