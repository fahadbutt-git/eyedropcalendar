// The Oscar REST client, against answers in the forms real Oscar builds give.
import { test } from "node:test";
import assert from "node:assert/strict";
import { asList, oscarClient, openPatientId, restBase } from "../oscar/extension/src/oscarApi.js";

const reply = (status, body) => ({ ok: status >= 200 && status < 300, status, text: async () => (body == null ? "" : typeof body === "string" ? body : JSON.stringify(body)) });
const fake = (routes) => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, ...init });
    const path = url.replace("https://clinic.example/oscar/ws/rs/", "");
    const hit = Object.entries(routes).find(([k]) => path.startsWith(k));
    return hit ? hit[1](init) : reply(404, "");
  };
  return { client: oscarClient("https://clinic.example/oscar/ws/rs", fetcher), calls };
};

test("the REST address follows the clinic's own Oscar folder", () => {
  assert.equal(restBase(new URL("https://emr.example.ca/oscar/casemgmt/forward.jsp?demographicNo=3")), "https://emr.example.ca/oscar/ws/rs");
  assert.equal(restBase(new URL("https://kai.example.com/kaioscar/CaseManagementEntry.do")), "https://kai.example.com/kaioscar/ws/rs");
});

test("the open patient comes from the address or the page", () => {
  const doc = (value) => ({ querySelector: () => (value == null ? null : { value }) });
  assert.equal(openPatientId(new URL("http://x/oscar/casemgmt/forward.jsp?action=view&demographicNo=3"), doc()), "3");
  assert.equal(openPatientId(new URL("http://x/oscar/encounter.jsp"), doc("42")), "42");
  assert.equal(openPatientId(new URL("http://x/oscar/encounter.jsp?demographicNo=3;drop"), doc()), null);
  assert.equal(openPatientId(new URL("http://x/oscar/provider/providercontrol.jsp"), doc()), null);
});

test("notes are read whether dates are text or milliseconds, newest first", async () => {
  const { client, calls } = fake({
    "notes/3/all": () =>
      reply(200, {
        moreNotes: null,
        notelist: [
          { noteId: 1, note: "Older plan", observationDate: Date.parse("2026-10-01T10:00:00Z"), isSigned: true, archived: false },
          { noteId: "2", note: "Newer plan", observationDate: "2026-11-05T15:00:00-05:00", archived: "false" },
          { noteId: 3, note: "Archived", observationDate: Date.parse("2026-11-06T10:00:00Z"), archived: true },
          { noteId: 4, note: "   ", observationDate: Date.parse("2026-11-06T10:00:00Z") },
        ],
      }),
  });
  const notes = await client.notes("3");
  assert.deepEqual(notes.map((n) => n.text), ["Newer plan", "Older plan"]);
  assert.equal(notes[0].date, "2026-11-05T20:00:00.000Z");
  assert.equal(calls[0].method, "POST");
  assert.equal(calls[0].credentials, "same-origin");
});

test("a list of one written as a bare object is still a list", async () => {
  assert.deepEqual(asList({ a: 1 }), [{ a: 1 }]);
  assert.deepEqual(asList(undefined), []);
  const { client } = fake({ "notes/3/all": () => reply(200, { notelist: { noteId: "9", note: "Only note", observationDate: "2026-11-01T10:00:00Z" } }) });
  assert.equal((await client.notes("3"))[0].text, "Only note");
});

test("the patient's name and date of birth, and nothing else", async () => {
  const { client } = fake({ "demographics/3": () => reply(200, { demographicNo: 3, firstName: "Alex", lastName: "SAMPLE", dobYear: "1951", dobMonth: "4", dobDay: "12", hin: "123" }) });
  assert.deepEqual(await client.patient("3"), { id: "3", name: "Alex SAMPLE", dob: "1951-04-12" });
});

test("sign-in and server problems give plain messages", async () => {
  const signedOut = fake({ "demographics/3": () => reply(401, "<error/>") }).client;
  await assert.rejects(signedOut.patient("3"), (e) => e.kind === "signed-out" && /Sign in to Oscar/.test(e.message));
  const broken = fake({ "notes/3/all": () => reply(500, "boom") }).client;
  await assert.rejects(broken.notes("3"), (e) => e.kind === "server");
  const offline = oscarClient("https://clinic.example/oscar/ws/rs", async () => {
    throw new TypeError("network");
  });
  await assert.rejects(offline.patient("3"), (e) => e.kind === "network");
});

test("a missing Rx service gives an empty list, not an error", async () => {
  const { client } = fake({});
  assert.deepEqual(await client.currentDrugs("3"), []);
});

test("a note is added unsigned, to the patient asked for", async () => {
  const { client, calls } = fake({ "notes/3/save": () => reply(200, { noteId: 77 }) });
  await client.addNote("3", "Eye drop plan");
  const body = JSON.parse(calls[0].body);
  assert.equal(calls[0].url, "https://clinic.example/oscar/ws/rs/notes/3/save");
  assert.equal(body.note, "Eye drop plan");
  assert.equal(body.isSigned, false);
  assert.deepEqual(body.assignedIssues, []);
});

test("the note the extension writes from the plan code matches the site's chart note", async () => {
  const { encodeRegimen, decodeRegimen } = await import("../src/lib/share.js");
  const { chartNote } = await import("../src/lib/chartNote.js");
  const { SEED_FORMULARY } = await import("../src/data/formulary.js");
  const entries = [
    { brand: "Xalatan", eye: "OS", drops: 1, mode: "ongoing", freq: 1, durationDays: 7, startDay: 1, steps: [] },
    { brand: "Pred Forte", eye: "OD", drops: 1, mode: "taper", freq: 8, durationDays: 7, startDay: 1, steps: [{ freq: 8, days: 7 }, { freq: 4, days: 7 }, { freq: 2, days: 7 }] },
    { brand: "Vigamox", eye: "OD", drops: 1, mode: "duration", freq: 3, durationDays: 7, startDay: 1, steps: [] },
  ];
  const settings = { start: "2026-11-06", wake: "07:30", bed: "22:30" };
  const code = encodeRegimen({ entries, formulary: SEED_FORMULARY, ...settings, nonce: "abcd1234" });
  const link = `https://eyedroptracker.com/#/p/${code}`;
  const fromSite = chartNote({ entries, formulary: SEED_FORMULARY, ...settings, link });
  const fromExtension = chartNote({ ...decodeRegimen(code), link });
  assert.equal(fromExtension, fromSite);
  assert.throws(() => decodeRegimen("not-a-plan"));
});
