# Eye Drop Tracker

A free, open-source tool that helps eye care teams turn a drop regimen into a patient calendar, a prescription and phone reminders in a few clicks.

**Live:** [eyedroptracker.com](https://eyedroptracker.com)  
**Licence:** Apache 2.0

## Why

Adherence to glaucoma and post-operative drops is poor, and complex regimens (several drops, different eyes, tapers) are a common source of error for patients and prescribers. This tool lets the prescriber enter the regimen once and produces everything the patient needs from that single source:

- a printed calendar with tick boxes for every dose
- a prescription with a sig written out in full
- a phone view with a daily checklist and calendar alarms

## How it works

1. **Patient and drops.** Enter the patient, then add each drop and choose the eye: right, left or both. How often and how many drops fill in from the formulary and can be changed. Each drop is ongoing, a fixed course of days, or a taper.
2. **Calendar.** Print a calendar the patient ticks off. A QR code on the sheet opens the plan on their phone.
3. **Prescription.** Print a prescription with the full sig for every drug.

## Features

**Drops**
- One list for both eyes, with right, left or both chosen per drop
- Taper builder with templates (weekly QID to daily, 2-week taper, Durezol) and editable steps
- Delayed start for drops that begin later
- Warning when two drugs in one eye share a class, or a drug is listed twice

**Calendar**
- Month pages when the plan fills whole months, otherwise weekly pages from the start date
- Numbered drugs, usual cap colours (can be turned off) with a space to write the bottle's own cap, and one tick box per dose
- Taper changes (for example ↓3x) and stop days marked on the day they happen
- Plain wording for patients, suggested dose times and how-to instructions
- Large print for low vision: bigger text and boxes, 2 weeks per page
- Three printed layouts the patient can choose from, in any mix: month calendar, daily chart (one page a week, a row for each time of day) and checklist

**Prescription**
- Prescriber details saved on the device, with clinic, address, phone and fax optional
- Full sig with the eye written out (no OD, OS or OU), dispense, refills and an ODB LU code chosen per drug from the codes that apply
- Patient's address and healthcare number appear only when entered
- Leave off any drug the patient already has

**Phone**
- Opens from the QR code with no account
- Today's drops grouped by time, tap each one when done, with progress for the day
- Reminders: real notifications in the iOS and Android app, or calendar alarms from the browser
- Add to home screen, works offline, larger text option

**Formulary**
- 29 glaucoma and post-operative drops with generic name, class, usual dose (from the Canadian product monographs), label maximum, the ODB LU codes that can apply, AAO cap colour and formulation
- Add, edit, delete, search and sort drugs, and export or import a list to share it across a clinic
- An unedited formulary follows the latest defaults automatically

## Privacy

There is no server and no account. Patient details are kept only in the open browser tab. The browser may keep them after a reload or when it restores tabs, so press New patient before the next person. Formulary edits and prescriber details are saved in the browser on that device. The phone link and QR code contain the drug plan and start date only, never the patient's name, date of birth, healthcare number or address.

## Accessibility

- Text and controls aim for WCAG 2.1 AA: AA contrast, native radio controls, sizes in rem so the phone's text size setting applies, and support for high contrast mode
- Drugs are identified by number and name as well as colour, and eyes are written out
- Large print schedule and larger text phone view for low vision
- Keyboard focus is visible throughout, with a skip link and labelled controls

## Clinical disclaimer

This is a clinical aid. It does not replace clinical judgement. Verify every prescription and schedule before giving it to a patient. Cap colours follow the American Academy of Ophthalmology class convention and are shown as the usual colour, because pharmacies may dispense generics with different caps and switch suppliers between refills. Patients can set their own bottle's cap on the phone. LU codes refer to the Ontario Drug Benefit program.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # dosing, tapers, wording, dose times, alarms, links, validation
npm run lint
npm run build
```

The website is hosted on Vercel and deploys automatically when `main` is pushed. `vercel.json` sets the security headers (content security policy, no framing, no referrer).

### Phone app (iOS and Android)

The phone app is for patients. It is the same code wrapped with [Capacitor](https://capacitorjs.com) and always opens the patient view. It adds dose notifications and opens plan links from the QR code (`eyedroptracker://p/...`).

```bash
npm run app:android   # builds, syncs and opens Android Studio
npm run app:ios       # builds, syncs and opens Xcode (macOS only)
```

Publishing needs an Apple Developer account (US$99 a year) and a Google Play developer account (US$25 once). The app id is `com.eyedroptracker.app`. iOS allows 64 scheduled notifications per app, so reminders are scheduled about two weeks ahead and topped up each time the app opens.

### Project layout

```
src/
  App.jsx                    routing: clinician steps, patient view, phone app
  config.js                  name, authors, contact, repository
  data/formulary.js          default drug list (bump FORMULARY_VERSION when it changes)
  lib/
    dates.js                 local calendar dates
    regimen.js               drop model and doses per day
    wording.js               prescription sig and patient wording
    times.js                 suggested dose times
    checks.js                safety checks: duplicate therapy, label maximum, age, beta blockers in both eyes
    changes.js               plain-language notes when a drop starts, changes or stops
    hash.js                  plan fingerprint for check marks and calendar events
    calendar.js              how many days a schedule covers (ongoing drops never end on the phone)
    doses.js                 doses grouped by time (phone view, alarms, notifications)
    ics.js                   calendar alarm file
    share.js                 phone link encoding and decoding
    validate.js              checks on links, imported files and stored data
    native.js                phone app notifications and links
    storage.js, download.js  browser storage and file saving
  components/
    drops/                   step 1: patient, drop list, drug search, taper editor
    schedule/                step 2: month calendar, daily chart, checklist, legend, instructions
    rx/                      step 3: prescription form and sheet
    formulary/               formulary table and editor
    patient/                 phone view, reminders, install tip, app welcome
    ui.jsx, Warnings.jsx     shared small pieces and safety prompts
tests/                       automated checks
android/, ios/               phone app projects
public/                      icons, web app manifest, offline support
```

## Security

- No server, accounts, analytics or third-party scripts.
- Patient details stay in the browser tab and are cleared with New patient.
- The phone link carries the drug plan only, in the URL fragment, which browsers never send to a server.
- Links, imported formularies and stored data are validated and size-limited before use.
- The site sends a strict content security policy and refuses to be framed.

## Contributing

Issues and pull requests are welcome, especially formulary corrections, translations and accessibility feedback. Please run `npm test` before opening a pull request.

## Contact

eyedroptracker@gmail.com

## Licence

Apache License 2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

## Authors

Yusuf Ahmed and Fahad Butt
