// A stand-in Oscar for building and testing the extension without a real
// chart. It answers the same session-based REST addresses as Oscar
// (/oscar/ws/rs/...), in the same shapes, with made-up patients only.
//
//   node oscar/standin/server.mjs        then open http://localhost:8080/oscar
//   Log in with oscardoc / mac2002 / 1117 (the Open OSP demo login).
//
// It copies the behaviour of the Open-O 25 release tested on 5 November
// 2026: dates as milliseconds, the encounter in a pop-up window at
// casemgmt/forward.jsp with the note being written in a textarea named
// caseNote_note, and Prototype.js on every page, which changes how the
// page's own JSON.stringify writes lists. Older Oscar builds write numbers as
// strings and a one-item list as a bare object, so some answers use that
// form too, and the extension has to read both.
import { createServer } from "node:http";
import { randomBytes } from "node:crypto";
import { PATIENTS } from "./patients.mjs";

const PORT = Number(process.env.PORT || 8080);
const sessions = new Set();
const saved = []; // notes written back, for tests to read
let provider = "999998"; // who is signed in; tests can switch it
const broken = new Set(); // services a test makes fail, like an Oscar build that differs
// Test-only: services that never answer, like an Oscar that has hung, and the
// requests left waiting on them (answered when the stand-in is reset).
const hanging = new Set();
const held = [];

const str = (v) => (v == null ? v : String(v));
const cookieOf = (req) => /JSESSIONID=([\w]+)/.exec(req.headers.cookie || "")?.[1];
const authed = (req) => sessions.has(cookieOf(req));
const send = (res, status, body, type = "application/json") => {
  res.writeHead(status, { "Content-Type": `${type}; charset=utf-8`, "Cache-Control": "no-store" });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
};
const readBody = (req) =>
  new Promise((resolve) => {
    let data = "";
    req.on("data", (c) => (data += c));
    req.on("end", () => resolve(data));
  });
// CXF writes a list of one as a bare object.
const cxfList = (list) => (list.length === 1 ? list[0] : list);

// What Prototype.js 1.6 does to every Oscar page: lists turn into strings
// when the page calls JSON.stringify.
const PROTOTYPE = `<script>Array.prototype.toJSON = function () { return "[" + Array.prototype.map.call(this, function (x) { return JSON.stringify(String(x)); }).join(",") + "]"; };</script>`;
const page = (title, body) => `<!doctype html><html><head><meta charset="utf-8"><title>${title}</title>${PROTOTYPE}
<style>body{font:13px Arial,sans-serif;margin:0;background:#fff}header{background:#003399;color:#fff;padding:6px 10px;font-weight:bold}
main{padding:10px}a{color:#003399}table{border-collapse:collapse}td,th{border:1px solid #ccc;padding:4px 8px;text-align:left}
.note{white-space:pre-wrap;border:1px solid #999;padding:8px;width:780px;min-height:240px;font:12px Arial,sans-serif}
.bar{background:#ccccff;padding:4px 8px;margin:8px 0;width:780px}</style></head><body><header>OSCAR EMR (stand-in, made-up patients)</header><main>${body}</main></body></html>`;

const escapeHtml = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function demographicTo(p) {
  return {
    demographicNo: str(p.id), firstName: p.firstName, lastName: p.lastName, sex: p.sex,
    dobYear: p.dob.slice(0, 4), dobMonth: p.dob.slice(5, 7), dobDay: p.dob.slice(8, 10),
    hin: p.hin, hcType: "ON", chartNo: str(1000 + p.id), patientStatus: "AC",
    address: { address: p.address, city: "Toronto", province: "ON", postal: "M5V 0A1" },
  };
}

function noteTo(p, n, i) {
  return {
    noteId: p.id * 100 + i, uuid: `standin-${p.id}-${i}`, note: n.text, observationDate: Date.parse(n.date), updateDate: Date.parse(n.date),
    providerName: p.lastName === "HOSTILE" ? '<img src=x onerror="window.__pwned=6">' : "Demo, Doctor", providerNo: "999998", isSigned: "true", isEditable: "true", revision: "1",
    encounterType: "face to face encounter with client", archived: "false", isCpp: "false", isDocument: "false",
  };
}

