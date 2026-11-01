import { useEffect, useRef } from "react";

const EVENTS = ["pointerdown", "keydown", "scroll"];

// Calls `onIdle` once the page has gone `ms` without a tap, key or scroll,
// while `active` is true.
export function useIdle(active, ms, onIdle) {
  const callback = useRef(onIdle);
  callback.current = onIdle;
  useEffect(() => {
    if (!active) return;
    let last = Date.now();
    const touch = () => (last = Date.now());
    EVENTS.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    const timer = setInterval(() => Date.now() - last >= ms && callback.current(), Math.min(ms, 30000));
    return () => {
      EVENTS.forEach((e) => window.removeEventListener(e, touch));
      clearInterval(timer);
    };
  }, [active, ms]);
}
