// Privacy and abuse tests for the Oscar extension and Eye Drop Tracker, run
// in Chrome with the built extension against the stand-in Oscar.
//
//   npm run ext:build -- --dev
//   npm run oscar:standin            (port 8080, restart it first so no notes are saved)
//   npm run build && npm run preview (port 4173)
//   node oscar/security.mjs
//
// Each check prints a line. Any failure stops the run with an error.
import { TERMS_VERSION } from "../src/config.js";
import { chromium } from "playwright";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const ext = join(dirname(fileURLToPath(import.meta.url)), "extension/dist");
const OSCAR = "http://localhost:8080/oscar";
await fetch(`${OSCAR}/__standin/reset`);
const SITE = "http://localhost:4173/";
const ok = (what) => console.log(`ok  ${what}`);

const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), "edt-sec-")), {
  headless: true,
  channel: "chromium",
  viewport: { width: 1360, height: 860 },
  args: [`--disable-extensions-except=${ext}`, `--load-extension=${ext}`],
});
const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
const extensionId = new URL(worker.url()).host;

// Every request the browser makes, to check where data goes.
const requests = [];
context.on("request", (r) => requests.push(r.url()));

const oscar = await context.newPage();
await oscar.goto(`${OSCAR}/index.jsp`);
await oscar.fill('input[name="username"]', "oscardoc");
await oscar.fill('input[name="password"]', "mac2002");
await oscar.fill('input[name="pin"]', "1117");
await oscar.click("button");
const site = await context.newPage();
await site.goto(SITE);
await site.evaluate((v) => localStorage.setItem("edt.terms", JSON.stringify(v)), TERMS_VERSION);
await site.close();

const openPanel = (page) =>
  worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
  }, page.url());
const session = () => worker.evaluate(() => chrome.storage.session.get(null));

// 1. Markup in Oscar's data never runs, in the panel or in Eye Drop Tracker.
await oscar.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=4`);
const t0 = Date.now();
await openPanel(oscar);
const panel = oscar.locator("#edt-oscar-panel");
await panel.locator("text=Drops found").waitFor();
const panelMs = Date.now() - t0;
await oscar.waitForTimeout(500);
assert.equal(await oscar.evaluate(() => window.__pwned), undefined, "script in Oscar data ran in the page");
const injected = await oscar.evaluate(() => document.getElementById("edt-oscar-panel").shadowRoot.querySelectorAll("img, script, svg").length);
assert.equal(injected, 0, "markup from Oscar became elements in the panel");
assert.match(await panel.locator(".who").textContent(), /<img src=x/, "the name is shown as text");
ok("markup in patient name, note, provider and Rx is shown as text, never run");
assert.ok(panelMs < 2000, `panel took ${panelMs} ms`);
ok(`panel ready in ${panelMs} ms`);

// 2. A web page cannot talk to the extension directly.
const direct = await oscar.evaluate(async (id) => {
  try {
    await chrome.runtime.sendMessage(id, { type: "pending" });
    return "answered";
  } catch (e) {
    return "refused";
  }
}, extensionId);
assert.notEqual(direct, "answered");
ok("pages cannot message the extension (no external connections)");

// 2b. A script on the Oscar page cannot press the panel's buttons.
const before = context.pages().length;
await oscar.evaluate(() => document.getElementById("edt-oscar-panel").shadowRoot.querySelector('[data-act="open"]').click());
await oscar.waitForTimeout(800);
assert.equal(context.pages().length, before, "a scripted click opened Eye Drop Tracker");
ok("a script on the Oscar page cannot press the panel's buttons");

// 3. Open in Eye Drop Tracker. Nothing about the patient is in the address.
const t1 = Date.now();
const [tracker] = await Promise.all([context.waitForEvent("page"), panel.locator('[data-act="open"]').click()]);
await tracker.locator(".import-review").waitFor();
const openMs = Date.now() - t1;
assert.equal(new URL(tracker.url()).hash, "#/oscar");
assert.doesNotMatch(await tracker.title(), /HOSTILE|SAMPLE|1960/);
assert.equal(await tracker.evaluate(() => window.__pwned), undefined, "script ran in Eye Drop Tracker");
assert.equal(await tracker.evaluate(() => document.querySelectorAll("main img[src='x'], main svg[onload]").length), 0);
ok(`plan opened in Eye Drop Tracker in ${openMs} ms, address is only #/oscar, no markup ran`);
assert.ok(openMs < 4000, `opening took ${openMs} ms`);

