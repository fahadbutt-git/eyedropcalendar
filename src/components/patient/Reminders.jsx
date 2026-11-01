import { useEffect, useState } from "react";
import { buildICS } from "../../lib/ics.js";
import { downloadFile } from "../../lib/download.js";
import { APP_SCHEME, cancelReminders, isNative, onAppResume, scheduleReminders } from "../../lib/native.js";
import { usePersistentState } from "../../lib/storage.js";
import { Icon } from "../ui.jsx";

const isPhone = () => /iphone|ipod|android/i.test(navigator.userAgent);

// In the phone app: real notifications. In a browser: calendar alarms.
export default function Reminders({ plan, code, storeKey }) {
  const [on, setOn] = usePersistentState(`edt.alarms.${storeKey}`, false);
  const [message, setMessage] = useState("");

  // The app schedules about two weeks at a time, so top up on every open.
  useEffect(() => {
    if (!isNative || !on) return;
    const refresh = () => scheduleReminders(plan);
    refresh();
    return onAppResume(refresh);
  }, [plan, on]);

  const turnOn = async () => {
    const result = await scheduleReminders(plan, { ask: true });
    setOn(result.ok);
    setMessage(result.denied ? "Notifications are off for this app. Turn them on in your phone's Settings, then try again." : "");
  };
  const turnOff = async () => {
    await cancelReminders();
    setOn(false);
  };

  return (
    <section className="card card-b stack" style={{ gap: 12 }} aria-labelledby="rem-h">
      <h2 id="rem-h" className="pt-h2">
        Reminders
      </h2>
      {isNative && on && (
        <>
          <p>Reminders are on. Your phone will alert you at each dose time.</p>
          <button className="btn" onClick={turnOff}>
            Turn reminders off
          </button>
        </>
      )}
      {isNative && !on && (
        <>
          <p>Get an alert on this phone at each dose time.</p>
          <button className="btn primary" onClick={turnOn}>
            {Icon.bell} Turn on reminders
          </button>
        </>
      )}
      {!isNative && (
        <>
          <p>Add an alarm to your phone&apos;s calendar for every dose in this plan.</p>
          <button className="btn primary" onClick={() => downloadFile("eye-drop-reminders.ics", buildICS(plan), "text/calendar")}>
            {Icon.bell} Add alarms to my calendar
          </button>
          <p className="small muted">Open the file that downloads and choose Add All.</p>
          {isPhone() && (
            <a className="small" href={`${APP_SCHEME}://p/${code}`}>
              Have the Eye Drop Tracker app? Open this plan in the app
            </a>
          )}
        </>
      )}
      {message && (
        <p className="notice warn small" role="alert">
          {message}
        </p>
      )}
    </section>
  );
}
