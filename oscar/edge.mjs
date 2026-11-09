// Edge cases a clinic will meet with the Oscar extension: two encounters
// open, Oscar signing out or failing mid-visit, a locked note, double
// clicks, edits on the site, unusual names, markup in a note, a stale tab or
// hand-off, an empty plan, and typing after the plan is added. Each scenario
// states the safe behaviour: refuse clearly, never write to the wrong
// patient, never lose the clinician's typing, never show a blank or
// misleading state.
//
//   npm run ext:build -- --dev
//   npm run oscar:standin            (port 8080, restart it first)
//   npm run build && npm run preview (port 4173)
//   node oscar/edge.mjs
//
// Each scenario runs on its own, so one failure does not stop the others. A
// summary is printed at the end, and the run exits non-zero if any failed.
import { TERMS_VERSION } from "../src/config.js";
import { encodeRegimen } from "../src/lib/share.js";
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ext = join(dirname(fileURLToPath(import.meta.url)), "extension/dist");
const OSCAR = "http://localhost:8080/oscar";
const SITE = "http://localhost:4173/";
const standin = async (route) => (await fetch(`${OSCAR}/__standin/${route}`)).json();
const saved = () => standin("saved");
await standin("reset");

const ok = (what) => console.log(`ok    ${what}`);
const results = [];
async function scenario(name, fn) {
  const opened = [];
  try {
    await fn(opened);
    results.push({ name, pass: true });
    console.log(`PASS  ${name}`);
  } catch (e) {
    results.push({ name, pass: false, why: e.message.split("\n")[0] });
    console.log(`FAIL  ${name}\n      ${e.message.split("\n").slice(0, 3).join("\n      ")}`);
  } finally {
    for (const p of opened) await p.close().catch(() => {});
    await standin("reset").catch(() => {});
  }
}

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "edt-edge-")), {
  headless: true,
  channel: "chromium",
  viewport: { width: 1360, height: 860 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));

const schedule = await context.newPage();
async function login() {
  await schedule.goto(`${OSCAR}/index.jsp`);
  await schedule.fill('input[name="username"]', "oscardoc");
  await schedule.fill('input[name="password"]', "mac2002");
  await schedule.fill('input[name="pin"]', "1117");
  await schedule.click("button");
  await schedule.waitForURL(/providercontrol/);
}
await login();
const site = await context.newPage();
await site.goto(SITE);
await site.evaluate((v) => localStorage.setItem("edt.terms", JSON.stringify(v)), TERMS_VERSION);
await site.close();

