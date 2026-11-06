# Oscar extension

Eye Drop Tracker for Oscar is a Chrome extension. On an Oscar encounter it reads the eye drop plan from the chart, opens it in Eye Drop Tracker for checking, and adds the finished plan back to the chart as an unsigned note.

## How it works

1. The clinician opens a patient's encounter in Oscar and clicks the Eye Drop Tracker button in Chrome's toolbar. Oscar usually opens encounters in a pop-up window, which Chrome shows without extension buttons, so the panel also opens from the right-click menu (Read eye drops with Eye Drop Tracker) or with Option+Shift+E (Alt+Shift+E on Windows).
2. A panel on the right reads, in this order of preference: text the clinician selected, today's note while it is still being typed, the newest saved note that names a drop, or the medication list. It reads the patient's notes and medication list through Oscar's REST interface (`/ws/rs`), using the clinician's own Oscar login. It shows each drop it found, what it had to assume (the eye, the frequency, a strength), and what it saw but left out (past drugs, allergies, stopped drops, PRN drops, pills, lubricants).
3. The clinician unticks anything wrong and clicks Open in Eye Drop Tracker. The drops, the sentence each was read from, and the name and date of birth go to a new Eye Drop Tracker tab through the extension, not the address bar.
4. Eye Drop Tracker shows the assumptions again. The calendar and prescription stay closed until the clinician confirms every drop has been checked against the chart.
5. On the calendar page, Add to Oscar chart adds the plan to that same patient as an unsigned note, which the clinician signs in Oscar. The website sends only the plan code. The extension checks it is a real plan and writes the note text itself, so a page can never put its own words in a chart.

## Privacy

- Everything happens in the clinician's browser. Requests go from that computer to the clinic's own Oscar. Nothing goes to us or anyone else, and there is no server.
- The extension asks for no standing access to any website. It runs on an Oscar tab only when the clinician clicks its button there (`activeTab`), and sees only what that clinician can see in Oscar.
- The plan is held in Chrome's session storage until Eye Drop Tracker takes it, then deleted. Only the Oscar tab and patient number stay, so the plan can go back to the right chart. They are deleted when either tab closes, and after two hours at most.
- Eye Drop Tracker keeps the clinician's work in the tab's session storage only, and clears it after 30 minutes without use, including when a closed tab is reopened later.
- The clinic needs no keys, accounts or setup in Oscar.

Oscar also offers an OAuth interface (`/ws/services`), which needs the clinic's administrator to register the app. It is not used, because the notes service needs a logged-in session that OAuth calls do not have.

## Safeguards

Add to Oscar chart refuses, and saves nothing, when:

- the click did not come from a person (a script on either page cannot trigger it)
- the plan code is not a valid Eye Drop Tracker plan
- the Oscar tab has closed or now shows a different patient
- a different clinician is now signed in to Oscar
- the patient's name was changed in Eye Drop Tracker, or a different plan was opened by hand
- the same plan is already in the chart
- the hand-off is older than two hours

The panel ignores clicks made by scripts on the Oscar page, shows which site it is reading, and escapes everything it shows, so markup in a chart cannot run.

## Code

| Path | What it is |
| --- | --- |
| `src/lib/noteParser.js` | Reads drops from note text and Rx entries. Shared with the website. Tests in `tests/noteParser.test.mjs` |
| `oscar/extension/src/oscarApi.js` | Oscar REST calls (patient, notes, current drugs, add note) |
| `oscar/extension/src/panel.js` | The panel on the Oscar page |
| `oscar/extension/src/background.js` | Hands the plan between tabs |
| `oscar/extension/src/bridge.js` | Runs on Eye Drop Tracker and talks to the page |
| `src/lib/oscarBridge.js`, `src/components/drops/ImportReview.jsx`, `src/components/schedule/AddToChart.jsx` | The website side |
| `oscar/standin/` | A stand-in Oscar with made-up patients, for development |
| `oscar/e2e.mjs` | Runs the whole loop in Chrome against the stand-in |
| `oscar/security.mjs` | Tries to leak, forge and misuse data, and checks every attempt fails |

