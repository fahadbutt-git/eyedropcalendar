// The phone link. The plan travels in the part of the URL after "#", which
// browsers never send to a server. It holds the drugs, eyes, doses and dates
// only, never the patient's name, date of birth, healthcare number or address.
import { isValidISO } from "./dates.js";
import { cleanEntry, cleanMed, isClockTime } from "./validate.js";

const toBase64Url = (s) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

const MODES = { o: "ongoing", d: "duration", t: "taper" };
const MAX_CODE = 4000;

export function encodeRegimen({ entries, formulary, start, wake, bed }) {
  const e = entries.map((x) => {
    const m = formulary.find((f) => f.brand === x.brand) || {};
    return [
      x.brand, m.generic || "", m.cap || "", m.form || "solution", m.qhs ? 1 : 0,
      x.eye, x.drops, x.mode[0], x.freq, x.durationDays, x.startDay,
      x.mode === "taper" ? x.steps.map((s) => [s.freq, s.days]) : 0,
    ];
  });
  return toBase64Url(JSON.stringify({ v: 1, s: start, w: wake, b: bed, e }));
}

// Throws on anything that is not a well-formed plan.
export function decodeRegimen(code) {
  if (typeof code !== "string" || code.length > MAX_CODE || !/^[\w-]+$/.test(code)) throw new Error("Invalid link");
  const o = JSON.parse(fromBase64Url(code));
  if (!o || o.v !== 1 || !isValidISO(o.s) || !isClockTime(o.w) || !isClockTime(o.b) || !Array.isArray(o.e)) {
    throw new Error("Invalid plan");
  }
  if (!o.e.length || o.e.length > 24) throw new Error("Invalid plan");
  const entries = [];
  const formulary = [];
  o.e.forEach((a, i) => {
    if (!Array.isArray(a)) throw new Error("Invalid plan");
    const entry = cleanEntry({
      brand: a[0], eye: a[5], drops: a[6], mode: MODES[a[7]], freq: a[8], durationDays: a[9], startDay: a[10],
      steps: Array.isArray(a[11]) ? a[11].map((s) => ({ freq: s?.[0], days: s?.[1] })) : [],
    });
    const med = cleanMed({ brand: a[0], generic: a[1], cap: a[2], form: a[3], qhs: a[4] === 1 }, i + 1);
    if (!entry || !med) throw new Error("Invalid plan");
    entries.push(entry);
    formulary.push(med);
  });
  return { start: o.s, wake: o.w, bed: o.b, entries, formulary };
}

// Origin and path only, so nothing else from the clinician's address bar leaks.
export const patientLink = (code) => `${window.location.origin}${window.location.pathname}#/p/${code}`;

export const codeFromUrl = (url) => String(url || "").match(/(?:#\/p\/|:\/\/p\/)([\w-]+)/)?.[1] || null;
