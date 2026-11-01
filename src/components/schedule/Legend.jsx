import { fmtTime, doseTimes } from "../../lib/times.js";
import { patientPlanText, patientStartText } from "../../lib/wording.js";
import { CapDot, Chip } from "../ui.jsx";

const EYE_PHRASE = { OD: "right eye", OS: "left eye", OU: "both eyes" };

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
              <b>{e.brand}</b> <span className="legend-eye">{EYE_PHRASE[e.eye]}</span>
            </div>
            {!compact && (
              <>
                <div className="legend-plan">
                  {e.drops} drop{e.drops > 1 ? "s" : ""} {patientPlanText(e, med?.qhs)}
                  {e.startDay > 1 && `, ${patientStartText(e, start)}`}
                  {e.mode !== "taper" && (
                    <span className="muted"> ({doseTimes(e.freq, wake, bed, med?.qhs).map(fmtTime).join(", ")})</span>
                  )}
                </div>
                <div className="legend-sub">
                  {med?.cap && (
                    <>
                      <CapDot cap={med.cap} /> cap ·{" "}
                    </>
                  )}
                  {med?.generic}
                  {med?.form === "suspension" && " · shake well"}
                </div>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
