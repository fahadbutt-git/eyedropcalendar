// End-to-end check of the Oscar extension against the stand-in Oscar.
//
// Run with `npm run test:oscar`, which starts the stand-in Oscar and the site.
//
// Opens a made-up patient's encounter in a pop-up window, as Oscar does,
// reads the drops, opens them in Eye Drop Tracker, checks the review gate,
// adds the chart note back, reopens the plan at the next visit, and reads a
// note that is still being typed.
import assert from "node:assert/strict";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { codeFromUrl } from "../../src/lib/share.js";
import { OSCAR, launch, openPanel as runPanel, signIn, standin } from "./harness.mjs";

await standin("reset");
const shots = process.argv[2];
if (shots) mkdirSync(shots, { recursive: true });
const shot = (page, name) => shots && page.screenshot({ path: join(shots, `${name}.png`) });

const { context, worker } = await launch("e2e");
const openPanel = (page, selection) => runPanel(worker, page, selection);

// Sign in to Oscar and open the first patient's encounter.
const schedule = await signIn(await context.newPage());
const encounterOf = async (name) => {
  const [popup] = await Promise.all([context.waitForEvent("page"), schedule.click(`text=${name}`)]);
  await popup.waitForLoadState();
  return popup;
};
let enc = await encounterOf("SAMPLE, Alex");
assert.match(enc.url(), /casemgmt\/forward\.jsp\?action=view&demographicNo=1/);
const isPopup = (page) =>
  worker.evaluate(async (url) => {
    const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
    return (await chrome.windows.get(tab.windowId)).type;
  }, page.url());
assert.equal(await isPopup(enc), "popup", "Oscar's encounter is a pop-up window");
// The Eye drops button sits on the encounter, so no shortcut or menu is
// needed. A script on the page cannot press it.
const launcher = enc.locator("#edt-oscar-launcher button");
await launcher.waitFor();
await enc.evaluate(() => document.getElementById("edt-oscar-launcher").shadowRoot.querySelector("button").click());
await enc.waitForTimeout(500);
assert.equal(await enc.locator("#edt-oscar-panel").count(), 0, "scripted click on the button does nothing");
await launcher.click();
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
// The health card and address come from Oscar's patient record, and the
// prescriber from the clinician signed in to Oscar, still to be confirmed.
assert.equal(await tracker.getByLabel("Health card number").inputValue(), "0000000001");
assert.equal(await tracker.getByLabel("Address").inputValue(), "1 Example Street, Toronto, ON M5V 0A1");
const rxer = JSON.parse(await tracker.evaluate(() => localStorage.getItem("edt.prescriber.v1")));
assert.equal(rxer.name, "Doctor Oscardoc");
assert.equal(rxer.license, "99999");
assert.equal(rxer.phone, "905-555-0100");
assert.equal(rxer.street, "100 Demo Street");
const list = await tracker.locator(".import-list > li > b").allTextContents();
assert.deepEqual(list, ["Xalatan", "Pred Forte"]);
assert.ok(await tracker.getByRole("button", { name: /Next: calendar/ }).isDisabled(), "calendar closed until checked");
await shot(tracker, "2-review");

// Each drop shows its sentence from the note and is ticked on its own. The
// calendar stays closed until every drop is ticked.
assert.equal(await tracker.locator(".import-source").count(), 2, "each drop shows its source sentence");
const ticks = tracker.locator(".import-review input[type=checkbox]");
await ticks.first().check();
assert.ok(await tracker.getByRole("button", { name: /Next: calendar/ }).isDisabled(), "still closed with one drop left");
await ticks.last().click();
await tracker.locator(".import-done").waitFor();
await tracker.getByRole("button", { name: /Next: calendar/ }).click();
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=Added to today's note in Oscar").waitFor();
// The panel does not mistake its own write for the clinician changing the note.
assert.equal(await enc.locator("#edt-oscar-panel .note-changed").count(), 0, "panel reacted to its own write");
await shot(tracker, "3-added");

// A kept signature: opt-in, offered only to the confirmed prescriber, and
// placed with a click on each prescription.
await tracker.locator("button.step", { hasText: "Prescription" }).click();
await tracker.locator(".prescriber-check button").first().click();
const pad = tracker.locator(".sig-pad canvas");
const box = await pad.boundingBox();
await tracker.mouse.move(box.x + 20, box.y + 40);
await tracker.mouse.down();
await tracker.mouse.move(box.x + 160, box.y + 70, { steps: 8 });
await tracker.mouse.up();
await tracker.getByLabel(/Keep this signature on this computer/).check();
await tracker.getByRole("button", { name: "Sign prescription" }).click();
await tracker.locator(".sig-saved img").waitFor();
const kept = JSON.parse(await tracker.evaluate(() => localStorage.getItem("edt.signature.saved.v2")));
assert.equal(kept.key, "Doctor Oscardoc|99999");
await tracker.getByRole("button", { name: "Remove" }).click();
await tracker.getByRole("button", { name: "Use my saved signature" }).click();
await tracker.locator(".sig-saved img").waitFor();
await tracker.getByRole("button", { name: "Remove" }).click();
// Another prescriber is never offered it.
await tracker.getByLabel("Prescriber name and credentials, after Dr.").fill("Someone Else");
assert.equal(await tracker.getByRole("button", { name: "Use my saved signature" }).count(), 0, "kept signature offered to another prescriber");
await tracker.getByLabel("Prescriber name and credentials, after Dr.").fill("Doctor Oscardoc");
await tracker.getByRole("button", { name: "Forget saved signature" }).click();
assert.equal(await tracker.evaluate(() => localStorage.getItem("edt.signature.saved.v2")), "null");
await tracker.locator("button.step", { hasText: "Calendar" }).click();

