import { useEffect, useMemo, useState } from "react";
import { courseLastDay } from "../../lib/calendar.js";
import { daysBetween, parseISO } from "../../lib/dates.js";
import { buildICS, eventIds } from "../../lib/ics.js";
import { downloadFile } from "../../lib/download.js";
import { APP_SCHEME, allowExactTimes, cancelReminders, isNative, onAppResume, scheduleReminders } from "../../lib/native.js";
import { usePersistentState } from "../../lib/storage.js";
import { Icon } from "../ui.jsx";

const platform = () => (/iphone|ipad|ipod/i.test(navigator.userAgent) ? "ios" : /android/i.test(navigator.userAgent) ? "android" : "other");
const HOW = {
  ios: "Open the file from the banner or your Downloads, then tap Add All.",
  android: "Open the file from your notifications or the Files app and choose your calendar. If nothing opens it, open Google Calendar on a computer and use Import.",
  other: "Open the file to add the alarms to your calendar app.",
};

// Alarms are easiest to remove when they sit in their own calendar, which
// can then be deleted in one step when the drops change.
const REMOVE = {
  ios: [
    "Before adding the file: open Calendar, tap Calendars, then Add Calendar, and name it Eye drops.",
    "When you tap Add All, choose the Eye drops calendar.",
    "To remove every alarm later: tap Calendars, tap the i next to Eye drops, then Delete Calendar.",
  ],
  android: [
    "Before adding the file: on calendar.google.com, open Settings, choose Add calendar, then Create new calendar, and name it Eye drops.",
    "When you import the file, choose the Eye drops calendar.",
    "To remove every alarm later: in Settings, choose the Eye drops calendar, then Remove calendar and Delete.",
  ],
};
const REMOVE_ONE = "Without a separate calendar, open each alarm (they start with \"Time for\" or \"Eye drop reminder\") and delete it. For a repeating alarm, choose Delete all future events.";

// In the phone app: real notifications. In a browser: calendar alarms.
export default function Reminders({ plan: shared, id, code }) {
  // In the phone app reminders start on by themselves (null means not yet set).
  const [on, setOn] = usePersistentState(`edt.alarms.${id}`, null);
  const [generic, setGeneric] = usePersistentState("edt.genericReminders", false);
  const [message, setMessage] = useState("");
  const [saved, setSaved] = useState(false);
  const [late, setLate] = useState(false);
  // The alarms last added from this phone, so a changed plan can cancel
  // the ones it no longer has.
  const [sent, setSent] = usePersistentState(`edt.icsSent.${id}`, null);
  const changed = !!sent?.code && sent.code !== code;

  // Ongoing drops never end, so the app keeps a rolling window of reminders.
  const plan = useMemo(() => {
    const start = parseISO(shared.start);
    const last = courseLastDay(shared.entries);
    return { ...shared, start, days: last == null ? Math.max(0, daysBetween(start, new Date())) + 400 : last + 1 };
  }, [shared]);

  useEffect(() => {
    if (isNative && on === null) turnOn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [on]);

  useEffect(() => {
    if (!isNative || !on) return;
    const refresh = () => scheduleReminders(plan, { generic });
    refresh();
    return onAppResume(refresh);
  }, [plan, on, generic]);

  const turnOn = async () => {
    let result;
    try {
      result = await scheduleReminders(plan, { ask: true, generic });
    } catch {
      result = { ok: false };
    }
    setOn(result.ok);
    setLate(!!result.late);
    setMessage(
      result.ok ? "" : result.denied ? "Notifications are off for this app. Turn them on in your phone's Settings, then try again." : "Reminders could not be set. Try again."
    );
  };
  const turnOff = async () => {
    await cancelReminders();
    setOn(false);
  };
  const download = () => {
    // Events are named for the patient, so a new plan from the clinic updates
    // the same alarms rather than adding a second set.
    const fresh = new Set(eventIds(buildICS({ ...plan, id, generic })));
    const cancel = (Array.isArray(sent?.uids) ? sent.uids : []).filter((u) => typeof u === "string" && !fresh.has(u)).slice(0, 2000);
    downloadFile("eye-drop-reminders.ics", buildICS({ ...plan, id, generic, cancel }), "text/calendar");
    setSent({ code, uids: [...fresh] });
    setSaved(true);
  };

  return (
    <section className="pt-card" aria-labelledby="rem-h">
      <h2 id="rem-h">Reminders</h2>
      {isNative ? (
        on ? (
          <>
            <p>Reminders are on. Your phone will alert you at each dose time.</p>
            {late && (
              <p className="notice warn">
                Your phone may send reminders a few minutes late.{" "}
                <button className="link-btn" onClick={async () => (await allowExactTimes(), turnOn())}>
                  Allow exact times
                </button>
              </p>
            )}
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
          {changed && (
            <p className="notice warn" role="status">
              Your plan has changed since you last added alarms. Add the new file below. Some calendars then remove the old alarms by themselves. If old alarms still go off, remove them as shown under How to remove old alarms.
            </p>
          )}
          <p>Add an alarm to your phone&apos;s calendar for every dose in this plan.</p>
          <button className="btn primary" onClick={download}>
            {Icon.bell} Add alarms to my calendar
          </button>
          {saved && (
            <p className="pt-note" role="status">
              The calendar file is saved. {HOW[platform()]} If your drops change, remove the old alarms first (see below).
            </p>
          )}
          <details className="more remove-alarms">
            <summary>How to remove old alarms</summary>
            {Object.entries(REMOVE)
              .sort(([a]) => (a === platform() ? -1 : 0))
              .map(([key, steps]) => (
                <div key={key}>
                  <h3 className="small">{key === "ios" ? "iPhone" : "Android"}</h3>
                  <ol className="small">
                    {steps.map((t) => (
                      <li key={t}>{t}</li>
                    ))}
                  </ol>
                </div>
              ))}
            <p className="small">{REMOVE_ONE}</p>
          </details>
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