// 4. The extension keeps nothing it does not need.
let stored = await session();
const handoffKey = Object.keys(stored).find((k) => k.startsWith("handoff:"));
assert.ok(handoffKey);
assert.equal(stored[handoffKey].payload, undefined, "the plan stayed in extension storage");
assert.doesNotMatch(JSON.stringify(stored), /HOSTILE|1960|Xalatan/, "patient details stayed in extension storage");
assert.deepEqual(await worker.evaluate(() => chrome.storage.local.get(null)), {});
ok("after hand-off the extension holds no name, date of birth or drops, and nothing persistent");

// 5. Forged requests from script on the Eye Drop Tracker page are refused.
const handoff = handoffKey.slice("handoff:".length);
const forge = (page, msg, withClick) =>
  page.evaluate(
    ({ msg, withClick }) =>
      new Promise((resolve) => {
        const id = Math.random().toString(36).slice(2);
        const listen = (e) => {
          if (e.data?.source === "edt-extension" && e.data.type === "added" && e.data.id === id) {
            window.removeEventListener("message", listen);
            resolve(e.data);
          }
        };
        window.addEventListener("message", listen);
        const send = () => window.postMessage({ source: "edt-page", type: "addToChart", id, ...msg }, location.origin);
        // Playwright's own script counts as a click for about 5 seconds, so a
        // request with no click is sent after that.
        if (!withClick) return setTimeout(send, 6000);
        const b = document.createElement("button");
        b.id = "forge";
        b.textContent = "forge";
        b.style.cssText = "position:fixed;left:0;top:0;z-index:99999";
        b.onclick = () => {
          b.remove();
          send();
        };
        document.body.append(b);
      }),
    { msg, withClick }
  );
// A valid plan code, as the page would send it.
const realCode = "eyJ2IjoyLCJuIjoidGVzdDAwMDEiLCJzIjoiMjAyNi0xMS0wNiIsInciOiIwODowMCIsImIiOiIyMjowMCIsImUiOltbIlhhbGF0YW4iLCJMYXRhbm9wcm9zdCAwLjAwNSUiLCJ0ZWFsIiwic29sdXRpb24iLDEsIk9TIiwxLCJvIiwxLDcsMSwwXV0sImMiOiIxeW1qMHhhMXc1YWhydyJ9";
let r = await forge(tracker, { handoff, code: realCode }, false);
assert.equal(r.ok, false);
assert.match(r.message, /Click Add to Oscar chart/);
ok("a script cannot write to the chart without a person's click");

let pending = forge(tracker, { handoff, code: "Patient is non-compliant, discharge from clinic.", text: "Patient is non-compliant." }, true);
await tracker.click("#forge");
r = await pending;
assert.equal(r.ok, false);
assert.match(r.message, /not an Eye Drop Tracker plan/);
ok("free text cannot be written: the extension writes the note itself from a valid plan");

pending = forge(tracker, { handoff: "00000000-0000-0000-0000-000000000000", code: realCode }, true);
await tracker.click("#forge");
r = await pending;
assert.equal(r.ok, false);
ok("a made-up hand-off is refused");

let saved = await (await fetch(`${OSCAR}/__standin/saved`)).json();
assert.equal(saved.length, 0, "a forged request reached Oscar");
ok("nothing reached Oscar from the forged requests");

// 5b. If another clinician signs in to Oscar in the meantime, nothing is written.
await tracker.locator(".import-review input[type=checkbox]").click();
await tracker.getByRole("button", { name: /Next: calendar/ }).click();
await fetch(`${OSCAR}/__standin/provider?no=111111`);
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=different person is now signed in").waitFor();
await fetch(`${OSCAR}/__standin/provider?no=999998`);
assert.equal((await (await fetch(`${OSCAR}/__standin/saved`)).json()).length, 0);
ok("a note is never saved under a different clinician who signed in later");
await tracker.reload();

// 6. The real button adds the plan once. The same plan again is refused.
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=Added to the Oscar chart").waitFor();
await tracker.reload();
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=already in the Oscar chart").waitFor();
saved = await (await fetch(`${OSCAR}/__standin/saved`)).json();
assert.equal(saved.length, 1);
assert.equal(saved[0].demographicNo, 4);
assert.equal(saved[0].isSigned, false);
ok("the plan is added once, unsigned, to the right patient, and a repeat is refused");

