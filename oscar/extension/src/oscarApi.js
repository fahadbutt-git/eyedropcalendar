// Oscar's REST interface, called from the Oscar tab itself. It uses the
// clinician's own Oscar login (the /ws/rs services Oscar's own screens use),
// so the clinic needs no keys or setup, and the extension can see only what
// that clinician can see. Requests go from this computer to the clinic's
// Oscar and nowhere else.
//
// Oscar writes JSON through CXF, which turns numbers and booleans into
// strings and a one-item list into a bare object. The helpers below accept
// both forms.

export const asList = (v) => (v == null || v === "" ? [] : Array.isArray(v) ? v : [v]);
const yes = (v) => v === true || v === "true";
// Dates come as text in some Oscar versions and as milliseconds in others.
const isoDate = (v) => {
  if (v == null || v === "") return "";
  const d = new Date(/^\d+$/.test(String(v)) ? Number(v) : v);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
};

export class OscarError extends Error {
  constructor(kind, message, detail = "") {
    super(message);
    this.kind = kind;
    // Which Oscar service failed and how, for support. Patient numbers are
    // replaced with #, so it is safe to read out or copy into an email.
    this.detail = detail;
  }
}

// The web app's own folder ("/oscar", "/kaioscar" and so on) comes from the
// page address, so the extension works whatever a clinic calls it.
export function restBase(location) {
  const context = location.pathname.split("/").filter(Boolean)[0] || "oscar";
  return `${location.origin}/${context}/ws/rs`;
}

// The patient whose chart is open: from the page address, or from the
// hidden field Oscar's encounter page keeps it in.
export function openPatientId(location, document) {
  const params = new URLSearchParams(location.search);
  const fromUrl = params.get("demographicNo") || params.get("demographic_no") || params.get("demoNo");
  const fromPage = document.querySelector('input[name="demographicNo"], input[name="demographic_no"]')?.value;
  const id = fromUrl || fromPage;
  return /^\d{1,10}$/.test(id || "") ? id : null;
}

const TIMEOUT = 12000;

export function oscarClient(base, fetcher = fetch) {
  const call = async (path, { method = "GET", body } = {}) => {
    const where = `${method} ${path.split("?")[0].replace(/\d+/g, "#")}`;
    let res;
    // An Oscar that does not answer is given up on, so the panel never waits forever.
    const stop = typeof AbortController === "function" ? new AbortController() : null;
    const timer = stop && setTimeout(() => stop.abort(), TIMEOUT);
    try {
      res = await fetcher(`${base}/${path}`, {
        method,
        credentials: "same-origin",
        headers: { Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        ...(stop ? { signal: stop.signal } : {}),
      });
    } catch {
      throw new OscarError("network", stop?.signal.aborted ? "Oscar did not answer in time." : "Oscar could not be reached.", `${where}: no answer`);
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (res.status === 401 || res.status === 403) throw new OscarError("signed-out", "Oscar says you are not signed in. Sign in to Oscar and try again.", `${where}: ${res.status}`);
    if (res.status === 404) throw new OscarError("missing", "This Oscar does not offer that service.", `${where}: 404`);
    if (!res.ok) throw new OscarError("server", `Oscar answered with an error (${res.status}).`, `${where}: ${res.status}`);
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new OscarError("format", "Oscar answered in a form the extension does not read.", `${where}: not JSON`);
    }
  };

  return {
    // The signed-in clinician, so a note is never saved under someone else
    // who has since signed in to Oscar in another tab.
    async me() {
      const p = await call("providerService/provider/me");
      return String(p?.providerNo ?? p?.id ?? "");
    },
    async patient(id) {
      const d = await call(`demographics/${id}`);
      if (!d) throw new OscarError("missing", "Oscar did not return this patient.");
      const dob = d.dobYear && d.dobMonth && d.dobDay ? `${d.dobYear}-${String(d.dobMonth).padStart(2, "0")}-${String(d.dobDay).padStart(2, "0")}` : "";
      return { id: String(d.demographicNo || id), name: [d.firstName, d.lastName].filter(Boolean).join(" "), dob: /^\d{4}-\d{2}-\d{2}$/.test(dob) ? dob : "" };
    },
    async search(query) {
      const r = await call(`demographics/quickSearch?query=${encodeURIComponent(query)}`);
      return asList(r?.content).map((p) => ({ id: String(p.demographicNo), name: `${p.lastName}, ${p.firstName}`, dob: isoDate(p.dob).slice(0, 10) }));
    },
    // Newest first. Oscar's own list is newest first already, but sorting
    // costs nothing and does not depend on it.
    async notes(id, count = 15) {
      const r = await call(`notes/${id}/all?numToReturn=${count}&offset=0`, { method: "POST", body: {} });
      return asList(r?.notelist)
        .filter((n) => n && typeof n.note === "string" && n.note.trim() && !yes(n.archived) && !yes(n.isDocument) && !yes(n.isCpp))
        .map((n) => ({ id: String(n.noteId), date: isoDate(n.observationDate || n.updateDate), provider: n.providerName || "", text: n.note }))
        .sort((a, b) => b.date.localeCompare(a.date));
    },
    async currentDrugs(id) {
      try {
        const r = await call(`rx/drugs/current/${id}`);
        return asList(r?.content ?? r?.drug).filter((d) => d && typeof d === "object");
      } catch (e) {
        if (e.kind === "missing") return [];
        throw e;
      }
    },
    // Added as an unsigned note, so the clinician reads and signs it in the
    // chart as usual.
    async addNote(id, text) {
      const saved = await call(`notes/${id}/save`, {
        method: "POST",
        body: { note: text, isSigned: false, isVerified: false, encounterType: "", assignedIssues: [] },
      });
      if (!saved) throw new OscarError("server", "Oscar did not save the note.");
      return saved;
    },
  };
}
