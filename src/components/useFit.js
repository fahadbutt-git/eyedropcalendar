import { useLayoutEffect, useRef, useState } from "react";

// Scales a fixed-width printed page down to fit its container, so the screen
// preview always looks exactly like the printout, on any screen size.
export function useFit(pageWidth) {
  const ref = useRef(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => setScale(Math.min(1, el.clientWidth / pageWidth));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [pageWidth]);
  return [ref, scale];
}