Build with `npm run ext:build` (writes `oscar/extension/dist` and a zip for the Chrome Web Store). Add `-- --dev` to also run on `localhost:4173` and `localhost:5173`.

## A demo Oscar on a Mac

Uses [Open OSP](https://github.com/open-osp/open-osp), which runs Oscar in Docker. Use made-up patients only.

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) and start it. In Settings, Resources, give it at least 6 GB of memory.
2. Install GNU sed, which the setup script expects: `brew install gnu-sed`.
3. In Terminal:

```
git clone https://github.com/open-osp/open-osp.git
cd open-osp
export PATH="$(brew --prefix)/opt/gnu-sed/libexec/gnubin:$PATH"
export DOCKER_DEFAULT_PLATFORM=linux/amd64
./openosp setup
./openosp bootstrap
./openosp start
```

Press Enter at every setup prompt. The `DOCKER_DEFAULT_PLATFORM` line runs Oscar's Intel images on Apple silicon. The first start takes several minutes.

4. Open http://localhost:8080/oscar and sign in. Open-O 25.05 uses `openodoc`, password `openo2025`, second level passcode `2025`. Older Oscar images use `oscardoc`, `mac2002`, `1117`.
5. Add two or three made-up patients, open an encounter for each and type a note. The notes in `oscar/standin/patients.mjs` are good examples.
6. To stop Oscar: `./openosp stop`. To start it again: `./openosp start`.

## Loading the extension

1. In Chrome, open `chrome://extensions` and turn on Developer mode.
2. Click Load unpacked and choose the `oscar/extension/dist` folder (or unzip the extension zip and choose that folder).
3. Pin Eye Drop Tracker for Oscar to the toolbar.
4. Open a made-up patient's encounter in the demo Oscar and click the button.

## Without Docker

The stand-in Oscar answers the same addresses with made-up patients:

```
npm run oscar:standin          # http://localhost:8080/oscar, same demo login
npm run build && npm run preview
npm run ext:build -- --dev
node oscar/e2e.mjs
node oscar/security.mjs
```

## Tested

- Unit tests for the note reader and the Oscar client (`tests/noteParser.test.mjs`, `tests/oscarApi.test.mjs`).
- `oscar/e2e.mjs` runs the built extension in Chrome against the stand-in, which copies Open-O 25: encounters in pop-up windows at casemgmt/forward.jsp, dates as milliseconds, the note being written in a textarea named caseNote_note, and Prototype.js on every page, which corrupts lists in JSON written from the page itself. The extension's code runs in Chrome's separate extension context, so it is not affected, and the test checks that.
- `oscar/security.mjs` runs 18 checks: markup in every chart field never runs, pages cannot message the extension, scripted clicks and forged requests reach nothing, free text cannot reach a chart, a different patient or clinician is refused, repeats are refused, malformed imports are cut down, storage is cleared, and all 135 requests stay on Oscar or Eye Drop Tracker with no patient details in any address.
- On a demo Open-O 25 (5 November 2026): the REST calls work with the browser login and need no CSRF token, the panel read a real note correctly, and Add to Oscar chart saved an unsigned note. Patients created through the REST interface are not admitted to a program and Oscar hides their notes, so demo patients must be added through Oscar's Add Patient screen.

## Before a real clinic

Check these on the demo Oscar first, then on a test copy of the clinic's Oscar from its hosting company. Never develop against a live chart.

- The encounter page address, or a hidden field on it, carries the patient number (`demographicNo`). If not, the panel needs a patient search, which `oscarApi.js` already supports.
- `/ws/rs` answers while signed in. Some newer Oscar builds add a CSRF token to these calls. If so, the panel must send it.
- Note dates, the order of notes, and how Rx entries are written in that clinic.
- Saved notes appear in the chart as unsigned and can be signed and edited as usual.

To give the extension to a clinic, publish it on the Chrome Web Store as unlisted, or have the clinic's IT install it through Chrome policy.
