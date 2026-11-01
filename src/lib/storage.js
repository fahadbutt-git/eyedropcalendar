import { useEffect, useState } from "react";

// State kept in this browser only. Nothing is sent to a server.
// "local" survives restarts (formulary, prescriber details, phone check marks).
// "session" is cleared when the tab closes (patient details and drops).
// `check` can reject or repair what was stored.
export function usePersistentState(key, initial, { kind = "local", check = (v) => v } = {}) {
  const store = () => (kind === "session" ? window.sessionStorage : window.localStorage);
  const fallback = () => (typeof initial === "function" ? initial() : initial);
  const [value, setValue] = useState(() => {
    try {
      const raw = store().getItem(key);
      return raw == null ? fallback() : (check(JSON.parse(raw)) ?? fallback());
    } catch {
      return fallback();
    }
  });
  useEffect(() => {
    try {
      store().setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: keep working from memory.
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);
  return [value, setValue];
}
