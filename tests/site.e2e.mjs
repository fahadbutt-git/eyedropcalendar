// Walks through every function of the website in Chrome, as a clinician and
// then as a patient on a phone, against the built site on port 4173.
// Run with `npm run test:browser -- site` (or as part of `npm run test:browser`).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { chromium, devices } from "playwright";

const SITE = "http://localhost:4173/";
const ok = (what) => console.log(`ok    ${what}`);
const browser = await chromium.launch();
const context = await browser.newContext({ viewport: { width: 1360, height: 900 }, acceptDownloads: true });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
// Confirmations are answered yes, as a clinician would.
page.on("dialog", (d) => d.accept());

// Terms
await page.goto(SITE);
const agree = page.getByRole("button", { name: "Continue" });
assert.ok(await agree.isDisabled(), "Continue works before agreeing");
await page.getByRole("checkbox").check();
await agree.click();
await page.getByRole("heading", { name: "Patient and drops" }).waitFor();
ok("terms must be agreed before the tool opens");

// Step 1: patient and drops
await page.getByLabel("Patient name").fill("Alex SAMPLE");
await page.getByLabel("Date of birth").fill("1951-04-12");
await page.getByLabel("Health card number").fill("0000000001");
await page.getByLabel("Address").fill("1 Example Street, Toronto, ON");
const addDrop = async (name) => {
  const box = page.getByRole("combobox").last();
  await box.fill(name);
  await page
    .getByRole("option", { name: new RegExp(`^${name}`) })
    .first()
    .click();
};
await addDrop("Xalatan");
await addDrop("Pred Forte");
await addDrop("Vigamox");
assert.equal(await page.getByRole("button", { name: /^Remove / }).count(), 3);
ok("drops added from the formulary search");

// Eye, course and taper
// Each drop is a list item holding its own choices.
const dropRow = (name) => page.getByRole("listitem").filter({ has: page.getByRole("button", { name: `Remove ${name}` }) });
const vigamox = dropRow("Vigamox");
await vigamox.getByRole("radio", { name: "Right eye" }).check();
await vigamox.getByRole("radio", { name: "Fixed course" }).check();
const pred = dropRow("Pred Forte");
await pred.getByRole("radio", { name: "Taper" }).check();
await pred.getByRole("button", { name: /^4 weeks/ }).click();
await pred.locator(".taper-title", { hasText: "Taper, 28 days" }).waitFor();
ok("eye, fixed course and a 4-week taper template set per drop");

// Safety warning, then removing the drop clears it
await addDrop("Lumigan");
await page.locator(".notice.warn", { hasText: "Check before printing" }).waitFor();
assert.match(await page.locator(".notice.warn").first().textContent(), /Xalatan and Lumigan RC both contain a prostaglandin/);
await page.getByRole("button", { name: "Remove Lumigan RC" }).click();
assert.equal(await page.locator(".notice.warn", { hasText: "prostaglandin" }).count(), 0);
ok("two prostaglandins in one eye are flagged, and the flag goes with the drop");

