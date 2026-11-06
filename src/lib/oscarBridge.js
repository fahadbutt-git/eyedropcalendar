// Talks to the Eye Drop Tracker for Oscar extension when it is installed.
// The extension passes in drops read from an Oscar chart, and takes the
// finished chart note back to that chart. Messages stay inside this browser
// tab: only messages from this page's own origin are read, and the plan
// never travels in the address bar.
import { useEffect, useRef, useState } from "react";

const post = (data) => window.postMessage({ source: "edt-page", ...data }, window.location.origin);
const fromExtension = (e) => e.source === window && e.origin === window.location.origin && e.data?.source === "edt-extension";
const WAIT_MS = 15000;

export function useOscarBridge(onImport) {
  const [available, setAvailable] = useState(() => document.documentElement.dataset.oscarBridge === "1");
  const handler = useRef(onImport);
  const waiting = useRef(new Map());
  useEffect(() => {
    handler.current = onImport;
  });

  useEffect(() => {
    const listen = (e) => {
      if (!fromExtension(e)) return;
      const d = e.data;
      if (d.type === "hello") {
        setAvailable(true);
        post({ type: "ready" });
      } else if (d.type === "import") handler.current(d);
      else if (d.type === "added" && waiting.current.has(d.id)) {
        waiting.current.get(d.id)({ ok: d.ok === true, message: typeof d.message === "string" ? d.message.slice(0, 300) : "" });
        waiting.current.delete(d.id);
      }
    };
    window.addEventListener("message", listen);
    post({ type: "ready" });
    return () => window.removeEventListener("message", listen);
  }, []);

  // Only the plan code is sent. The extension writes the chart note itself
  // from it, so nothing but a well-formed plan can reach a chart.
  const addToChart = (handoff, code) =>
    new Promise((resolve) => {
      const id = Math.random().toString(36).slice(2);
      waiting.current.set(id, resolve);
      post({ type: "addToChart", id, handoff, code });
      setTimeout(() => {
        if (waiting.current.delete(id)) resolve({ ok: false, message: "The extension did not answer. Use Copy for chart note instead." });
      }, WAIT_MS);
    });

  return { available, addToChart };
}
