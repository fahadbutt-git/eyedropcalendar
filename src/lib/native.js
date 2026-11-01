// Phone app support. On iOS and Android the same web code runs inside
// Capacitor, which adds real dose alarms (local notifications) and lets the
// QR link open the app. In a browser these functions do nothing.
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { addDays, dosesOnDay, doseTimes, EYES } from "./regimen.js";

export const isNative = Capacitor.isNativePlatform();
export const APP_SCHEME = "eyedroptracker";

// Calls back with the URL whenever the app is opened from a plan link.
export function onPlanLink(cb) {
  if (!isNative) return () => {};
  const sub = CapApp.addListener("appUrlOpen", (e) => cb(e.url));
  CapApp.getLaunchUrl?.()
    .then((r) => r?.url && cb(r.url))
    .catch(() => {});
  return () => sub.then((s) => s.remove()).catch(() => {});
}

// iOS keeps at most 64 pending notifications, so reminders are scheduled as a
// rolling window and refreshed every time the app is opened.
const WINDOW = 60;

export function upcomingDoseGroups({ entries, formulary, start, days, wake, bed, from = new Date(), limit = WINDOW }) {
  const out = [];
  const startIdx = Math.max(0, Math.floor((from - start) / 86400000) - 1);
  for (let i = startIdx; i < days && out.length < limit; i++) {
    const date = addDays(start, i);
    const byTime = new Map();
    entries.forEach((e) => {
      const n = dosesOnDay(e, i);
      if (!n) return;
      const qhs = !!formulary.find((m) => m.brand === e.brand)?.qhs;
      doseTimes(n, wake, bed, qhs).forEach((t) => {
        if (!byTime.has(t)) byTime.set(t, []);
        byTime.get(t).push(e);
      });
    });
    [...byTime.keys()].sort((a, b) => a - b).forEach((t) => {
      const at = new Date(date.getFullYear(), date.getMonth(), date.getDate(), Math.floor(t / 60), t % 60);
      if (at > from && out.length < limit) out.push({ at, list: byTime.get(t) });
    });
  }
  return out;
}

export async function remindersAllowed() {
  if (!isNative) return false;
  const p = await LocalNotifications.checkPermissions();
  return p.display === "granted";
}

export async function scheduleReminders(plan, { ask = false } = {}) {
  if (!isNative) return { ok: false };
  let perm = await LocalNotifications.checkPermissions();
  if (perm.display !== "granted" && ask) perm = await LocalNotifications.requestPermissions();
  if (perm.display !== "granted") return { ok: false, denied: true };

  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });

  const groups = upcomingDoseGroups(plan);
  const notifications = groups.map((g, i) => ({
    id: i + 1,
    title: g.list.length === 1 ? `Time for ${g.list[0].brand}` : `Time for ${g.list.length} eye drops`,
    body:
      g.list.map((e) => `${e.brand}: ${e.drops} drop${e.drops > 1 ? "s" : ""}, ${EYES[e.eye].long}`).join("\n") +
      (g.list.length > 1 ? "\nWait 5 minutes between drops." : ""),
    schedule: { at: g.at, allowWhileIdle: true },
  }));
  // A last reminder to open the app so the next window gets scheduled.
  const last = groups[groups.length - 1];
  if (groups.length >= WINDOW && last) {
    notifications.push({
      id: WINDOW + 1,
      title: "Keep your drop reminders going",
      body: "Open Eye Drop Tracker to load your next reminders.",
      schedule: { at: new Date(last.at.getTime() + 30 * 60000) },
    });
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return { ok: true, count: groups.length, until: last?.at };
}

export async function cancelReminders() {
  if (!isNative) return;
  const pending = await LocalNotifications.getPending();
  if (pending.notifications.length) await LocalNotifications.cancel({ notifications: pending.notifications.map((n) => ({ id: n.id })) });
}

export function onAppResume(cb) {
  if (!isNative) return () => {};
  const sub = CapApp.addListener("resume", cb);
  return () => sub.then((s) => s.remove()).catch(() => {});
}
