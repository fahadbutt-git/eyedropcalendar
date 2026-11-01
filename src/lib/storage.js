import { useEffect, useState } from "react";

// Persists state in this browser only. Nothing is sent to a server.
// "local" survives restarts (formulary, prescriber details).
// "session" is cleared when the tab is closed (patient and regimen).
export function usePersistentState(key, initial, kind = "local") {
  const store = () => (kind === "session" ? window.sessionStorage : window.localStorage);
  const [value, setValue] = useState(() => {
    try {
      const raw = store().getItem(key);
      return raw ? JSON.parse(raw) : typeof initial === "function" ? initial() : initial;
    } catch {
      return typeof initial === "function" ? initial() : initial;
    }
  });
  useEffect(() => {
    try {
      store().setItem(key, JSON.stringify(value));
    } catch {
      /* storage unavailable; keep working in memory */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue];
}