// The plan goes into today's open note, below what was written, and nothing
// is saved behind it, so Oscar never drops the clinician's draft.
assert.equal((await (await fetch(`${OSCAR}/__standin/saved`)).json()).length, 0, "no separate note saved");
const today = await enc.locator('textarea[name="caseNote_note"]').inputValue();
assert.match(today, /Pred Forte/);
assert.doesNotMatch(today, /Vigamox/);
assert.match(today, /^\[06-Nov-2026 \.: \][\s\S]*Eye drop plan/, "added below what was already there");
// The clinician signs today's note as usual.
await fetch(`${OSCAR}/__standin/sign`, { method: "POST", body: JSON.stringify({ demographicNo: 1, note: today }) });
const saved = await (await fetch(`${OSCAR}/__standin/saved`)).json();
assert.equal(saved.length, 1);
// The chart note's plan link carries drops only.
const linkCode = codeFromUrl(saved[0].note);
const decoded = Buffer.from(linkCode, "base64url").toString();
for (const secret of ["0000000001", "Example Street", "Alex", "SAMPLE", "1951"]) assert.ok(!decoded.includes(secret) && !saved[0].note.includes(secret), `plan link or note leaks ${secret}`);
assert.equal(saved[0].demographicNo, 1);

// A different patient on the Oscar tab: nothing is added.
await enc.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=2`);
await tracker.reload();
// The same plan again is refused as a repeat.
await tracker.getByRole("button", { name: "Add to Oscar chart" }).click();
await tracker.locator("text=already in the Oscar chart").waitFor();
// A changed plan is refused because the Oscar page has moved on.
await tracker.reload();
// A start date a week from the current one, so the plan always differs.
const start = await tracker.getByLabel("Start date").inputValue();
const later = new Date(`${start}T12:00:00`);
later.setDate(later.getDate() + 7);
await tracker.getByLabel("Start date").fill(later.toISOString().slice(0, 10));
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
const code = codeFromUrl(saved[0].note);
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

// The clinician keeps typing after the panel read the note: the panel offers
// to read it again, and the new drop appears.
await panel.locator('[data-act="close"]').click();
await third.reload();
await openPanel(third);
await panel.locator("text=Drops found").waitFor();
await third.locator('textarea[name="caseNote_note"]').press("End");
await third.locator('textarea[name="caseNote_note"]').pressSequentially(" Xalatan 1 gtt qhs OU.");
await panel.locator(".note-changed").waitFor();
await panel.locator('[data-act="reread"]').click();
await panel.locator(".note-changed").waitFor({ state: "detached" });
assert.deepEqual((await panel.locator(".drops > li strong").allTextContents()).sort(), ["Vigamox", "Xalatan"], "today's note read again");

// A new chart with no notes or medications says so.
const fresh = await context.newPage();
await fresh.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=6`);
await openPanel(fresh);
await fresh.locator("#edt-oscar-panel").locator("text=no notes or medications to read yet").waitFor();
// Writing the plan while the panel is open: only the offer to read again shows.
await fresh.locator('textarea[name="caseNote_note"]').pressSequentially(" Xalatan 1 gtt qhs OU.");
await fresh.locator("#edt-oscar-panel .note-changed").waitFor();
assert.equal(await fresh.locator("#edt-oscar-panel").locator("text=no notes or medications to read yet").count(), 0, "no contradictory empty message");

// Oscar refused the encounter: the panel reads nothing and says why.
await fresh.goto(`${OSCAR}/casemgmt/forward.jsp?action=view&demographicNo=6&denied=1`);
await openPanel(fresh);
await fresh.locator("#edt-oscar-panel .error").waitFor();
assert.match(await fresh.locator("#edt-oscar-panel .error").textContent(), /does not allow you to open this patient/);
assert.equal(await fresh.locator("#edt-oscar-panel .who").count(), 0, "no patient details shown");
await fresh.close();

// Prototype.js on the Oscar page does not reach the extension: the plan and
// the saved note above went through JSON intact.
assert.equal(await third.evaluate(() => JSON.stringify({ list: [1, 2] })), '{"list":"[\\"1\\",\\"2\\"]"}', "the page itself is affected");

await context.close();
console.log("Oscar extension end to end: all checks passed");
