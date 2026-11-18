// A copy of the extension locked to another clinic's Oscar must never offer,
// ask for or show the Eye drops button on this Oscar. `npm run test:browser`
// builds that copy for this suite.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { EXTENSION, launch, openPanel, signIn, standin } from "./harness.mjs";

const manifest = JSON.parse(readFileSync(join(EXTENSION, "manifest.json"), "utf8"));
assert.deepEqual(manifest.optional_host_permissions, ["https://other-clinic.example.com/*"], "only the named clinic can be asked for");

await standin("reset");
const { context, worker } = await launch("lock", { acceptTerms: false });
const oscar = await signIn(await context.newPage());
const [enc] = await Promise.all([context.waitForEvent("page"), oscar.click("text=SAMPLE, Alex")]);
await enc.waitForLoadState();
await enc.waitForTimeout(1500);
assert.equal(await enc.locator("#edt-oscar-launcher").count(), 0, "no button on an Oscar the copy is not locked to");

await openPanel(worker, enc);
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
