import { fmtTime, doseTimes } from "../../lib/times.js";
import { EYES } from "../../lib/regimen.js";
import { atBedtime, patientPlanText, patientStartText } from "../../lib/wording.js";
import { Chip } from "../ui.jsx";
import { CAP_COLOURS } from "../../data/formulary.js";
import { formInfo } from "../../data/forms.js";


// Full legend for page 1 or the cover page; compact one-line version on
// calendar pages so they keep room for the grid.
export default function Legend({ items, start, wake, bed, compact = false }) {
  return (
    <div className={`legend ${compact ? "compact" : ""}`}>
      {items.map(({ entry: e, index, med, chip }) => (
        <div className="legend-item" key={index}>
          <Chip n={index + 1} style={chip} />
          <div>
            <div>
              <b>{e.brand}</b> <span className="legend-eye">{EYES[e.eye].long}</span>
              {compact && med?.cap && CAP_COLOURS[med.cap] && <span className="legend-cap"> · usually {CAP_COLOURS[med.cap].label.toLowerCase()} cap</span>}
            </div>
            {!compact && (
              <>
                <div className="legend-plan">
                  {e.drops} drop{e.drops > 1 ? "s" : ""} {patientPlanText(e, med?.qhs)}
                  {e.startDay > 1 && `, ${patientStartText(e, start)}`}
                  {e.mode !== "taper" && (
                    <span className="legend-times"> ({doseTimes(e.freq, wake, bed, atBedtime(e, med?.qhs)).map(fmtTime).join(", ")})</span>
                  )}
                </div>
                <div className="legend-sub">
                  {med?.generic}
                  {formInfo(med?.form).tag && ` · ${formInfo(med.form).tag.toLowerCase()}`}
                </div>
                {/* Pharmacies may dispense a generic with a different cap, so
                    the patient or pharmacist writes in the bottle's own cap. */}
                <div className="legend-mycap">
                  {med?.cap && CAP_COLOURS[med.cap] && <span>Usually a {CAP_COLOURS[med.cap].label.toLowerCase()} cap. </span>}
                  <span>
                    Cap on my bottle: <span className="write-in" aria-hidden="true" />
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