// Step 2: calendar
await page.getByRole("button", { name: "Next: calendar" }).click();
await page.locator(".sheet").first().waitFor();
await page.locator('.sheet-qr img[alt^="QR code"]').waitFor();
const printButton = page.getByRole("button", { name: /^Print \d+ pages?/ });
const pagesBefore = Number((await printButton.textContent()).match(/\d+/)[0]);
await page.getByRole("checkbox", { name: /Daily chart/ }).check();
await page.getByRole("checkbox", { name: /Checklist/ }).check();
const pagesAfter = Number((await printButton.textContent()).match(/\d+/)[0]);
assert.ok(pagesAfter > pagesBefore, `${pagesBefore} pages, then ${pagesAfter} with the chart and checklist`);
// A checklist flows over as many printed pages as it needs, so it is one sheet on screen.
for (const kind of ["table.cal", "table.chart", "table.tbl-sched"]) assert.ok((await page.locator(kind).count()) > 0, `${kind} is drawn`);
await page.getByRole("radio", { name: /Large/ }).check();
const link = await page.getByRole("link", { name: "Preview on phone" }).getAttribute("href");
assert.match(link, /^http:\/\/localhost:4173\/#\/p\/[\w-]+$/);
const code = link.split("#/p/")[1];
const plan = Buffer.from(code, "base64url").toString();
for (const secret of ["Alex", "SAMPLE", "1951", "0000000001", "Example"])
  assert.ok(!plan.includes(secret), `the plan link carries ${secret}`);
assert.match(await page.locator(".sheet").first().textContent(), /Alex SAMPLE/);
assert.doesNotMatch(await page.locator(".sched-print").textContent(), /\b(OD|OS|OU)\b/, "eyes are written out on the calendar");
ok(`calendar, daily chart and checklist (${pagesAfter} pages), large print, QR code, and a link with drops only`);

// Step 3: prescription
await page.getByRole("button", { name: "Next: prescription" }).click();
const rxPrint = page.getByRole("button", { name: "Print prescription" });
assert.ok(await rxPrint.isDisabled(), "prints without prescriber details");
for (const box of await page.getByLabel("Dispense").all()) assert.equal(await box.inputValue(), "1", "dispense starts at 1");
const blanks = page.getByRole("button", { name: "Print with blanks to fill in by hand" });
assert.ok(!(await blanks.isDisabled()), "can print with blanks to fill in by hand");
ok("dispense starts at 1, and an incomplete prescription can print with blanks");
await page.getByLabel("Prescriber name and credentials, after Dr.").fill("Jane Smith, MD FRCSC");
await page.getByLabel("CPSO number").fill("12345");
await page.getByLabel("Practice street address").fill("2 Clinic Road");
await page.getByLabel("City, province or state").fill("Milton, ON");
for (const box of await page.getByLabel("Dispense").all()) await box.fill("5 mL");
await page.locator(".rx-print").getByText("Dr. Jane Smith, MD FRCSC").first().waitFor();
const sheet = await page.locator(".rx-print").textContent();
assert.match(sheet, /CPSO 12345/);
assert.match(sheet, /0000000001/, "health card on the prescription");
assert.match(sheet, /right eye/i);
assert.doesNotMatch(sheet, /\b(OD|OS|OU)\b/, "eyes are written out on the prescription");
assert.ok(!(await rxPrint.isDisabled()), "prints once everything is filled in");
assert.equal(await blanks.count(), 0, "the blanks option goes once nothing is missing");
ok("prescription with the full sig, eyes written out, prescriber and patient details");

// Signature drawn for one prescription, and kept only when asked
const pad = page.locator(".sig-pad canvas");
await pad.scrollIntoViewIfNeeded();
const b = await pad.boundingBox();
await page.mouse.move(b.x + 30, b.y + 40);
await page.mouse.down();
await page.mouse.move(b.x + 200, b.y + 80, { steps: 8 });
await page.mouse.up();
await page.getByRole("button", { name: "Sign prescription" }).click();
await page.locator('.rx-print img[alt="Prescriber signature"]').waitFor();
assert.equal(
  await page.evaluate(() => JSON.parse(localStorage.getItem("edt.signature.saved.v2"))),
  null,
  "a signature is kept without asking",
);
ok("signature drawn and placed on this prescription only");

// Formulary
await page.getByRole("button", { name: "Formulary" }).click();
await page.getByLabel("Search the formulary").fill("xal");
const [shown, all] = (await page.locator(".hint[role=status]").first().textContent()).match(/\d+/g).map(Number);
assert.ok(shown >= 1 && shown < all, `search shows ${shown} of ${all}`);
await page.locator("table.t").getByText("Xalatan").first().waitFor();
const [download] = await Promise.all([page.waitForEvent("download"), page.getByRole("button", { name: "Export" }).click()]);
const exported = JSON.parse(readFileSync(await download.path(), "utf8"));
assert.ok(exported.formulary.length >= 29, "export holds the whole list");
exported.formulary.push({ ...exported.formulary[0], brand: "Testdrop" });
await page
  .locator('input[type="file"]')
  .setInputFiles({ name: "formulary.json", mimeType: "application/json", buffer: Buffer.from(JSON.stringify(exported)) });
await page.getByLabel("Search the formulary").fill("Testdrop");
await page.getByRole("button", { name: "Edit Testdrop" }).waitFor();
await page.getByRole("button", { name: "Restore defaults" }).click();
await page.getByLabel("Search the formulary").fill("Testdrop");
assert.match(await page.locator(".hint[role=status]").first().textContent(), /^0 of/);
ok("formulary search, export, import of an edited list, and restore defaults");

// Plan link reopened at a later visit
await page.getByRole("button", { name: /Patient and drops/ }).click();
await page.getByRole("button", { name: "New patient" }).click();
assert.equal(await page.getByLabel("Patient name").inputValue(), "");
assert.equal(await page.getByRole("button", { name: /^Remove / }).count(), 0);
await page.getByText("Change a plan from an earlier visit").click();
await page.getByPlaceholder("Paste the link from their phone or chart").fill(link);
await page.getByRole("button", { name: "Open plan" }).click();
for (const name of ["Xalatan", "Pred Forte", "Vigamox"]) await page.getByRole("button", { name: `Remove ${name}` }).waitFor();
await dropRow("Pred Forte").locator(".taper-title", { hasText: "Taper, 28 days" }).waitFor();
ok("New patient clears everything, and a plan link reopens the drops");

// Idle clearing: a tab unused for 30 minutes comes back empty
await page.getByLabel("Patient name").fill("Alex SAMPLE");
await page.evaluate(() => sessionStorage.setItem("edt.lastActive", String(Date.now() - 31 * 60 * 1000)));
await page.reload();
await page.getByText("The last patient was cleared after 30 minutes without use.").waitFor();
assert.equal(await page.getByLabel("Patient name").inputValue(), "");
ok("a patient left open 30 minutes is cleared");

// Patient phone view
const phone = await browser.newContext({ ...devices["iPhone 13"], acceptDownloads: true });
const mobile = await phone.newPage();
mobile.on("pageerror", (e) => errors.push(e.message));
await mobile.goto(link);
await mobile.getByRole("heading", { level: 1 }).waitFor();
assert.match(await mobile.getByRole("heading", { level: 1 }).textContent(), /^Today/);
const progress = mobile.locator(".pt-head .mono");
const total = Number((await progress.textContent()).match(/of (\d+)/)[1]);
await mobile.locator("button.tick").first().click();
assert.equal(await progress.textContent(), `1 of ${total} done`);
await mobile.locator(".toast").getByRole("button", { name: "Undo" }).click();
assert.equal(await progress.textContent(), `0 of ${total} done`);
await mobile.getByRole("button", { name: "Larger text" }).click();
assert.ok(await mobile.evaluate(() => document.documentElement.classList.contains("large-text")));
await mobile.getByRole("button", { name: "Next day" }).click();
await mobile.getByRole("heading", { name: /^Tomorrow/ }).waitFor();
const [alarms] = await Promise.all([
  mobile.waitForEvent("download"),
  mobile.getByRole("button", { name: /Add alarms to my calendar/ }).click(),
]);
const ics = readFileSync(await alarms.path(), "utf8");
assert.match(ics, /BEGIN:VCALENDAR[\s\S]*BEGIN:VALARM/);
assert.doesNotMatch(ics, /Alex|SAMPLE/, "the alarm file carries no name");
await mobile.locator(".my-cap select").first().selectOption({ label: "Teal" });
await mobile.reload();
assert.equal(await mobile.locator(".my-cap select").first().inputValue(), "teal", "the bottle's own cap is remembered");
ok(`phone view: today's ${total} doses, tick and undo, larger text, next day, calendar alarms, own cap colour`);

// A damaged link is refused, never shown as a different plan
await mobile.goto(`${link.slice(0, -4)}AAAA`);
await mobile.getByRole("heading", { name: "This link did not open" }).waitFor();
ok("a damaged link is refused");

// Works offline after the first visit
await mobile.goto(link);
await mobile
  .waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 })
  .catch(async () => {
    await mobile.reload();
    await mobile.waitForFunction(() => navigator.serviceWorker?.controller != null, null, { timeout: 15000 });
  });
await phone.setOffline(true);
await mobile.reload();
await mobile.getByRole("heading", { level: 1 }).waitFor();
await phone.setOffline(false);
ok("the phone view opens offline after the first visit");

// Public pages
for (const p of [
  "terms.html",
  "clinic-terms.html",
  "privacy.html",
  "security.html",
  "accessibility.html",
  "licenses.txt",
  "manifest.webmanifest",
]) {
  const r = await fetch(SITE + p);
  assert.equal(r.status, 200, p);
}
ok("terms, clinic terms, privacy, security, accessibility, licences and manifest are served");

assert.deepEqual(errors, [], "no script errors on any page");
await browser.close();
console.log("Website walkthrough: all checks passed");
