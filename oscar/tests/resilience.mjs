// If an Oscar build answers some services differently, the panel says which
// one failed and still reads today's unsaved note.
import assert from "node:assert/strict";
import { launch, openPanel, signIn, standin } from "./harness.mjs";

await standin("reset");
await standin("break?service=notes");
await standin("break?service=rx");
const { context, worker } = await launch("resilience");
const oscar = await signIn(await context.newPage());
// Jordan TEST has drops in today's unsaved note.
const [enc] = await Promise.all([context.waitForEvent("page"), oscar.click("text=TEST, Jordan")]);
await enc.waitForLoadState();
await openPanel(worker, enc);
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
await standin("reset");
const [enc2] = await Promise.all([context.waitForEvent("page"), oscar.click("text=SHORTHAND, Casey")]);
await enc2.waitForLoadState();
await openPanel(worker, enc2);
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
await standin("reset");
console.log("Resilience on a differing Oscar: all checks passed");
