import { fmtTime, doseTimes } from "../../lib/times.js";
import { EYES } from "../../lib/regimen.js";
import { atBedtime, patientPlanText, patientStartText } from "../../lib/wording.js";
import { CapDot, Chip } from "../ui.jsx";
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
                  {med?.cap && (
                    <>
                      <CapDot cap={med.cap} named /> ·{" "}
                    </>
                  )}
                  {med?.generic}
                  {formInfo(med?.form).tag && ` · ${formInfo(med.form).tag.toLowerCase()}`}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
