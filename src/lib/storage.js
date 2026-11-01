import { useEffect, useState } from "react";

// State kept in this browser only. Nothing is sent to a server.
// "local" survives restarts (formulary, prescriber details, phone check marks)
// and stays in step across open tabs. "session" belongs to one tab (patient
// details and drops). `check` can reject or repair what was stored.
const storeOf = (kind) => (kind === "session" ? window.sessionStorage : window.localStorage);

export function usePersistentState(key, initial, { kind = "local", check = (v) => v } = {}) {
  const fallback = () => (typeof initial === "function" ? initial() : initial);
  const read = () => {
    try {
      const raw = storeOf(kind).getItem(key);
      return raw == null ? fallback() : (check(JSON.parse(raw)) ?? fallback());
    } catch {
      return fallback();
    }
  };
  const [value, setValue] = useState(read);

  useEffect(() => {
    try {
      storeOf(kind).setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked: keep working from memory.
    }
  }, [key, kind, value]);

  // Another tab changed the same key: take its value.
  useEffect(() => {
    if (kind !== "local") return;
    const sync = (e) => e.key === key && e.newValue != null && setValue(read());
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, kind]);

  return [value, setValue];
}
