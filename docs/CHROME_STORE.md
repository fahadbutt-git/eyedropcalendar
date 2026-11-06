# Chrome Web Store listing: Eye Drop Tracker for Oscar

Everything the developer console asks for, ready to paste. Build the upload with `npm run ext:build`, which writes `oscar/extension/eye-drop-tracker-oscar-<version>.zip`. Images are in `store/chrome` (remake them with `node scripts/store-chrome.mjs`).

## Account

- Developer console: chrome.google.com/webstore/devconsole. One-time registration fee of US$5.
- Publisher name: Eye Drop Tracker. Contact email: eyedroptracker@gmail.com (it must be verified in the console).
- Visibility: **Unlisted** for the pilot. Only people with the link can install it, and it does not appear in search. A clinic's IT can also push it to its computers through Chrome policy using the extension ID.

## Store listing

**Name:** Eye Drop Tracker for Oscar

**Summary (132 characters):** Reads the eye drop plan from an Oscar chart into Eye Drop Tracker and adds it back to the chart. No data goes anywhere but Oscar.

**Category:** Productivity (Workflow and planning). **Language:** English (Canada).

**Description:**

Eye Drop Tracker for Oscar connects the Oscar EMR to Eye Drop Tracker (eyedroptracker.com), which turns an eye drop regimen into a printed calendar, a prescription and reminders on the patient's phone.

On a patient's encounter in Oscar, click the Eye Drop Tracker button, choose "Read eye drops with Eye Drop Tracker" from the right-click menu, or press Option+Shift+E (Alt+Shift+E on Windows). The extension reads the drops from the chart note being written, from text you select, from a saved note, or from the medication list.

- Each drop shows what was read and what had to be assumed (for example, an eye that was not stated), flagged for checking.
- Past drops, allergies, stopped drops, as-needed drops and medicines taken by mouth are listed but left out.
- Eye Drop Tracker opens with the drops filled in. The calendar and prescription stay locked until the clinician confirms every drop against the chart.
- Add to Oscar chart saves the finished plan to the same patient as an unsigned note, with a link that reopens the plan exactly at the next visit, so a taper can be changed without starting over. The extension writes the note itself from the plan, only after a click, only for the patient and clinician it was read from, and only once.

Privacy: the extension reads Oscar with your own Oscar login, in your browser. It has no server, sends nothing to its makers or anyone else, and runs on a page only when you ask it to.

For eye care teams using Oscar. Eye Drop Tracker is a scheduling and education aid, not a medical device. Clinicians remain responsible for checking every plan before it reaches a patient. Terms: https://eyedroptracker.com/terms.html

**Screenshots (1280 x 800):** `store/chrome/1-read.png`, `2-check.png`, `3-calendar.png`, `4-phone.png`, `5-chart.png`.

**Small promo tile (440 x 280):** `store/chrome/promo-440x280.png`. **Icon (128 x 128):** inside the package.

**Website:** https://eyedroptracker.com. **Support:** mailto:eyedroptracker@gmail.com.

## Privacy practices tab

**Single purpose:** Moves an eye drop plan between a clinician's Oscar chart and Eye Drop Tracker in the same browser, so the plan is not typed in twice.

**Permission justifications:**

| Permission | Why it is needed |
| --- | --- |
| activeTab | To read the open Oscar encounter only after the clinician clicks the button, uses the shortcut or chooses the menu item, and only in that tab. |
| scripting | To show the panel on that Oscar page and read the patient's notes and medication list through Oscar's own interface. |
| contextMenus | Oscar opens encounters in pop-up windows, which have no extension buttons. The right-click menu item is how the panel opens there. |
| storage | To hold the plan while it passes from the Oscar tab to the Eye Drop Tracker tab. It uses session storage, which Chrome clears when the browser closes. The drops, the sentence each was read from, the name and the date of birth are deleted as soon as Eye Drop Tracker takes them. What remains is the Oscar tab and patient number, so the plan can go back to the right chart. It is deleted when either tab closes, and after two hours at most. |
| Content script on eyedroptracker.com | To hand the plan to Eye Drop Tracker and take back the plan code when the clinician clicks Add to Oscar chart. It runs only on eyedroptracker.com, and the site address is fixed in the package. |

**Remote code:** No, I am not using remote code. All code is in the package.

**Data usage.** Tick these, because the extension handles them on the user's own computer:

- Personally identifiable information (the patient's name and date of birth, passed from Oscar to Eye Drop Tracker in the same browser)
- Health information (the drops, and the sentence each was read from, passed the same way)
- Health information (the eye drop plan and chart note text)

Then certify all three:

- I do not sell or transfer user data to third parties, outside of the approved use cases.
- I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
- I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://eyedroptracker.com/privacy.html (it has a section for clinics using the Oscar extension).

## Before submitting

- Test the packaged zip in Chrome on a demo Oscar: the toolbar button, Option+Shift+E and the right-click menu in an encounter pop-up, Open in Eye Drop Tracker, Add to Oscar chart, and reopening from the plan link.
- Raise `extensionVersion` in `package.json` for every new upload.
- Review usually takes a few days. Extensions that handle health information can take longer.
