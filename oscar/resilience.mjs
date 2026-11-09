// If an Oscar build answers some services differently, the panel says which
// one failed and still reads today's unsaved note.
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

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
assert.match(text, /Saved notes could not be read \(POST notes\/#\/all: 500\)/);
assert.match(text, /medication list could not be read/);
assert.match(text, /Vigamox/, "today's unsaved note is still read");
assert.doesNotMatch(text, /notes\/3\//, "no patient number in the details");
await context.close();
await fetch(`${OSCAR}/__standin/reset`);
console.log("Resilience on a differing Oscar: all checks passed");
