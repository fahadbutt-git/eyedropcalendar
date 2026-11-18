import { useEffect, useState } from "react";
import { useWhenVisible } from "./useWhenVisible.js";

// The current time, refreshed every 30 seconds and whenever the page comes
// back into use, so "today" is always the real today.
export function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);
  useWhenVisible(() => setNow(new Date()));
  return now;
}
