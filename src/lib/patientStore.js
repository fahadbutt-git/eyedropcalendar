// What the patient's phone keeps between visits. Check marks, the first day
// the plan was seen and the reminder setting belong to the patient, not to one
// version of the plan, so a changed plan from the clinic keeps them.
import { planId } from "./hash.js";
import { decodeRegimen } from "./share.js";

const CURRENT = "edt.patientPlan";
const KEYS = ["taken", "seen", "alarms"];

// Storage key for a plan. Version 2 plans carry a patient code (nonce) that
// stays the same when the clinic changes the plan.
export const patientKey = (plan, code) => (plan.nonce ? `p-${plan.nonce}` : planId(code));

const read = (key) => {
  try {
    const raw = localStorage.getItem(key);
    return raw == null ? undefined : JSON.parse(raw);
  } catch {
    return undefined;
  }
};
const write = (key, value) => {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or blocked: the new plan starts fresh.
  }
};

// Moves what the phone kept for the old plan onto the new one. Ticks on the
// new plan win where both have one. Keeps the earlier first-seen date.
function carryOver(from, to) {
  if (from === to) return;
  const [taken, seen, alarms] = KEYS.map((k) => read(`edt.${k}.${from}`));
  const [newTaken, newSeen, newAlarms] = KEYS.map((k) => read(`edt.${k}.${to}`));
  if (taken && typeof taken === "object") {
    const merged = { ...taken };
    for (const [day, ticks] of Object.entries(newTaken || {})) merged[day] = { ...(taken[day] || {}), ...ticks };
    write(`edt.taken.${to}`, merged);
  }
  if (typeof seen === "string") write(`edt.seen.${to}`, newSeen && newSeen < seen ? newSeen : seen);
  if (typeof alarms === "boolean" && newAlarms === undefined) write(`edt.alarms.${to}`, alarms);
}

// Makes `code` this phone's current plan, bringing over the patient's history
// from the plan it replaces. Safe to call more than once.
export function adoptPlan(code, plan) {
  let previous = null;
  try {
    previous = localStorage.getItem(CURRENT);
    localStorage.setItem(CURRENT, code);
  } catch {
    return;
  }
  if (!previous || previous === code) return;
  try {
    carryOver(patientKey(decodeRegimen(previous), previous), patientKey(plan, code));
  } catch {
    // The old plan no longer opens, so there is nothing to bring over.
  }
}

export function currentPlanCode() {
  try {
    return localStorage.getItem(CURRENT);
  } catch {
    return null;
  }
}
export function forgetCurrentPlan() {
  try {
    localStorage.removeItem(CURRENT);
  } catch {
    // Nothing stored.
  }
}
