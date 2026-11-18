import { useEffect, useRef } from "react";
import { onAppResume } from "../lib/native.js";

// Calls `callback` whenever the page comes back into use: the tab is shown
// again, the window gets focus, or the phone app resumes.
export function useWhenVisible(callback) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });
  useEffect(() => {
    const run = () => document.visibilityState !== "hidden" && latest.current();
    document.addEventListener("visibilitychange", run);
    window.addEventListener("focus", run);
    const stop = onAppResume(run);
    return () => {
      document.removeEventListener("visibilitychange", run);
      window.removeEventListener("focus", run);
      stop();
    };
  }, []);
}
