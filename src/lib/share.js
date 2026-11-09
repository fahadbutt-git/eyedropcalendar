// The phone link. The plan travels in the part of the URL after "#", which
// browsers never send to a server. It holds the drugs, eyes, doses and dates
// only, never the patient's name, date of birth, healthcare number or address.
import { isValidISO } from "./dates.js";
import { MAX_DROPS, cleanEntry, cleanMed, isClockTime } from "./validate.js";
import { planId } from "./hash.js";

const toBase64Url = (s) =>
  btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const fromBase64Url = (s) =>
  new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/")), (c) => c.charCodeAt(0)));

const MODES = { o: "ongoing", d: "duration", t: "taper" };
const MAX_CODE = 8000;

// Version 2 links carry a per-patient code (n), so two patients on the same
// plan never share check marks, and a check code (c) over everything else,
// so a damaged or altered link is refused instead of showing a different plan.
const sum = (o) => planId(JSON.stringify(o));
const NONCE = /^[a-z0-9]{4,16}$/;
export const newNonce = () => Math.random().toString(36).slice(2, 10).padEnd(8, "0");

export function encodeRegimen({ entries, formulary, start, wake, bed, nonce = "" }) {
  const e = entries.map((x) => {
    const m = formulary.find((f) => f.brand === x.brand) || {};
    return [
      x.brand, m.generic || "", m.cap || "", m.form || "solution", m.qhs ? 1 : 0,
      x.eye, x.drops, x.mode[0], x.freq, x.durationDays, x.startDay,
      x.mode === "taper" ? x.steps.map((s) => [s.freq, s.days]) : 0,
    ];
  });
  const body = { v: 2, n: NONCE.test(nonce) ? nonce : "anon0000", s: start, w: wake, b: bed, e };
  return toBase64Url(JSON.stringify({ ...body, c: sum(body) }));
}

// Throws on anything that is not a well-formed plan.
export function decodeRegimen(code) {
  if (typeof code !== "string" || code.length > MAX_CODE || !/^[\w-]+$/.test(code)) throw new Error("Invalid link");
  const o = JSON.parse(fromBase64Url(code));
  if (o?.v === 2) {
    const { c, ...body } = o;
    if (typeof c !== "string" || c !== sum(body) || !NONCE.test(o.n)) throw new Error("Invalid plan");
  }
  const year = Number(String(o?.s).slice(0, 4));
  if (!(year >= 2000 && year <= 2100) || o.w === o.b) throw new Error("Invalid plan");
  if (!o || ![1, 2].includes(o.v) || !isValidISO(o.s) || !isClockTime(o.w) || !isClockTime(o.b) || !Array.isArray(o.e)) {
    throw new Error("Invalid plan");
  }
  if (!o.e.length || o.e.length > MAX_DROPS) throw new Error("Invalid plan");
  const entries = [];
  const formulary = [];
  o.e.forEach((a, i) => {
    if (!Array.isArray(a)) throw new Error("Invalid plan");
    const entry = cleanEntry(
      {
        brand: a[0], eye: a[5], drops: a[6], mode: MODES[a[7]], freq: a[8], durationDays: a[9], startDay: a[10],
        steps: Array.isArray(a[11]) ? a[11].map((s) => ({ freq: s?.[0], days: s?.[1] })) : [],
      },
      { strict: true }
    );
    const med = cleanMed({ brand: a[0], generic: a[1], cap: a[2], form: a[3], qhs: a[4] === 1 }, i + 1);
    if (!entry || !med) throw new Error("Invalid plan");
    entries.push(entry);
    formulary.push(med);
  });
  return { start: o.s, wake: o.w, bed: o.b, entries, formulary, nonce: o.v === 2 ? o.n : "" };
}

// Origin and path only, so nothing else from the clinician's address bar leaks.
export const patientLink = (code) => `${window.location.origin}${window.location.pathname}#/p/${code}`;

// Accepts a full link, a link an email client wrapped, quoted ("> ") or
// broke with "=" or a hyphen, an encoded "#", a bare code, and text before or
// after the link (such as a text message footer).
export function codeFromUrl(url) {
  let s = String(url || "")
    .replace(/[\u200B-\u200D\uFEFF\u00AD]/g, "")
    .replace(/=\r?\n/g, "")
    .replace(/\r?\n[ \t]*(?:>[ \t]?)*/g, "");
  try {
    s = s.replace(/%23/gi, "#").replace(/%2F/gi, "/");
  } catch {
    // Leave it as typed.
  }
  // A chart note writes the link in 64-character lines. A paste box or a
  // browser can turn those line breaks into spaces, so a full line followed
  // by more of the code is joined again.
  s = s.replace(/\S*(?:#\/p\/|:\/\/p\/|\/p\/)[\w-]+(?:[ \t]+[\w-]+)+/, (run) => {
    const pieces = run.split(/[ \t]+/);
    let i = 1;
    while (i < pieces.length && pieces[i - 1].length === 64) i++;
    return [pieces.slice(0, i).join(""), ...pieces.slice(i)].join(" ");
  });
  const m = s.match(/(?:#\/p\/|:\/\/p\/|\/p\/)([\w-]+)/);
  if (m) return m[1];
  const bare = s.trim();
  return /^[\w-]{40,}$/.test(bare) ? bare : null;
}
