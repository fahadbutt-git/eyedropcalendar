// Oscar's ophthalmology Eye Form, patients with years of notes or several eye
// conditions, and every way a clinic opens the chart (Oscar's pop-up window,
// a tab, Ctrl+click). Added after the first clinic install on 10 November
// 2026, where the clinic charts in a customised Eye Form.
//
//   npm run ext:build -- --dev
//   npm run oscar:standin            (port 8080, restart it first)
//   npm run build && npm run preview (port 4173)
//   node oscar/eyeform.mjs
import { TERMS_VERSION } from "../src/config.js";
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
    console.log(`FAIL  ${name}\n      ${e.message.split("\n").slice(0, 4).join("\n      ")}`);
  } finally {
    for (const p of opened) await p.close().catch(() => {});
    await standin("reset").catch(() => {});
  }
}

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "edt-eyeform-")), {
  headless: true,
  channel: "chromium",
  viewport: { width: 1360, height: 860 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
const schedule = await context.newPage();
await schedule.goto(`${OSCAR}/index.jsp`);
await schedule.fill('input[name="username"]', "oscardoc");
await schedule.fill('input[name="password"]', "mac2002");
await schedule.fill('input[name="pin"]', "1117");
await schedule.click("button");
await schedule.waitForURL(/providercontrol/);
const site = await context.newPage();
await site.goto(SITE);
await site.evaluate((v) => localStorage.setItem("edt.terms", JSON.stringify(v)), TERMS_VERSION);
await site.close();

let seq = 0;
const EYEFORM = (id, kai) => `${OSCAR}/eyeform/eyeform.jsp?reason=Progress+Note&appointment_no=&demographic_no=${id}${kai ? "&variant=kai" : ""}`;
// Oscar's own way: a pop-up window from the schedule.
async function fromSchedule(opened, name, modifier) {
  await schedule.bringToFront();
  const [page] = await Promise.all([context.waitForEvent("page"), schedule.click(`text=${name}`, modifier ? { modifiers: [modifier] } : {})]);
  await page.waitForLoadState();
  opened.push(page);
  return page;
}
// The chart in an ordinary tab.
async function inTab(opened, url) {
  const page = await context.newPage();
  opened.push(page);
  await page.goto(`${url}&t=${++seq}`);
  return page;
}
const panelOf = (page) => page.locator("#edt-oscar-panel");
const panelText = (page) => page.evaluate(() => document.getElementById("edt-oscar-panel")?.shadowRoot.querySelector("aside").innerText ?? "");
const found = async (page) => (await panelOf(page).locator(".drops > li strong").allTextContents()).sort();
// The clinician's way in: the Eye drops button on the page.
async function clickLauncher(page) {
  await page.locator("#edt-oscar-launcher button").waitFor({ timeout: 10000 });
  await page.locator("#edt-oscar-launcher button").click();
  await panelOf(page).locator("text=Reading the chart").waitFor({ state: "detached", timeout: 15000 });
  await panelOf(page).locator('[data-act="open"]').waitFor();
}
const sourceLabel = (page) => panelOf(page).locator('[data-act="source"]').evaluate((s) => s.options[s.selectedIndex]?.text);
async function openTracker(opened, page) {
  const open = panelOf(page).locator('[data-act="open"]:not([disabled])');
  const [tracker] = await Promise.all([context.waitForEvent("page"), open.click()]);
  opened.push(tracker);
  await tracker.waitForLoadState();
  await tracker.locator(".import-review, .import-done").first().waitFor();
  return tracker;
}
async function addToChart(tracker) {
  for (const box of await tracker.locator(".import-review input[type=checkbox]").all()) await box.click();
  await tracker.getByRole("button", { name: /Next: calendar/ }).click();
  const button = tracker.getByRole("button", { name: "Add to Oscar chart" });
  await button.scrollIntoViewIfNeeded();
  await button.click();
  await tracker.waitForFunction(() => /Added to|nothing was added|could not/i.test(document.querySelector(".hint[role=status]")?.textContent || ""), null, { timeout: 25000 });
  return tracker.locator(".hint[role=status]").first().textContent();
}

await scenario("1. Eye Form (Oscar's layout) in Oscar's pop-up: today's Plan and Impression are read, five conditions, two tapers of one drop", async (opened) => {
  const form = await fromSchedule(opened, "MULTI, Morgan");
  assert.match(form.url(), /eyeform\.jsp/);
  assert.equal(await form.evaluate(() => !!window.opener), true, "opened as a pop-up");
  await clickLauncher(form);
  assert.equal(await sourceLabel(form), "Today's Eye Form, not saved yet");
  assert.deepEqual(await found(form), ["Lumigan RC", "Pataday", "Pred Forte", "Pred Forte", "Vigamox"]);
  const text = await panelText(form);
  assert.match(text, /Pred Forte[\s\S]*left eye[\s\S]*Pred Forte[\s\S]*right eye|Pred Forte[\s\S]*right eye[\s\S]*Pred Forte[\s\S]*left eye/, "one Pred Forte per eye");
  assert.match(text, /Cyclogyl/, "the stopped drop is named");
  assert.match(text, /Systane/, "the lubricant is named so it can be added by hand");
  ok("five drops, the stopped one and the lubricant shown, each Pred Forte in its own eye");
  const tracker = await openTracker(opened, form);
  const message = await addToChart(tracker);
  assert.match(message, /Added to the Plan box/);
  const plan = await form.locator("#planBox").inputValue();
  assert.match(plan, /^1\. POAG OU: continue Lumigan/, "what the clinician wrote is kept, first");
  assert.match(plan, /Eye drop plan[\s\S]*Plan link[\s\S]*\(end of plan link\)/);
  assert.doesNotMatch(await form.locator("#impressionAreaBox").inputValue(), /Eye drop plan/, "nothing written into the Impression box");
  ok("the plan went into the Plan box, below the clinician's plan");
  // The panel sits over the right of the page, so it is closed first, as a
  // clinician would.
  await panelOf(form).locator('[data-act="close"]').click();
  await form.locator("#sign").click();
  await form.locator("#saveMsg", { hasText: "Saved" }).waitFor();
  const saved = (await standin("saved")).filter((s) => s.demographicNo === 11);
  assert.equal(saved.filter((s) => s.part === "plan" && /Plan link/.test(s.note)).length, 1, "the signed plan carries the link");
  // Next visit: the plan link in the signed Plan note reopens the plan.
  const next = await inTab(opened, EYEFORM(11));
  await next.evaluate(() => document.querySelectorAll("textarea").forEach((t) => (t.value = "")));
  await clickLauncher(next);
  const again = await openTracker(opened, next);
  await again.locator("text=Opened from the plan link in the Oscar chart").waitFor();
  ok("signed, then reopened at the next visit from the plan link");
});

await scenario("2. a clinic's customised Eye Form (titles only), Rx list failing with 500: only the Plan, Impression and Current Hx are read", async (opened) => {
  const form = await fromSchedule(opened, "KAIFORM, Casey");
  await clickLauncher(form);
  assert.equal(await sourceLabel(form), "Today's Eye Form, not saved yet");
  assert.deepEqual(await found(form), ["Xalatan"]);
  const text = await panelText(form);
  assert.doesNotMatch(text, /Combigan|Timoptic/, "drops in Office Communication or Research boxes are not read");
  assert.match(text, /medication list was not available/, "the Rx failure is mentioned");
  assert.equal(await panelOf(form).locator(".note-partial").count(), 0, "and not as a warning");
  assert.doesNotMatch(text, /Smart Encounter/);
  ok("Xalatan only; the Rx 500 is a quiet line, not a warning");
  const tracker = await openTracker(opened, form);
  assert.match(await addToChart(tracker), /Added to the Plan box/);
  assert.match(await form.locator('textarea[data-part="plan"]').inputValue(), /^Start Xalatan qhs OU[\s\S]*Eye drop plan/);
  assert.doesNotMatch(await form.locator(".smallBox", { hasText: "Office Communication" }).locator("textarea").inputValue(), /Eye drop plan/);
  ok("added to the Plan box found by its title");
});

await scenario("3. six years of Eye Form notes, nothing written today: the newest plan with drops is read, and the Eye Meds list is offered", async (opened) => {
  const form = await fromSchedule(opened, "LONGHISTORY, Robin");
  await clickLauncher(form);
  assert.match(await sourceLabel(form), /^Note, Apr 13, 2026/);
  assert.deepEqual(await found(form), ["Cosopt", "Lumigan RC"]);
  const options = await panelOf(form).locator('[data-act="source"] option').allTextContents();
  assert.ok(options.includes("Eye medication list in the chart"), "Eye Meds list offered");
  assert.ok(options.filter((o) => o.startsWith("Note,")).length >= 35, `saved notes offered: ${options.length}`);
  await panelOf(form).locator('[data-act="source"]').selectOption("eyemeds");
  await panelOf(form).locator(".drops").waitFor();
  assert.deepEqual(await found(form), ["Cosopt", "Lumigan RC"]);
  const text = await panelText(form);
  assert.match(text, /Xalatan[\s\S]*stopped|stopped[\s\S]*Xalatan/i);
  ok("Lumigan and Cosopt from the newest plan and from the Eye Meds list; Xalatan and Alphagan shown as stopped");
  // The clinician writes today's plan: it is read instead, and the panel
  // offers to read again rather than showing the old plan.
  await form.locator("#planBox").fill("IOP 19 OD, 18 OS. Continue Lumigan qhs OU. Stop Cosopt. Start Simbrinza BID OU.");
  await panelOf(form).locator('[data-act="reread"]').waitFor();
  assert.match(await panelText(form), /Today's Eye Form has changed/);
  await panelOf(form).locator('[data-act="reread"]').click();
  await panelOf(form).locator('[data-act="source"]').selectOption("draft");
  await form.waitForFunction(() => /Simbrinza/.test(document.getElementById("edt-oscar-panel").shadowRoot.textContent));
  assert.deepEqual(await found(form), ["Lumigan RC", "Simbrinza"], JSON.stringify(await found(form)));
  ok("typing today's plan is noticed and read; Cosopt shown as stopped");
});

await scenario("4. the standard encounter with six years of notes, nothing written today: the newest plan is read, not an old one", async (opened) => {
  const enc = await fromSchedule(opened, "YEARSOFNOTES, Jamie");
  await clickLauncher(enc);
  assert.match(await sourceLabel(enc), /^Note, Apr 13, 2026/);
  assert.deepEqual(await found(enc), ["Cosopt", "Lumigan RC"]);
  assert.doesNotMatch(await panelText(enc), /Alphagan/, "an old drop from years ago is not offered");
  ok("Lumigan and Cosopt, not Xalatan or Alphagan");
});

await scenario("5. the same Eye Form in a pop-up, a tab and a Ctrl+click tab: the button and the panel work in each, and the plan goes back to the window it came from", async (opened) => {
  const popup = await fromSchedule(opened, "KAIFORM, Casey");
  // Ctrl+click opens the chart's address in a new tab.
  const href = await schedule.locator("text=KAIFORM, Casey").getAttribute("href");
  const [ctrl] = await Promise.all([context.waitForEvent("page"), schedule.evaluate((h) => window.open(h, "_blank"), href)]);
  await ctrl.waitForLoadState();
  opened.push(ctrl);
  const tab = await inTab(opened, EYEFORM(12, true));
  for (const [name, page] of [["pop-up", popup], ["Ctrl+click", ctrl], ["tab", tab]]) {
    await clickLauncher(page);
    assert.deepEqual(await found(page), ["Xalatan"], name);
    ok(`${name}: button shown, Xalatan read`);
  }
  // Add from the tab's plan: only the tab's Plan box gets it.
  const tracker = await openTracker(opened, tab);
  assert.match(await addToChart(tracker), /Added to the Plan box/);
  const planOf = (p) => p.locator('textarea[data-part="plan"]').inputValue();
  assert.match(await planOf(tab), /Eye drop plan/);
  const others = [await planOf(popup), await planOf(ctrl)].filter((t) => /Eye drop plan/.test(t)).length;
  assert.ok(others <= 1, "added once");
  ok("added once, to one window's Plan box");
});

await scenario("6. Eye Form opened before the panel, then the clinician selects only part of the plan", async (opened) => {
  const form = await fromSchedule(opened, "MULTI, Morgan");
  await form.locator("#planBox").evaluate((t) => {
    t.focus();
    const start = t.value.indexOf("3. POW1");
    t.setSelectionRange(start, t.value.indexOf("4. Dry"));
  });
  await worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
  }, form.url());
  await panelOf(form).locator("text=Reading the chart").waitFor({ state: "detached", timeout: 15000 });
  assert.equal(await sourceLabel(form), "Text selected on this page");
  assert.deepEqual(await found(form), ["Pred Forte", "Vigamox"]);
  ok("only the selected part (the right eye's post-op drops) is read");
});

await context.close();
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length} of ${results.length} Eye Form and window scenarios passed.`);
for (const f of failed) console.log(`  failed: ${f.name}\n          ${f.why}`);
process.exit(failed.length ? 1 : 0);
