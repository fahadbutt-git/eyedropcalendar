import { doseTimes, fmtTime } from "../../lib/times.js";

// How-to steps, suggested times and the QR code, written for the patient.
export default function Instructions({ items, wake, bed, qr }) {
  const isBedtime = ({ entry, med }) => entry.mode !== "taper" && entry.freq === 1 && med?.qhs;
  const freqs = new Set();
  items.forEach((it) => {
    if (it.entry.mode === "taper") it.entry.steps.forEach((s) => freqs.add(s.freq));
    else if (!isBedtime(it)) freqs.add(it.entry.freq);
  });
  const bedtime = items.filter(isBedtime).map((it) => it.entry.brand);
  const has = (form) => items.some((it) => it.med?.form === form);

  return (
    <div className="sheet-foot">
      <div>
        <h3>How to use your drops</h3>
        <ol>
          <li>Wash your hands. Tilt your head back and gently pull down your lower eyelid.</li>
          <li>Squeeze one drop into the pocket. Do not let the bottle touch your eye.</li>
          <li>Close your eye and press gently on the inner corner for 1 minute.</li>
          {items.length > 1 && <li>Wait at least 5 minutes between different drops.</li>}
          {has("suspension") && <li>Shake bottles marked &quot;shake well&quot; before each use.</li>}
          {has("gel") && <li>Use gel drops last, at least 10 minutes after other drops.</li>}
          <li>Tick a box each time you use a drop. Bring this sheet to your next visit.</li>
        </ol>
      </div>
      <div>
        <h3>Suggested times</h3>
        <ul>
          {[...freqs]
            .sort((a, b) => a - b)
            .map((f) => (
              <li key={f}>
                {f === 1 ? "Once" : `${f} times`} a day: {doseTimes(f, wake, bed).map(fmtTime).join(", ")}
              </li>
            ))}
          {bedtime.length > 0 && (
            <li>
              At bedtime, {fmtTime(doseTimes(1, wake, bed, true)[0])}: {bedtime.join(", ")}
            </li>
          )}
        </ul>
      </div>
      {qr && (
        <div className="qr-box">
          <img src={qr} alt="QR code that opens this drop plan on a phone" />
          <div>
            <b>Reminders on your phone</b>
            <div>Scan with your phone camera to see today&apos;s drops and set alarms.</div>
          </div>
        </div>
      )}
    </div>
  );
}
