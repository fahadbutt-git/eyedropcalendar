// Encodes a regimen into a link the patient can open on their phone.
// Only drug instructions and dates are included. No name, date of birth,
// health card number or address is ever placed in the link.

const b64url = {
  enc: (s) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""),
  dec: (s) => decodeURIComponent(escape(atob(s.replace(/-/g, "+").replace(/_/g, "/")))),
};

export function encodeRegimen({ entries, formulary, start, wake, bed }) {
  const e = entries.map((x) => {
    const m = formulary.find((f) => f.brand === x.brand) || {};
    return [
      x.brand,
      m.generic || "",
      m.cap || "",
      m.form || "solution",
      m.qhs ? 1 : 0,
      x.eye,
      x.drops,
      x.mode[0], // o, d, t
      x.freq,
      x.durationDays,
      x.startDay,
      x.mode === "taper" ? x.steps.map((s) => [s.freq, s.days]) : 0,
    ];
  });
  return b64url.enc(JSON.stringify({ v: 1, s: start, w: wake, b: bed, e }));
}

export function decodeRegimen(code) {
  const o = JSON.parse(b64url.dec(code));
  if (o.v !== 1) throw new Error("Unsupported link version");
  const modes = { o: "ongoing", d: "duration", t: "taper" };
  const entries = o.e.map((a) => ({
    brand: a[0],
    eye: a[5],
    drops: a[6],
    mode: modes[a[7]] || "ongoing",
    freq: a[8],
    durationDays: a[9],
    startDay: a[10],
    steps: a[11] ? a[11].map(([freq, days]) => ({ freq, days })) : [],
  }));
  const formulary = o.e.map((a, i) => ({ id: i, brand: a[0], generic: a[1], cap: a[2], form: a[3], qhs: !!a[4] }));
  return { start: o.s, wake: o.w, bed: o.b, entries, formulary };
}

export function patientLink(code) {
  const base = `${window.location.origin}${window.location.pathname}`;
  return `${base}#/p/${code}`;
}
