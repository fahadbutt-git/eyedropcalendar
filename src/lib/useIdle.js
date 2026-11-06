import { useEffect, useRef } from "react";

const EVENTS = ["pointerdown", "keydown", "scroll"];
const STAMP = "edt.lastActive";

const readStamp = () => {
  try {
    return Number(sessionStorage.getItem(STAMP)) || 0;
  } catch {
    return 0;
  }
};
const writeStamp = (t) => {
  try {
    sessionStorage.setItem(STAMP, String(t));
  } catch {
    // Storage is off. The timer below still works for this page.
  }
};

// Calls `onIdle` once the page has gone `ms` without a tap, key or scroll,
// while `active` is true. The last use is stamped in the tab's storage, so a
// tab that Chrome brings back (reopen closed tab, restore on start) clears at
// once if it has already been idle that long.
export function useIdle(active, ms, onIdle) {
  const callback = useRef(onIdle);
  useEffect(() => {
    callback.current = onIdle;
  });
  useEffect(() => {
    if (!active) return;
    const stamped = readStamp();
    if (stamped && Date.now() - stamped >= ms) {
      callback.current();
      return;
    }
    let last = Date.now();
    writeStamp(last);
    const touch = () => {
      const now = Date.now();
      if (now - last > 5000) writeStamp(now);
      last = now;
    };
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => Date.now() - last >= ms && callback.current(), Math.min(ms, 30000));
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [active, ms]);
}
