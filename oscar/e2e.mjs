// End-to-end check of the Oscar extension against the stand-in Oscar.
//
//   npm run ext:build -- --dev
//   npm run oscar:standin            (port 8080)
//   npm run build && npm run preview (port 4173)
//   node oscar/e2e.mjs [screenshot folder]
//
// Opens a made-up patient's encounter in a pop-up window, as Oscar does,
// reads the drops, opens them in Eye Drop Tracker, checks the review gate,
// adds the chart note back, reopens the plan at the next visit, and reads a
// note that is still being typed.
import { TERMS_VERSION } from "../src/config.js";
import { chromium } from "playwright";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ext = join(dirname(fileURLToPath(import.meta.url)), "extension/dist");
const OSCAR = "http://localhost:8080/oscar";
await fetch(`${OSCAR}/__standin/reset`);
const SITE = "http://localhost:4173/";
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const shot = (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "edt-ext-")), {
  headless: true,
  // Chrome's full headless mode, which loads extensions.
  channel: "chromium",
  viewport: { width: 1360, height: 860 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));

// Sign in to Oscar and open the first patient's encounter.
const oscar = await context.newPage();
await oscar.goto(`${OSCAR}/index.jsp`);
await oscar.fill('input[name="username"]', "oscardoc");
await oscar.fill('input[name="password"]', "mac2002");
await oscar.fill('input[name="pin"]', "1117");
await oscar.click("button");
const schedule = oscar;
const encounterOf = async (name) => {
  const [popup] = await Promise.all([context.waitForEvent("page"), schedule.click(`text=${name}`)]);
  await popup.waitForLoadState();
  return popup;
};
let enc = await encounterOf("SAMPLE, Alex");
assert.match(enc.url(), /casemgmt\/forward\.jsp\?action=view&demographicNo=1/);

// The site's terms are accepted once for this browser.
const site = await context.newPage();
await site.goto(SITE);
await site.evaluate((v) => localStorage.setItem("edt.terms", JSON.stringify(v)), TERMS_VERSION);
await site.close();

// What the toolbar button, the shortcut and the right-click menu do: hand
// over any selected text, then run the panel in the encounter's tab.
const openPanel = (page, selection = "") =>
  worker.evaluate(
    async ({ url, selection }) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (t) => (window.__edtSelection = t), args: [selection] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
    },
    { url: page.url(), selection }
  );
const isPopup = (page) =>
  worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    return (await chrome.windows.get(tab.windowId)).type;
  }, page.url());
assert.equal(await isPopup(enc), "popup", "Oscar's encounter is a pop-up window");
await openPanel(enc);
let panel = enc.locator("#edt-oscar-panel");
await panel.locator("text=Drops found").waitFor();
const found = await panel.locator(".drops > li strong").allTextContents();
assert.deepEqual(found, ["Xalatan", "Pred Forte", "Vigamox"]);
assert.match(await panel.locator(".who").textContent(), /Alex SAMPLE/);
assert.match(await panel.locator(".skipped").textContent(), /Combigan/);
await shot(enc, "1-oscar-panel");

// Leave Vigamox out, then open the rest in Eye Drop Tracker.
await panel.locator('.drops input[data-i="2"]').uncheck();
const [tracker] = await Promise.all([context.waitForEvent("page"), panel.locator('[data-act="open"]').click()]);
await tracker.waitForLoadState();
await tracker.locator(".import-review").waitFor();
assert.equal(await isPopup(tracker), "normal", "Eye Drop Tracker opens in an ordinary window");
assert.equal(new URL(tracker.url()).hash, "#/oscar", "no chart content in the address");
assert.equal(await tracker.getByLabel("Patient name").inputValue(), "Alex SAMPLE");
const list = await tracker.locator(".import-list > li > b").allTextContents();
assert.deepEqual(list, ["Xalatan", "Pred Forte"]);
assert.ok(await tracker.getByRole("button", { name: /Next: calendar/ }).isDisabled(), "calendar closed until checked");
await shot(tracker, "2-review");

await tracker.locator(".import-review input[type=checkbox]").click();
await tracker.locator(".import-done").waitFor();
await tracker.getByRole("button", { name: /Next: calendar/ }).click();
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=Added to the Oscar chart").waitFor();
await shot(tracker, "3-added");

const saved = await (await fetch(`${OSCAR}/__standin/saved`)).json();
assert.equal(saved.length, 1);
assert.equal(saved[0].demographicNo, 1);
assert.equal(saved[0].isSigned, false);
assert.match(saved[0].note, /Pred Forte/);
assert.doesNotMatch(saved[0].note, /Vigamox/);

// A different patient on the Oscar tab: nothing is added.
await enc.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=2`);
await tracker.reload();
// The same plan again is refused as a repeat.
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=already in the Oscar chart").waitFor();
// A changed plan is refused because the Oscar page has moved on.
await tracker.reload();
await tracker.getByLabel("Start date").fill("2026-11-09");
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=/closed or has moved on|different patient/").waitFor();
assert.equal((await (await fetch(`${OSCAR}/__standin/saved`)).json()).length, 1);

// The next visit for the first patient: the newest note is the one Eye Drop
// Tracker added, so its plan link opens the plan exactly, with the same
// patient code (the patient keeps their check marks).
await enc.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=1`);
await openPanel(enc);
await panel.locator(".link-note").waitFor();
assert.deepEqual(await panel.locator(".drops > li strong").allTextContents(), ["Xalatan", "Pred Forte"]);
const [again] = await Promise.all([context.waitForEvent("page"), panel.locator('[data-act="open"]').click()]);
await again.locator("text=Opened from the plan link in the Oscar chart").waitFor();
const code = saved[0].note.match(/#\/p\/([\w-]+)/)[1];
const nonce = JSON.parse(Buffer.from(code, "base64url").toString()).n;
assert.equal(JSON.parse(await again.evaluate(() => sessionStorage.getItem("edt.schedule.v3"))).nonce, nonce);
await shot(again, "4-from-link");
await again.close();

// The second patient: a list sharing an eye, and a taper that carries on.
await enc.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=2`);
await openPanel(enc);
await panel.locator("text=Drops found").waitFor();
assert.deepEqual(await panel.locator(".drops > li strong").allTextContents(), ["Alphagan", "Dorzolamide", "Maxidex", "Maxidex"]);
await shot(enc, "5-second-patient");

// The third patient: the plan is only in today's note, still being typed.
const third = await encounterOf("TEST, Jordan");
await openPanel(third);
panel = third.locator("#edt-oscar-panel");
await panel.locator("text=Drops found").waitFor();
assert.equal(await panel.locator('[data-act="source"]').inputValue(), "draft");
assert.deepEqual(await panel.locator(".drops > li strong").allTextContents(), ["Vigamox"]);

// Text selected inside the note box, handed over by the right-click menu.
await third.reload();
await openPanel(third, "Start Vigamox TID OD x 7 days");
await panel.locator("text=Drops found").waitFor();
assert.equal(await panel.locator('[data-act="source"]').inputValue(), "selection");
assert.match(await panel.locator(".drops").textContent(), /3 times a day for 7 days/);

// Prototype.js on the Oscar page does not reach the extension: the plan and
// the saved note above went through JSON intact.
assert.equal(await third.evaluate(() => JSON.stringify({ list: [1, 2] })), '{"list":"[\\"1\\",\\"2\\"]"}', "the page itself is affected");

await context.close();
console.log("Oscar extension end to end: all checks passed");