// Each Oscar page gets its own address, so the worker finds the right tab.
let seq = 0;
async function encounter(opened, id) {
  const page = await context.newPage();
  opened.push(page);
  await page.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=${id}&providerNo=999998&edge=${++seq}`);
  return page;
}
// Oscar's own way: a pop-up window from the schedule.
async function encounterFromSchedule(opened, name) {
  await schedule.bringToFront();
  const [popup] = await Promise.all([context.waitForEvent("page"), schedule.click(`text=${name}`)]);
  await popup.waitForLoadState();
  opened.push(popup);
  return popup;
}
const tabIdOf = (page) => worker.evaluate(async (url) => (await chrome.tabs.query({})).find((t) => t.url === url)?.id, page.url());
const openPanel = (page) =>
  worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
  }, page.url());
const panelOf = (page) => page.locator("#edt-oscar-panel");
const panelText = (page) => page.evaluate(() => document.getElementById("edt-oscar-panel")?.shadowRoot.querySelector("aside").innerText ?? "");
const noteOf = (page) => page.locator('textarea[name="caseNote_note"]').inputValue();
const plans = (text) => (text.match(/Eye drop plan/g) || []).length;

// Reads the chart in the panel and opens the drops in a new Eye Drop Tracker tab.
async function readAndOpen(opened, enc) {
  if (!(await enc.locator("#edt-oscar-panel").count())) await openPanel(enc);
  const open = panelOf(enc).locator('[data-act="open"]:not([disabled])');
  await open.waitFor({ timeout: 10000 });
  const [tracker] = await Promise.all([context.waitForEvent("page"), open.click()]);
  opened.push(tracker);
  await tracker.waitForLoadState();
  await tracker.locator(".import-review, .import-done").first().waitFor();
  return tracker;
}
// Ticks every drop read from the chart and goes to the calendar.
async function toCalendar(tracker) {
  for (const box of await tracker.locator(".import-review input[type=checkbox]").all()) await box.click();
  await tracker.getByRole("button", { name: /Next: calendar/ }).click();
  await tracker.getByRole("button", { name: /Add to Oscar chart|Added to Oscar chart/ }).waitFor();
}
const hint = (tracker) => tracker.locator(".hint[role=status]").first();
// Presses Add to Oscar chart and waits for the answer shown under it.
async function add(tracker, how = "click") {
  const button = tracker.getByRole("button", { name: "Add to Oscar chart" });
  const before = await hint(tracker).textContent();
  await button.scrollIntoViewIfNeeded();
  if (how === "dblclick") {
    const b = await button.boundingBox();
    await tracker.mouse.dblclick(b.x + b.width / 2, b.y + b.height / 2);
  } else await button.click();
  await tracker.waitForFunction((t) => {
    const h = document.querySelector(".hint[role=status]");
    return h && h.textContent !== t && !/Adding to Oscar/.test(document.body.innerText);
  }, before, { timeout: 25000 });
  return hint(tracker).textContent();
}

// 1. Two encounters open. The plan read from A goes to A even while the
// clinician is working in B, which also has the panel open.
await scenario("1. two encounters open: Add goes to the patient the plan was read from", async (opened) => {
  const A = await encounterFromSchedule(opened, "SAMPLE, Alex");
  const B = await encounterFromSchedule(opened, "TEST, Jordan");
  const tracker = await readAndOpen(opened, A);
  await toCalendar(tracker);
  await openPanel(B);
  await panelOf(B).locator("text=Drops found").waitFor();
  await B.bringToFront();
  await B.locator('textarea[name="caseNote_note"]').focus();
  const bBefore = await noteOf(B);
  const msg = await add(tracker);
  assert.match(msg, /Added to today's note/, `Add answered: ${msg}`);
  assert.equal(plans(await noteOf(A)), 1, "plan not in A's note once");
  assert.equal(await noteOf(B), bBefore, "B's note changed");
  assert.equal((await saved()).length, 0, "a separate note was saved");
  ok("plan in A's open note once, B untouched");
});

// 2. Oscar signs the clinician out between reading and Add.
await scenario("2. Oscar session expired before Add: clear message, nothing written", async (opened) => {
  const enc = await encounter(opened, 1);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  const before = await noteOf(enc);
  await standin("logout");
  try {
    const msg = await add(tracker);
    assert.equal(await noteOf(enc), before, "today's note changed");
    assert.equal((await saved()).length, 0, "a note was saved");
    ok(`nothing written; message: "${msg}"`);
    assert.doesNotMatch(msg, /different person/i, `misleading message for a signed-out session: "${msg}"`);
    assert.match(msg, /not signed in|signed out|sign in/i, `message does not say to sign in again: "${msg}"`);
  } finally {
    await login();
  }
});

// 3a. Notes and medication list fail: the panel says so and offers adding by hand.
await scenario("3a. Oscar 500 on notes and Rx: plain message, add by hand offered, no contradictory empty-chart text", async (opened) => {
  await standin("break?service=notes");
  await standin("break?service=rx");
  const enc = await encounter(opened, 1);
  await openPanel(enc);
  await panelOf(enc).locator(".note-partial").first().waitFor();
  await panelOf(enc).locator("text=Reading the chart").waitFor({ state: "detached" });
  const text = await panelText(enc);
  assert.match(text, /Saved notes could not be read/);
  assert.match(text, /medication list could not be read/);
  assert.ok(await panelOf(enc).getByRole("button", { name: /add drops by hand/ }).isEnabled(), "add by hand not offered");
  ok("partial failure named, add by hand enabled");
  assert.doesNotMatch(text, /no notes or medications to read yet/, "panel says the chart has no notes, though they could not be read");
});

// 3b. The patient's demographics fail.
await scenario("3b. Oscar 500 on demographics: plain message with a next step", async (opened) => {
  await standin("break?service=demographics");
  const enc = await encounter(opened, 1);
  await openPanel(enc);
  await panelOf(enc).locator(".error").waitFor();
  const text = await panelText(enc);
  assert.doesNotMatch(text, /Reading the chart/);
  assert.equal(await panelOf(enc).locator(".who").count(), 0, "a patient is shown");
  assert.doesNotMatch(text, /undefined|TypeError|\[object/, "raw error shown");
  const error = (await panelOf(enc).locator(".error").innerText()).replace(/\s+/g, " ");
  ok(`error shown: "${error}"`);
  const byHand = await panelOf(enc).getByRole("button", { name: /add drops by hand/ }).isEnabled();
  assert.ok(byHand || /try again|reload|by hand|sign in|copy/i.test(error), "no next step: the by-hand button is disabled and the message says only that Oscar answered with an error");
});

// 3c. Oscar never answers.
await scenario("3c. Oscar hangs on demographics and notes: panel stops waiting and says so", async (opened) => {
  await standin("hang?service=demographics");
  await standin("hang?service=notes");
  const enc = await encounter(opened, 1);
  await openPanel(enc);
  await panelOf(enc).locator("text=Reading the chart").waitFor();
  const gone = await panelOf(enc)
    .locator("text=Reading the chart")
    .waitFor({ state: "detached", timeout: 20000 })
    .then(() => true, () => false);
  assert.ok(gone, "after 20 s the panel still says 'Reading the chart…' with no message and no way to add by hand");
  assert.ok(await panelOf(enc).locator(".error").count(), "no error after the wait");
});

// 4. Today's note box is locked or gone at Add time.
await scenario("4. note box read-only or closed at Add: separate unsigned note on the right patient, clear message", async (opened) => {
  const enc = await encounter(opened, 3);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  await enc.locator('textarea[name="caseNote_note"]').evaluate((t) => (t.readOnly = true));
  const before = await noteOf(enc);
  let msg = await add(tracker);
  assert.match(msg, /unsigned note/, `read-only box: ${msg}`);
  assert.equal(await noteOf(enc), before, "the locked note was changed");
  let s = await saved();
  assert.equal(s.length, 1);
  assert.equal(s[0].demographicNo, 3);
  assert.equal(s[0].isSigned, false);
  ok("read-only box: saved once as an unsigned note for patient 3");

  await standin("reset");
  const enc2 = await encounter(opened, 1);
  const tracker2 = await readAndOpen(opened, enc2);
  await toCalendar(tracker2);
  await enc2.locator('textarea[name="caseNote_note"]').evaluate((t) => t.remove());
  msg = await add(tracker2);
  assert.match(msg, /unsigned note/, `closed box: ${msg}`);
  s = await saved();
  assert.equal(s.length, 1);
  assert.equal(s[0].demographicNo, 1);
  ok("closed box: saved once as an unsigned note for patient 1");
});

// 5. Double click on Add.
await scenario("5. double click on Add: the plan appears once", async (opened) => {
  const enc = await encounter(opened, 1);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  const msg = await add(tracker, "dblclick");
  await tracker.waitForTimeout(1000);
  assert.match(msg, /Added to today's note|already|Already adding/, msg);
  assert.equal(plans(await noteOf(enc)), 1, "plan added more than once");
  assert.equal((await saved()).length, 0);
  ok("one plan in today's note");
});

// 6. The clinician corrects the drops on the site before adding.
await scenario("6. drops edited on the site: the note has the edited plan, on the same patient", async (opened) => {
  const other = await encounter(opened, 1);
  const enc = await encounter(opened, 3);
  const tracker = await readAndOpen(opened, enc);
  for (const box of await tracker.locator(".import-review input[type=checkbox]").all()) await box.click();
  const row = tracker.locator("li.drop").first();
  await row.locator('input[type=radio][value="OS"]').check();
  await row.locator("select.select").selectOption("4");
  await row.locator('input[type=radio][value="ongoing"]').check();
  await tracker.getByRole("button", { name: /Next: calendar/ }).click();
  const msg = await add(tracker);
  assert.match(msg, /Added to today's note/, msg);
  const note = await noteOf(enc);
  assert.match(note, /Vigamox[^\n]*left eye 4 times daily\./, "edited eye or frequency missing from the note");
  assert.doesNotMatch(note.slice(note.indexOf("Eye drop plan")), /right eye|3 times daily/, "the plan as first read was written");
  assert.equal(plans(await noteOf(other)), 0, "another patient's note changed");
  ok("note says left eye, 4 times daily, in patient 3's note only");
});

// 7. Accents, apostrophes and hyphens.
await scenario("7. name with accents and an apostrophe: read and written without mangling", async (opened) => {
  const full = "Marie-Hélène Geneviève O'BRIEN-DE LA FONTAINE-SAINT-EXUPÉRY";
  const enc = await encounter(opened, 7);
  const before = await noteOf(enc);
  await openPanel(enc);
  await panelOf(enc).locator("text=Drops found").waitFor();
  assert.equal((await panelOf(enc).locator(".who strong").textContent()).trim(), full);
  const tracker = await readAndOpen(opened, enc);
  assert.equal(await tracker.getByLabel("Patient name").inputValue(), full);
  await toCalendar(tracker);
  assert.ok((await hint(tracker).textContent()).includes(`${full}'s Oscar encounter`), "name in the Add hint is changed");
  const msg = await add(tracker);
  assert.match(msg, /Added to today's note/, msg);
  const after = await noteOf(enc);
  assert.ok(after.startsWith(before.replace(/\s+$/, "")), "the clinician's text changed");
  assert.match(after, /Patient's IOP stable/);
  assert.doesNotMatch(after, /&#39;|&amp;|Ã/, "text was escaped or mis-encoded");
  ok("name identical in panel, tracker and hint; note text intact");
});

await scenario("7b. very long name (83 characters): kept whole, or shortened visibly", async (opened) => {
  const full = "María Guadalupe Fernanda de los Ángeles RODRÍGUEZ-HERNÁNDEZ Y VILLASEÑOR DE LA CRUZ";
  const enc = await encounter(opened, 8);
  await openPanel(enc);
  await panelOf(enc).locator("text=Drops found").waitFor();
  assert.equal((await panelOf(enc).locator(".who strong").textContent()).trim(), full, "panel name");
  const tracker = await readAndOpen(opened, enc);
  const name = await tracker.getByLabel("Patient name").inputValue();
  assert.equal(name, full, `the tracker shows "${name}" (${name.length} characters), cut with no notice, and that name prints on the calendar`);
});

// 8. Markup-like text in today's note.
await scenario("8. markup-like text in the note: shown as text, never run, kept intact in the note", async (opened) => {
  const enc = await encounter(opened, 9);
  const before = await noteOf(enc);
  assert.match(before, /<\/textarea><script>/, "stand-in did not keep the text");
  await openPanel(enc);
  await panelOf(enc).locator("text=Drops found").waitFor();
  const pre = await enc.evaluate(() => document.getElementById("edt-oscar-panel").shadowRoot.querySelector("details.src pre").textContent);
  assert.match(pre, /IOP <21 & >10 target/);
  assert.match(pre, /<\/textarea><script>window.__pwned=9<\/script>/);
  assert.match(pre, /&amp; done/);
  assert.equal(await enc.evaluate(() => document.getElementById("edt-oscar-panel").shadowRoot.querySelectorAll("script, b, img").length), 0);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  const msg = await add(tracker);
  assert.match(msg, /Added to today's note/, msg);
  const after = await noteOf(enc);
  assert.ok(after.startsWith(before.replace(/\s+$/, "")), "the note's own text changed");
  assert.equal(await enc.evaluate(() => window.__pwned), undefined, "script ran on Oscar");
  assert.equal(await tracker.evaluate(() => window.__pwned), undefined, "script ran on Eye Drop Tracker");
  ok("shown literally, nothing ran, note text unchanged with the plan below");
});

// 9. Panel on Oscar pages that are not an encounter.
await scenario("9. panel on the schedule or a search page: plain message, nothing read", async (opened) => {
  await openPanel(schedule);
  await panelOf(schedule).locator(".error").waitFor();
  assert.match(await panelText(schedule), /Open a patient's encounter in Oscar/);
  assert.equal(await panelOf(schedule).locator(".who").count(), 0);
  assert.ok(await panelOf(schedule).locator('[data-act="open"]').isDisabled());
  await schedule.reload();
  const search = await context.newPage();
  opened.push(search);
  await search.goto(`${OSCAR}/demographic/demographiccontrol.jsp?search_mode=search_name&keyword=SAMPLE&orderby=last_name&edge=${++seq}`);
  await openPanel(search);
  await panelOf(search).locator(".error").waitFor();
  assert.match(await panelText(search), /Open a patient's encounter in Oscar/);
  assert.equal(await panelOf(search).locator(".who").count(), 0);
  ok("schedule and search: plain message, no patient, Open disabled");
});

// 10. The shortcut pressed twice quickly.
await scenario("10. panel opened twice quickly: never two panels, one note listener", async (opened) => {
  const enc = await encounter(opened, 1);
  await Promise.all([openPanel(enc), openPanel(enc)]);
  await enc.waitForTimeout(300);
  const twice = await enc.locator("#edt-oscar-panel").count();
  assert.ok(twice <= 1, `${twice} panels after two quick presses`);
  await Promise.all([openPanel(enc), openPanel(enc), openPanel(enc)]);
  await enc.waitForTimeout(300);
  const thrice = await enc.locator("#edt-oscar-panel").count();
  assert.ok(thrice <= 1, `${thrice} panels after three quick presses`);
  ok(`two presses leave ${twice} panel (the second press closes it, as a toggle), three leave ${thrice}`);
  if (thrice) await enc.keyboard.press("Escape");
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  await add(tracker);
  assert.equal(plans(await noteOf(enc)), 1, "plan added more than once after repeated opens");
  ok("plan added once after repeated opens");
});

// 11. The tracker tab closed and brought back from history, with its tab
// storage, as Chrome's Reopen closed tab does.
await scenario("11. site tab closed and reopened from history: stale hand-off refused clearly", async (opened) => {
  const enc = await encounter(opened, 1);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  const where = tracker.url();
  const store = await tracker.evaluate(() => Object.fromEntries(Object.entries(sessionStorage)));
  await tracker.close();
  await enc.waitForTimeout(500);
  const back = await context.newPage();
  opened.push(back);
  await back.addInitScript((s) => {
    if (location.origin === "http://localhost:4173" && !sessionStorage.length) for (const [k, v] of Object.entries(s)) sessionStorage.setItem(k, v);
  }, store);
  await back.goto(where);
  await back.waitForTimeout(800);
  const button = back.getByRole("button", { name: "Add to Oscar chart" });
  if (await button.count()) {
    const msg = await add(back);
    assert.doesNotMatch(msg, /Added/, `stale hand-off wrote: ${msg}`);
    assert.match(msg, /Copy for chart note|open it again|read the chart again/i, `unclear message: ${msg}`);
    ok(`refused: "${msg}"`);
  } else ok("no Add button offered on the reopened tab");
  assert.equal(plans(await noteOf(enc)), 0, "a stale hand-off wrote to the chart");
  assert.equal((await saved()).length, 0);
});

await scenario("11b. Oscar encounter closed before Add: refused clearly, nothing saved", async (opened) => {
  const enc = await encounter(opened, 3);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  await enc.close();
  await tracker.waitForTimeout(500);
  const msg = await add(tracker);
  assert.doesNotMatch(msg, /Added/, msg);
  assert.match(msg, /closed|moved on|not opened from Oscar|Copy for chart note/i, msg);
  assert.equal((await saved()).length, 0);
  ok(`refused: "${msg}"`);
});

// 12. Hand-offs older than two hours. The extension's clock is moved by
// back-dating the stored hand-off.
await scenario("12a. hand-off older than two hours when the tracker opens: plan not imported", async (opened) => {
  const enc = await encounter(opened, 1);
  const encTab = await tabIdOf(enc);
  const page = await context.newPage();
  opened.push(page);
  // An ordinary site tab first, so the extension can see its address.
  await page.goto(`${SITE}?edge=${++seq}#/oscar`);
  const tabId = await tabIdOf(page);
  assert.ok(tabId, "site tab not found");
  await worker.evaluate(
    async ({ tabId, encTab }) => {
      const id = crypto.randomUUID();
      await chrome.storage.session.set({
        [`handoff:${id}`]: {
          oscarTab: encTab, oscarDoc: "", patientId: "1", provider: "999998", at: Date.now() - 2 * 60 * 60 * 1000 - 60000, written: [],
          payload: { patientId: "1", provider: "999998", patient: { name: "Alex SAMPLE", dob: "1951-04-12" }, drops: [], skipped: [], code: "" },
        },
        [`tab:${tabId}`]: id,
      });
    },
    { tabId, encTab }
  );
  await page.reload();
  await page.waitForTimeout(2500);
  assert.equal(await page.locator(".import-review").count(), 0, "an expired plan was imported");
  assert.equal(await page.getByLabel("Patient name").inputValue(), "", "the patient from an expired hand-off was filled in");
  assert.ok((await page.locator("main").innerText()).trim().length > 0, "blank page");
  const left = await worker.evaluate(async () => JSON.stringify(await chrome.storage.session.get(null)));
  assert.doesNotMatch(left, /Alex SAMPLE|1951-04-12/, "expired patient details still held");
  ok("not imported, patient details dropped, ordinary empty page shown (no message says the plan expired)");
});

await scenario("12b. hand-off older than two hours at Add: refused, nothing written", async (opened) => {
  const enc = await encounter(opened, 3);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  await worker.evaluate(async () => {
    const all = await chrome.storage.session.get(null);
    for (const [k, v] of Object.entries(all)) if (k.startsWith("handoff:")) await chrome.storage.session.set({ [k]: { ...v, at: Date.now() - 2 * 60 * 60 * 1000 - 60000 } });
  });
  const before = await noteOf(enc);
  const msg = await add(tracker);
  const after = await noteOf(enc);
  assert.equal(after, before, `a hand-off 2 h 1 min old was written to the chart ("${msg}")`);
  assert.doesNotMatch(msg, /Added/, msg);
});

// 13. No drops in the plan.
await scenario("13. zero drops: Add is not offered, and an empty plan is refused", async (opened) => {
  const enc = await encounter(opened, 1);
  await openPanel(enc);
  await panelOf(enc).locator("text=Drops found").waitFor();
  for (const box of await panelOf(enc).locator(".drops input[type=checkbox]").all()) await box.uncheck();
  const byHand = panelOf(enc).getByRole("button", { name: "Open Eye Drop Tracker and add drops by hand" });
  await byHand.waitFor();
  const [tracker] = await Promise.all([context.waitForEvent("page"), byHand.click()]);
  opened.push(tracker);
  await tracker.locator("text=Patient read from the Oscar chart").waitFor();
  assert.ok(await tracker.getByRole("button", { name: /Next: calendar/ }).isDisabled(), "calendar open with no drops");
  assert.equal(await tracker.getByRole("button", { name: "Add to Oscar chart" }).count(), 0);
  ok("all drops unticked in the panel: calendar and Add closed");

  const enc2 = await encounter(opened, 3);
  const t2 = await readAndOpen(opened, enc2);
  for (const box of await t2.locator(".import-review input[type=checkbox]").all()) await box.click();
  await t2.getByRole("button", { name: "Remove Vigamox" }).click();
  assert.ok(await t2.getByRole("button", { name: /Next: calendar/ }).isDisabled(), "calendar open after removing every drop");
  assert.equal(await t2.getByRole("button", { name: "Add to Oscar chart" }).count(), 0);
  ok("all drops removed on the site: calendar and Add closed");

  // A plan code with no drops, sent by a person's click on the page.
  const all = await worker.evaluate(async () => chrome.storage.session.get(null));
  const t2Tab = await tabIdOf(t2);
  const handoff = all[`tab:${t2Tab}`];
  assert.ok(handoff, "no hand-off for the tab");
  const empty = encodeRegimen({ entries: [], formulary: [], start: "2026-11-09", wake: "08:00", bed: "22:00", nonce: "edge0001" });
  const pending = t2.evaluate(
    ({ handoff, code }) =>
      new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        window.addEventListener("message", (e) => e.data?.source === "edt-extension" && e.data.type === "added" && e.data.id === id && resolve(e.data));
        const b = document.createElement("button");
        b.id = "forge";
        b.textContent = "send";
        b.style.cssText = "position:fixed;left:0;top:0;z-index:99999";
        b.onclick = () => (b.remove(), window.postMessage({ source: "edt-page", type: "addToChart", id, handoff, code }, location.origin));
        document.body.append(b);
      }),
    { handoff, code: empty }
  );
  await t2.click("#forge");
  const r = await pending;
  assert.equal(r.ok, false, "an empty plan was added");
  assert.equal(plans(await noteOf(enc2)), 0);
  ok(`empty plan code refused: "${r.message}"`);
});

// 14. Typing in today's note around the Add.
await scenario("14. clinician types before and after Add: their text and the plan both remain", async (opened) => {
  const enc = await encounter(opened, 1);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  const box = enc.locator('textarea[name="caseNote_note"]');
  await box.press("End");
  await box.pressSequentially("IOP 12 OD, 15 OS.");
  const msg = await add(tracker);
  assert.match(msg, /Added to today's note/, msg);
  await enc.bringToFront();
  await box.press("Control+End");
  await box.pressSequentially("Discussed side effects. RTC 1 week.");
  const note = await noteOf(enc);
  const i = note.indexOf("IOP 12 OD, 15 OS."), j = note.indexOf("Eye drop plan"), k = note.indexOf("Discussed side effects. RTC 1 week.");
  assert.ok(i >= 0 && j > i && k > j, `typing lost or out of order (${i}, ${j}, ${k})`);
  assert.ok(note.startsWith("[06-Nov-2026 .: ]"), "Oscar's date line changed");
  assert.equal(plans(note), 1);
  await fetch(`${OSCAR}/__standin/sign`, { method: "POST", body: JSON.stringify({ demographicNo: 1, note }) });
  const s = await saved();
  assert.equal(s.length, 1);
  assert.equal(s[0].note, note);
  ok("text before, plan, text after, all signed together");
});

// 15. The clinician reloads the same encounter before Add.
await scenario("15. encounter reloaded before Add: refused clearly, nothing written", async (opened) => {
  const enc = await encounter(opened, 3);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  await enc.reload();
  const msg = await add(tracker);
  assert.doesNotMatch(msg, /Added/, msg);
  assert.match(msg, /closed or has moved on|different patient/i, msg);
  assert.equal(plans(await noteOf(enc)), 0);
  assert.equal((await saved()).length, 0);
  ok(`refused: "${msg}"`);
});

// 16. Oscar hangs while saving a separate note.
await scenario("16. Oscar hangs while saving a separate note: the clinician gets an answer, nothing saved twice", async (opened) => {
  const enc = await encounter(opened, 1);
  const tracker = await readAndOpen(opened, enc);
  await toCalendar(tracker);
  await enc.locator('textarea[name="caseNote_note"]').evaluate((t) => t.remove());
  await standin("hang?service=save");
  const t0 = Date.now();
  const msg = await add(tracker);
  assert.ok(Date.now() - t0 < 20000);
  assert.doesNotMatch(msg, /^Added/, msg);
  assert.ok(msg.trim().length > 0, "blank answer");
  await standin("reset");
  await tracker.waitForTimeout(500);
  assert.equal((await saved()).length, 0);
  ok(`answer after ${Math.round((Date.now() - t0) / 1000)} s: "${msg}"`);
});

await context.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} passed, ${failed.length} failed`);
for (const f of failed) console.log(`  FAIL ${f.name}: ${f.why}`);
if (failed.length) {
  console.log("Edge cases: some checks failed");
  process.exit(1);
}
console.log("Edge cases: all checks passed");
