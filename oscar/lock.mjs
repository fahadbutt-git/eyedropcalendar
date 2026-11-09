// A copy of the extension locked to another clinic's Oscar must never offer,
// ask for or show the Eye drops button on this Oscar. Build it first with:
//   EDT_LOCK_TEST=1 npm run ext:build -- --dev --oscar=https://other-clinic.example.com
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const ext = join(dirname(fileURLToPath(import.meta.url)), "extension/dist");
const OSCAR = "http://localhost:8080/oscar";
const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
assert.deepEqual(manifest.optional_host_permissions, ["https://other-clinic.example.com/*"], "only the named clinic can be asked for");

await fetch(`${OSCAR}/__standin/reset`);
const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "edt-lock-")), {
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
const [enc] = await Promise.all([context.waitForEvent("page"), oscar.click("text=SAMPLE, Alex")]);
await enc.waitForLoadState();
await enc.waitForTimeout(1500);
assert.equal(await enc.locator("#edt-oscar-launcher").count(), 0, "no button on an Oscar the copy is not locked to");

await worker.evaluate(async (url) => {
  const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
  await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
}, enc.url());
const panel = enc.locator("#edt-oscar-panel");
await panel.locator('[data-act="open"]').waitFor();
await enc.waitForTimeout(800);
assert.equal(await panel.locator('[data-act="setup"]').count(), 0, "the panel does not offer the button here");
const pages = context.pages().length;
await enc.evaluate(() => chrome.runtime?.sendMessage?.({ type: "setup" })).catch(() => {});
await enc.waitForTimeout(800);
assert.equal(context.pages().length, pages, "no setup window opens for this Oscar");
const scripts = await worker.evaluate(() => chrome.scripting.getRegisteredContentScripts());
assert.equal(scripts.length, 0, "no button script is registered");
await context.close();
console.log("Address lock: all checks passed");
