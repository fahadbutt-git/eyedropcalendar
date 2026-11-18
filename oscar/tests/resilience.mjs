// If an Oscar build answers some services differently, the panel says which
// one failed and still reads today's unsaved note.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TERMS_VERSION } from "../src/config.js";

const ext = join(dirname(fileURLToPath(import.meta.url)), "extension/dist");
const OSCAR = "http://localhost:8080/oscar";
await fetch(`${OSCAR}/__standin/reset`);
await fetch(`${OSCAR}/__standin/break?service=notes`);
await fetch(`${OSCAR}/__standin/break?service=rx`);
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "edt-res-")), {
  headless: true,
  channel: "chromium",
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
// The clinician has already agreed to the terms on Eye Drop Tracker.
const site = await context.newPage();
await site.goto("http://localhost:4173/");
await site.evaluate((v) => localStorage.setItem("edt.terms", JSON.stringify(v)), TERMS_VERSION);
await site.close();
const oscar = await context.newPage();
await oscar.goto(`${OSCAR}/index.jsp`);
await oscar.fill('input[name="username"]', "oscardoc");
await oscar.fill('input[name="password"]', "mac2002");
await oscar.fill('input[name="pin"]', "1117");
await oscar.click("button");
// Jordan TEST has drops in today's unsaved note.
const [enc] = await Promise.all([context.waitForEvent("page"), oscar.click("text=TEST, Jordan")]);
await enc.waitForLoadState();
await worker.evaluate(async (url) => {
  const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
}, enc.url());
const panel = enc.locator("#edt-oscar-panel");
await panel.locator(".note-partial").first().waitFor();
const text = await enc.evaluate(() => document.getElementById("edt-oscar-panel").shadowRoot.querySelector("aside").innerText);
assert.match(text, /Oscar did not send the saved notes \(POST notes\/#\/all: 500\)/);
assert.match(text, /medication list was not available/);
assert.match(text, /Vigamox/, "today's unsaved note is still read");
assert.doesNotMatch(text, /notes\/3\//, "no patient number in the details");
await enc.close();

// A note in shorthand the reader does not know: the panel says so, names the
// word, and still opens Eye Drop Tracker with the patient, for drops by hand.
await fetch(`${OSCAR}/__standin/reset`);
const [enc2] = await Promise.all([context.waitForEvent("page"), oscar.click("text=SHORTHAND, Casey")]);
await enc2.waitForLoadState();
await worker.evaluate(async (url) => {
  const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
}, enc2.url());
const open = enc2.locator("#edt-oscar-panel").getByRole("button", { name: "Open Eye Drop Tracker and add drops by hand" });
await open.waitFor();
await enc2.locator("#edt-oscar-panel").locator("text=Not recognised").waitFor();
const text2 = await enc2.evaluate(() => document.getElementById("edt-oscar-panel").shadowRoot.querySelector("aside").innerText);
assert.match(text2, /Not recognised/i);
assert.match(text2, /Vgmx/);
const [tracker] = await Promise.all([context.waitForEvent("page"), open.click()]);
await tracker.waitForLoadState();
await tracker.locator("text=Patient read from the Oscar chart").waitFor();
assert.match(await tracker.locator(".import-review").innerText(), /Vgmx/);
assert.equal(await tracker.getByLabel("Patient name").inputValue(), "Casey SHORTHAND");
await context.close();
await fetch(`${OSCAR}/__standin/reset`);
console.log("Resilience on a differing Oscar: all checks passed");
