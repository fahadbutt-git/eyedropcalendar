import { useEffect, useMemo, useState } from "react";
import { courseLastDay } from "../../lib/calendar.js";
import { daysBetween, parseISO } from "../../lib/dates.js";
import { buildICS } from "../../lib/ics.js";
import { downloadFile } from "../../lib/download.js";
import { APP_SCHEME, cancelReminders, isNative, onAppResume, scheduleReminders } from "../../lib/native.js";
import { usePersistentState } from "../../lib/storage.js";
import { Icon } from "../ui.jsx";

const platform = () => (/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : /android/i.test(navigator.userAgent) ? "android" : "other");
const HOW = {
  ios: "Open the file from the banner or your Downloads, then tap Add All.",
  android: "Open the file from your notifications or the Files app and choose your calendar. If nothing opens it, open Google Calendar on a computer and use Import.",
  other: "Open the file to add the alarms to your calendar app.",
};

// In the phone app: real notifications. In a browser: calendar alarms.
export default function Reminders({ plan: shared, id, code }) {
  const [on, setOn] = usePersistentState(`edt.alarms.${id}`, false);
  const [generic, setGeneric] = usePersistentState("edt.genericReminders", false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);

  // Ongoing drops never end, so the app keeps a rolling window of reminders.
  const plan = useMemo(() => {
    const start = parseISO(shared.start);
    const last = courseLastDay(shared.entries);
    return { ...shared, start, days: last == null ? Math.max(0, daysBetween(start, new Date())) + 400 : last + 1 };
  }, [shared]);

  useEffect(() => {
    if (!isNative || !on) return;
    const refresh = () => scheduleReminders(plan, { generic });
    refresh();
    return onAppResume(refresh);
  }, [plan, on, generic]);

  const turnOn = async () => {
    const result = await scheduleReminders(plan, { ask: true, generic });
    setOn(result.ok);
    setMessage(result.denied ? "Notifications are off for this app. Turn them on in your phone's Settings, then try again." : "");
  };
  const turnOff = async () => {
    await cancelReminders();
    setOn(false);
  };
  const download = () => {
    // Events are named for the patient, so a new plan from the clinic updates
    // the same alarms rather than adding a second set.
    downloadFile("eye-drop-reminders.ics", buildICS({ ...plan, id: shared.nonce ? `p-${shared.nonce}` : id, generic }), "text/calendar");
    setSaved(true);
  };

  return (
    <section className="pt-card" aria-labelledby="rem-h">
      <h2 id="rem-h">Reminders</h2>
      {isNative ? (
        on ? (
          <>
            <p>Reminders are on. Your phone will alert you at each dose time.</p>
            <button className="btn" onClick={turnOff}>
              Turn reminders off
            </button>
          </>
        ) : (
          <>
            <p>Get an alert on this phone at each dose time.</p>
            <button className="btn primary" onClick={turnOn}>
              {Icon.bell} Turn on reminders
            </button>
          </>
        )
      ) : (
        <>
          <p>Add an alarm to your phone&apos;s calendar for every dose in this plan.</p>
          <button className="btn primary" onClick={download}>
            {Icon.bell} Add alarms to my calendar
          </button>
          {saved && (
            <p className="pt-note" role="status">
              The calendar file is saved. {HOW[platform()]} If your drops change, delete the old &quot;Eye drops&quot; alarms first.
            </p>
          )}
          {platform() !== "other" && (
            <a className="small" href={`${APP_SCHEME}://p/${code}`}>
              Have the Eye Drop Tracker app? Open this plan in the app
            </a>
          )}
        </>
      )}
      <label className="check">
        <input type="checkbox" checked={generic} onChange={(e) => setGeneric(e.target.checked)} />
        <span>Hide drug names in reminders</span>
      </label>
      {message && (
        <p className="notice warn" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
