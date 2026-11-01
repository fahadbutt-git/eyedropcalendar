// Phone app support. On iOS and Android the same code runs inside Capacitor,
// which adds dose notifications and opens plan links from the QR code. In a
// browser every function here does nothing.
import { Capacitor } from "@capacitor/core";
import { App } from "@capacitor/app";
import { LocalNotifications } from "@capacitor/local-notifications";
import { EYES } from "./regimen.js";
import { reminderText, upcomingReminders } from "./doses.js";

export const isNative = Capacitor.isNativePlatform();
export const APP_SCHEME = "eyedroptracker";

// iOS keeps at most 64 pending notifications per app, so about two weeks of
// reminders are scheduled at a time and topped up whenever the app opens.
const WINDOW = 60;

const removeListener = (handle) => () => handle.then((h) => h.remove()).catch(() => {});

export function onPlanLink(callback) {
  if (!isNative) return () => {};
  App.getLaunchUrl()
    .then((r) => r?.url && callback(r.url))
    .catch(() => {});
  return removeListener(App.addListener("appUrlOpen", (e) => callback(e.url)));
}

export function onAppResume(callback) {
  if (!isNative) return () => {};
  return removeListener(App.addListener("resume", callback));
}

export async function cancelReminders() {
  if (!isNative) return;
  const { notifications } = await LocalNotifications.getPending();
  if (notifications.length) await LocalNotifications.cancel({ notifications: notifications.map(({ id }) => ({ id })) });
}

// Returns { ok: true } once scheduled, or { ok: false, denied } when the
// patient has not allowed notifications.
export async function scheduleReminders(plan, { ask = false } = {}) {
  if (!isNative) return { ok: false };
  let permission = await LocalNotifications.checkPermissions();
  if (permission.display !== "granted" && ask) permission = await LocalNotifications.requestPermissions();
  if (permission.display !== "granted") return { ok: false, denied: true };

  await cancelReminders();
  const upcoming = upcomingReminders(plan, new Date(), WINDOW);
  const notifications = upcoming.map(({ at, items }, i) => ({
    id: i + 1,
    ...reminderText(items, EYES),
    schedule: { at, allowWhileIdle: true },
  }));
  if (upcoming.length === WINDOW) {
    notifications.push({
      id: WINDOW + 1,
      title: "Keep your drop reminders going",
      body: "Open Eye Drop Tracker to load your next reminders.",
      schedule: { at: new Date(upcoming[WINDOW - 1].at.getTime() + 30 * 60000), allowWhileIdle: true },
    });
  }
  if (notifications.length) await LocalNotifications.schedule({ notifications });
  return { ok: true };
}
