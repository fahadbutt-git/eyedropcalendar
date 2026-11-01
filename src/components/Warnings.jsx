// Safety prompts for the prescriber. Shown beside the drops and again on the
// calendar and prescription steps, so they are seen before anything prints.
export default function Warnings({ warnings, compact = false }) {
  if (!warnings.length) return null;
  return (
    <div className={`notice warn ${compact ? "small" : ""}`} role="status">
      <b>Check before printing</b>
      <ul>
        {warnings.map((w) => (
          <li key={w}>{w}</li>
        ))}
      </ul>
    </div>
  );
}