// 6b. Changing the patient on screen removes the way back to that chart.
await tracker.locator("text=Patient and drops").first().click();
const nameBox = tracker.getByLabel("Patient name");
const original = await nameBox.inputValue();
await nameBox.fill("Someone Else");
await tracker.getByRole("button", { name: /Next: calendar/ }).click();
assert.equal(await tracker.getByRole("button", { name: "Add to Oscar chart" }).count(), 0, "chart button stayed for another patient");
await tracker.locator("text=Patient and drops").first().click();
await nameBox.fill(original);
ok("the plan can go back only to the patient it was read from");

// 7. The import is checked: bad data cannot pollute or overflow the page.
const fuzz = await context.newPage();
await fuzz.goto(`${SITE}#/oscar`);
await fuzz.waitForTimeout(500);
await fuzz.evaluate(() => {
  const many = Array.from({ length: 200 }, () => ({ brand: "Xalatan", eye: "OS", freq: 1, mode: "ongoing", drops: 1, durationDays: 7, startDay: 1, steps: [], flags: ["x".repeat(5000)] }));
  const evil = JSON.parse('{"__proto__": {"polluted": true}, "brand": "Xalatan", "eye": "OS", "freq": 1, "mode": "ongoing"}');
  window.postMessage({ source: "edt-extension", type: "import", handoff: "h".repeat(500), patient: { name: "A‮B\u0000C".repeat(50), dob: "not a date" }, drops: [evil, { brand: "NotADrug" }, ...many], skipped: "nope" }, location.origin);
});
await fuzz.locator(".import-review").waitFor();
assert.equal(await fuzz.evaluate(() => ({}).polluted), undefined, "prototype polluted");
const shown = await fuzz.locator(".import-list > li").count();
assert.ok(shown <= 12, `${shown} drops shown`);
const name = await fuzz.getByLabel("Patient name").inputValue();
assert.ok(name.length <= 80 && !/[\u0000‮]/.test(name), "name not cleaned");
assert.equal(await fuzz.getByLabel("Date of birth").inputValue(), "");
const longest = await fuzz.evaluate(() => Math.max(...[...document.querySelectorAll(".import-list li li")].map((li) => li.textContent.length)));
assert.ok(longest <= 300);
ok("malformed imports are cut down: at most 12 drops, clean short text, no prototype pollution");
await fuzz.close();

// 8. New patient wipes the patient and the import from the browser tab.
await tracker.getByRole("tab", { name: /Patient and drops/ }).click().catch(() => tracker.locator("text=Patient and drops").first().click());
await tracker.evaluate(() => (window.confirm = () => true));
await tracker.getByRole("button", { name: "New patient" }).click();
const left = await tracker.evaluate(() => Object.keys(sessionStorage).filter((k) => /HOSTILE|Xalatan/.test(sessionStorage.getItem(k) || "")));
assert.deepEqual(left, []);
ok("New patient leaves no patient or plan in the tab's storage");

// 9. Closing either tab clears the extension's record of it.
await tracker.close();
await new Promise((res) => setTimeout(res, 500));
stored = await session();
assert.deepEqual(Object.keys(stored).filter((k) => k.includes(handoff)), []);
ok("closing the tab removes the hand-off from the extension");

// 10. On a page that is not Oscar the panel reads nothing and says so.
const other = await context.newPage();
await other.goto(`${SITE}?demographicNo=1`);
await openPanel(other);
await other.locator("#edt-oscar-panel .error").waitFor();
ok("on a page that is not Oscar the panel shows a plain error");
await other.close();

// 11. Where data went: only the clinic's Oscar and Eye Drop Tracker, and no
// patient details in any address.
const hosts = [...new Set(requests.map((u) => new URL(u).host))].filter((h) => h);
assert.deepEqual(hosts.filter((h) => !["localhost:8080", "localhost:4173"].includes(h)), []);
const leaky = requests.filter((u) => /HOSTILE|SAMPLE|EXAMPLE|1960-01-01|1951-04-12|Xalatan|Pred%20Forte/i.test(decodeURIComponent(u)));
assert.deepEqual(leaky, []);
ok(`${requests.length} requests, all to Oscar or Eye Drop Tracker, none with patient details in the address`);

await context.close();
console.log("Security and privacy checks: all passed");