async function rest(req, res, path, url) {
  if (url.searchParams.get("_wadl") !== null) return send(res, 200, "<application/>", "application/xml");
  if (!authed(req)) return send(res, 401, "<error>Not authorized</error>", "text/xml");
  let m;
  // Test-only (set through /oscar/__standin/break and /hang): a service that
  // fails or never answers.
  const service = /^demographics\/\d+$/.test(path) ? "demographics" : /^notes\/\d+\/all$/.test(path) ? "notes" : /^notes\/\d+\/save$/.test(path) ? "save" : path === "providerService/provider/me" ? "me" : /^rx\//.test(path) ? "rx" : "";
  if (service && hanging.has(service)) return void held.push(res);
  if (service && service !== "notes" && service !== "rx" && broken.has(service)) return send(res, 500, "");
  if ((m = path.match(/^demographics\/quickSearch$/))) {
    const q = (url.searchParams.get("query") || "").toLowerCase();
    const found = PATIENTS.filter((p) => `${p.lastName}, ${p.firstName}`.toLowerCase().includes(q.replace(/\s*,\s*/, ", ")) || p.lastName.toLowerCase().startsWith(q));
    if (!found.length) return send(res, 200, { limit: "0", offset: "0", total: "0" });
    return send(res, 200, {
      content: found.map((p) => ({ demographicNo: str(p.id), lastName: p.lastName, firstName: p.firstName, dob: p.dob, sex: p.sex, hin: p.hin, status: "AC" })),
      limit: "0", offset: "0", query: q, total: str(found.length),
    });
  }
  const patient = (id) => PATIENTS.find((p) => p.id === Number(id));
  if ((m = path.match(/^demographics\/(\d+)$/))) {
    const p = patient(m[1]);
    return p ? send(res, 200, demographicTo(p)) : send(res, 404, "");
  }
  if (broken.has("notes") && /^notes\/\d+\/all$/.test(path)) return send(res, 500, "");
  if (broken.has("rx") && /^rx\//.test(path)) return send(res, 500, "");
  if (path === "providerService/provider/me") return send(res, 200, { id: provider, firstName: "doctor", lastName: "oscardoc" });
  if ((m = path.match(/^notes\/(\d+)\/all$/)) && req.method === "POST") {
    const p = patient(m[1]);
    if (!p) return send(res, 200, { moreNotes: "false" });
    const notes = [...p.notes, ...saved.filter((s) => s.demographicNo === p.id).map((s) => ({ date: s.date, text: s.note }))]
      .sort((a, b) => b.date.localeCompare(a.date));
    return send(res, 200, { moreNotes: "false", notelist: cxfList(notes.map((n, i) => noteTo(p, n, i))) });
  }
  if ((m = path.match(/^notes\/(\d+)\/save$/)) && req.method === "POST") {
    const p = patient(m[1]);
    let note;
    try {
      note = JSON.parse(await readBody(req));
    } catch {
      return send(res, 400, "");
    }
    if (!p || typeof note?.note !== "string" || !note.note.trim()) return send(res, 200, "");
    // A list that arrives as text is what Prototype.js does to JSON written
    // from the page itself. Oscar fails on it, so the stand-in does too.
    if (!Array.isArray(note.assignedIssues)) return send(res, 500, "assignedIssues must be a list", "text/plain");
    const entry = { demographicNo: p.id, note: note.note, isSigned: note.isSigned, date: new Date().toISOString() };
    saved.push(entry);
    return send(res, 200, noteTo(p, { date: entry.date, text: entry.note }, 99));
  }
  if ((m = path.match(/^rx\/drugs\/current\/(\d+)$/))) {
    const p = patient(m[1]);
    const drugs = (p?.rx || []).map((d, i) => ({ drugId: str(p.id * 10 + i), demographicNo: str(p.id), archived: "false", prn: "false", ...d }));
    return send(res, 200, drugs.length ? { content: cxfList(drugs) } : {});
  }
  return send(res, 404, "");
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const path = url.pathname;
  if (path === "/" || path === "/oscar" || path === "/oscar/") return res.writeHead(302, { Location: "/oscar/index.jsp" }).end();
  if (path === "/oscar/index.jsp")
    return send(res, 200, page("OSCAR login", `<form method="post" action="/oscar/login.do">
      <p><label>Username <input name="username" autocomplete="off"></label></p>
      <p><label>Password <input name="password" type="password"></label></p>
      <p><label>2nd level passcode <input name="pin" type="password"></label></p>
      <button>Sign in</button></form>`), "text/html");
  if (path === "/oscar/login.do" && req.method === "POST") {
    const f = new URLSearchParams(await readBody(req));
    if (f.get("username") !== "oscardoc" || f.get("password") !== "mac2002" || f.get("pin") !== "1117") return res.writeHead(302, { Location: "/oscar/index.jsp" }).end();
    const id = randomBytes(12).toString("hex");
    sessions.add(id);
    return res.writeHead(302, { "Set-Cookie": `JSESSIONID=${id}; Path=/oscar; HttpOnly; SameSite=Lax`, Location: "/oscar/provider/providercontrol.jsp" }).end();
  }
  if (path.startsWith("/oscar/ws/rs/")) return rest(req, res, path.slice("/oscar/ws/rs/".length), url);
  if (path === "/oscar/__standin/saved") return send(res, 200, saved);
  // What the encounter's Sign & Save does with today's note, for tests.
  if (path === "/oscar/__standin/sign" && req.method === "POST") {
    const body = JSON.parse((await readBody(req)) || "{}");
    saved.push({ demographicNo: Number(body.demographicNo), note: String(body.note || ""), isSigned: true, date: new Date().toISOString(), byEncounter: true });
    return send(res, 200, { ok: true });
  }
  // Each test run starts from no saved notes and the usual clinician.
  if (path === "/oscar/__standin/reset") {
    saved.length = 0;
    provider = "999998";
    broken.clear();
    hanging.clear();
    for (const r of held.splice(0)) if (!r.writableEnded) send(r, 500, "");
    return send(res, 200, { reset: true });
  }
  if (path === "/oscar/__standin/break") {
    broken.add(url.searchParams.get("service"));
    return send(res, 200, { broken: [...broken] });
  }
  // Test-only: a service that never answers, until the stand-in is reset.
  if (path === "/oscar/__standin/hang") {
    hanging.add(url.searchParams.get("service"));
    return send(res, 200, { hanging: [...hanging] });
  }
  // Test-only: every Oscar session ends, as when Oscar times the login out.
  if (path === "/oscar/__standin/logout") {
    sessions.clear();
    return send(res, 200, { sessions: 0 });
  }
  if (path === "/oscar/__standin/provider") {
    provider = url.searchParams.get("no") || "999998";
    return send(res, 200, { provider });
  }
  if (!authed(req)) return res.writeHead(302, { Location: "/oscar/index.jsp" }).end();
  if (path === "/oscar/provider/providercontrol.jsp")
    return send(res, 200, page("Schedule", `<h2>Today</h2><table><tr><th>Patient</th><th>Reason</th></tr>${PATIENTS.map(
      (p) => `<tr><td><a href="/oscar/casemgmt/forward.jsp?action=view&demographicNo=${p.id}&providerNo=999998" onclick="window.open(this.href, 'encounter${p.id}', 'height=710,width=1024,location=no,scrollbars=yes,menubars=no,toolbars=no,resizable=yes'); return false;">${escapeHtml(p.lastName)}, ${escapeHtml(p.firstName)}</a></td><td>${escapeHtml(p.reason)}</td></tr>`
    ).join("")}</table>`), "text/html");
  if (path === "/oscar/CaseManagementEntry.do" || path === "/oscar/casemgmt/forward.jsp") {
    const p = PATIENTS.find((x) => x.id === Number(url.searchParams.get("demographicNo")));
    if (!p) return send(res, 404, page("Not found", "No such patient"), "text/html");
    // Oscar refuses an encounter outside the clinician's program with this page.
    if (url.searchParams.get("denied") === "1")
      return send(res, 200, `<html><head><title></title></head><body><input type="hidden" name="demographicNo" value="${p.id}"><h3 style="color:red">Access Denied</h3><p>You cannot access this client's Encounter because he/she is not in your program domain.</p></body></html>`, "text/html");
    const latest = [...p.notes].sort((a, b) => b.date.localeCompare(a.date))[0] || { text: "" };
    return send(res, 200, page(`Encounter - ${p.lastName}, ${p.firstName}`, `<input type="hidden" name="demographicNo" value="${p.id}">
      <div class="bar">Encounter: ${escapeHtml(p.lastName)}, ${escapeHtml(p.firstName)} &middot; ${p.dob}</div>
      <div class="note">${escapeHtml(latest.text)}</div>
      <div class="bar">Today's note</div>
      <textarea name="caseNote_note" id="caseNote_note${p.id}" class="note">[06-Nov-2026 .: ]\n${escapeHtml(p.draft || "")}</textarea>`), "text/html");
  }
  send(res, 404, page("Not found", "Not found"), "text/html");
});

server.listen(PORT, () => console.log(`Stand-in Oscar on http://localhost:${PORT}/oscar (oscardoc / mac2002 / 1117)`));
