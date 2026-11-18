// The clinician's working state: blank values, defaults, and the checks that
// repair anything read back from browser storage, so a bad stored value can
// never break a page.
import { isValidISO, todayISO } from "../../lib/dates.js";
import { newId } from "../../lib/regimen.js";
import { newNonce } from "../../lib/share.js";
import { isClockTime } from "../../lib/times.js";
import { MAX_DROPS, cleanEntry, cleanText, isSignatureImage } from "../../lib/validate.js";

export const BLANK_PATIENT = { name: "", dob: "", hcn: "", address: "" };
export const BLANK_OWNER = { name: "", dob: "" };
export const BLANK_PRESCRIBER = { name: "", license: "", clinic: "", street: "", city: "", phone: "", fax: "" };
// Every prescriber field is a string, whatever an older version stored.
export const checkPrescriber = (p) =>
  p && typeof p === "object" ? Object.fromEntries(Object.keys(BLANK_PRESCRIBER).map((k) => [k, typeof p[k] === "string" ? p[k] : ""])) : null;
export const blankRx = () => ({ date: todayISO(), notes: "", items: {} });
// Signatures stored by older versions (sig, esign) are dropped.
export const checkRx = (r) =>
  r && typeof r === "object"
    ? {
        date: r.date === "" || isValidISO(r.date) ? r.date : todayISO(),
        dateEdited: r.dateEdited === true,
        notes: typeof r.notes === "string" ? r.notes.slice(0, 500) : "",
        items: r.items && typeof r.items === "object" ? r.items : {},
      }
    : null;

export const defaultSettings = () => ({
  start: todayISO(),
  wake: "08:00",
  bed: "22:00",
  months: 1,
  pages: { calendar: true, chart: false, checklist: false },
  qr: true,
  capColours: true,
  size: "standard",
  nonce: newNonce(),
  // The start date of a plan opened from a link, so moving it can warn that
  // tapers and courses restart.
  opened: "",
});

export function checkSettings(s) {
  if (!s || typeof s !== "object") return null;
  const d = defaultSettings();
  const pages = s.pages && typeof s.pages === "object" ? s.pages : d.pages;
  return {
    start: isValidISO(s.start) ? s.start : d.start,
    wake: isClockTime(s.wake) ? s.wake : d.wake,
    bed: isClockTime(s.bed) ? s.bed : d.bed,
    months: [1, 2, 3].includes(Number(s.months)) ? Number(s.months) : 1,
    pages: { calendar: pages.calendar === true, chart: pages.chart === true, checklist: pages.checklist === true },
    qr: s.qr !== false,
    capColours: s.capColours !== false,
    // "standard" is two weeks a page, "large" one week, "compact" a month.
    // Older saved settings had only a large print tick box.
    size: ["standard", "large", "compact"].includes(s.size) ? s.size : s.large === true ? "large" : "standard",
    nonce: typeof s.nonce === "string" && /^[a-z0-9]{4,16}$/.test(s.nonce) ? s.nonce : d.nonce,
    opened: isValidISO(s.opened) ? s.opened : "",
  };
}

const cleanPerson = (p) => ({ name: cleanText(p?.name, 160), dob: isValidISO(p?.dob) ? p.dob : "" });

export const checkOwner = (o) => (o && typeof o === "object" ? cleanPerson(o) : null);

export const checkDrops = (list) =>
  Array.isArray(list)
    ? list.slice(0, MAX_DROPS).flatMap((d) => {
        const clean = d?.brand ? cleanEntry(d) : null;
        return clean ? [{ ...clean, id: typeof d.id === "string" ? d.id : newId() }] : [];
      })
    : null;

export const cleanFlags = (v) => (Array.isArray(v) ? v.map((f) => cleanText(f, 300)).filter(Boolean).slice(0, 10) : []);
export const cleanSkipped = (v) =>
  (Array.isArray(v) ? v : [])
    .map((s) => ({ name: cleanText(s?.name, 60), why: cleanText(s?.why, 120) }))
    .filter((s) => s.name && s.why)
    .slice(0, 20);

// The record of drops read from Oscar, until the clinician has checked them.
const cleanMap = (v, clean) =>
  Object.fromEntries(Object.entries(v && typeof v === "object" ? v : {}).slice(0, 20).map(([k, x]) => [cleanText(k, 40), clean(x)]));
export function checkImport(v) {
  if (!v || typeof v !== "object" || !v.flags || typeof v.flags !== "object") return null;
  return {
    handoff: cleanText(v.handoff, 64),
    flags: cleanMap(v.flags, cleanFlags),
    skipped: cleanSkipped(v.skipped),
    sources: cleanMap(v.sources, (t) => cleanText(t, 200)),
    confirmed: Array.isArray(v.confirmed) ? v.confirmed.slice(0, 20).map((k) => cleanText(k, 40)) : [],
    reviewed: v.reviewed === true,
    fromLink: v.fromLink === true,
    patient: cleanPerson(v.patient),
  };
}

// The patient sent by the extension, cut down like any other outside data.
export const patientFromOscar = (p) => ({
  ...BLANK_PATIENT,
  ...cleanPerson(p),
  hcn: cleanText(p?.hcn, 20),
  address: cleanText(p?.address, 200),
});

// Prescriber details from the clinician signed in to Oscar.
export const PRESCRIBER_FROM_OSCAR = ["name", "license", "phone", "street", "city"];
export const prescriberFromOscar = (c) =>
  c && typeof c === "object" ? Object.fromEntries(PRESCRIBER_FROM_OSCAR.map((k) => [k, cleanText(c[k], k === "license" ? 20 : 160)])) : null;

export const checkSavedSignature = (v) =>
  v && typeof v.key === "string" && isSignatureImage(v.image) ? { key: v.key.slice(0, 200), image: v.image } : null;

// Drops sent by the extension: only drugs in this clinic's drug list, each
// with what had to be assumed and the sentence it was read from.
export const dropsFromOscar = (drops, formulary) => {
  const known = new Set(formulary.map((m) => m.brand));
  return (Array.isArray(drops) ? drops : [])
    .slice(0, MAX_DROPS)
    .map((x) => ({ entry: cleanEntry(x), flags: cleanFlags(x?.flags), source: cleanText(x?.source, 200) }))
    .filter((r) => r.entry && known.has(r.entry.brand));
};
