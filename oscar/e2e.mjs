// End-to-end check of the Oscar extension against the stand-in Oscar.
//
//   npm run ext:build -- --dev
//   npm run oscar:standin            (port 8080)
//   npm run build && npm run preview (port 4173)
//   node oscar/e2e.mjs [screenshot folder]
//
// Opens a made-up patient's encounter, reads the drops, opens them in Eye
// Drop Tracker, checks the review gate, and adds the chart note back.
import { chromium } from "playwright";
import { mkdtempSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ext = join(dirname(fileURLToPath(import.meta.url)), "extension/dist");
const OSCAR = "http://localhost:8080/oscar";
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
await worker.evaluate((site) => chrome.storage.local.set({ site }), SITE);

// Sign in to Oscar and open the first patient's encounter.
const oscar = await context.newPage();
await oscar.goto(`${OSCAR}/index.jsp`);
await oscar.fill('input[name="username"]', "oscardoc");
await oscar.fill('input[name="password"]', "mac2002");
await oscar.fill('input[name="pin"]', "1117");
await oscar.click("button");
await oscar.click("text=SAMPLE, Alex");
await oscar.waitForURL(/CaseManagementEntry/);

// The site's terms are accepted once for this browser.
const site = await context.newPage();
await site.goto(SITE);
await site.evaluate(() => localStorage.setItem("edt.terms", JSON.stringify("2026-11-03")));
await site.close();

// What a click on the toolbar button does.
const openPanel = () =>
  worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: "http://localhost:8080/*" });
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
  });
await openPanel();
const panel = oscar.locator("#edt-oscar-panel");
await panel.locator("text=Drops found").waitFor();
const found = await panel.locator(".drops > li strong").allTextContents();
assert.deepEqual(found, ["Xalatan", "Pred Forte", "Vigamox"]);
assert.match(await panel.locator(".who").textContent(), /Alex SAMPLE/);
assert.match(await panel.locator(".skipped").textContent(), /Combigan/);
await shot(oscar, "1-oscar-panel");

// Leave Vigamox out, then open the rest in Eye Drop Tracker.
await panel.locator('.drops input[data-i="2"]').uncheck();
const [tracker] = await Promise.all([context.waitForEvent("page"), panel.locator('[data-act="open"]').click()]);
await tracker.waitForLoadState();
await tracker.locator(".import-review").waitFor();
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
await oscar.goto(`${OSCAR}/CaseManagementEntry.do?method=edit&demographicNo=2`);
await tracker.reload();
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=/closed or has moved on|different patient/").waitFor();
assert.equal((await (await fetch(`${OSCAR}/__standin/saved`)).json()).length, 1);

// The next visit for the first patient: the newest note is the one Eye Drop
// Tracker added, so its plan link opens the plan exactly, with the same
// patient code (the patient keeps their check marks).
await oscar.goto(`${OSCAR}/CaseManagementEntry.do?method=edit&demographicNo=1`);
await openPanel();
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
await oscar.goto(`${OSCAR}/CaseManagementEntry.do?method=edit&demographicNo=2`);
await openPanel();
await panel.locator("text=Drops found").waitFor();
assert.deepEqual(await panel.locator(".drops > li strong").allTextContents(), ["Alphagan", "Dorzolamide", "Maxidex", "Maxidex"]);
await shot(oscar, "5-second-patient");

await context.close();
console.log("Oscar extension end to end: all checks passed");
