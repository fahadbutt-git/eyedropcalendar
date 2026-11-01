# Eye Drop Tracker

A free, open-source tool that helps eye care teams turn a drop regimen into a patient calendar, a prescription and phone reminders in a few clicks.

**Live:** [eyedroptracker.com](https://eyedroptracker.com)

## Why

Adherence to glaucoma and post-operative drops is poor, and complex regimens (several drops, different eyes, tapers) are a common source of error for patients and prescribers. This tool lets the prescriber enter the regimen once and produces everything the patient needs from that single source:

- a printed calendar with tick boxes for every dose
- a prescription with a sig written out in full
- a phone view with a daily checklist and calendar alarms

## How it works

1. **Patient and drops.** Enter the patient, then add each drop and choose the eye: right, left or both. How often and how many drops fill in from the formulary and can be changed. Each drop is ongoing, runs for a set number of days, or tapers.
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
- Numbered drugs, cap colours and one tick box per dose
- Taper changes (for example ↓3x) and stop days marked on the day they happen
- Plain wording for patients, suggested dose times and how-to instructions
- Large print for low vision: bigger text and boxes, 2 weeks per page
- Checklist layout as an alternative

**Prescription**
- Prescriber details saved on the device; clinic, address, phone and fax optional
- Full sig, dispense, refills and LU code per drug; the patient's address and healthcare number appear only when entered
- Leave off any drug the patient already has

**Phone**
- Opens from the QR code with no account
- Today's drops grouped by time, tap each one when done, with progress for the day
- Reminders: real notifications in the iOS and Android app, or calendar alarms from the browser
- Add to home screen, works offline, larger text option

**Formulary**
- 31 glaucoma and post-operative drops with generic name, class, usual dose, LU code, cap colour and formulation
- Add, edit, delete, search and sort; export and import to share a list across a clinic
- An unedited formulary follows the latest defaults automatically

## Privacy

There is no server and no account. Patient details are kept only in the open browser tab and are cleared when it is closed. Formulary edits and prescriber details are saved in the browser on that device. The phone link and QR code contain the drug plan and start date only, never the patient's name, date of birth, healthcare number or address.

## Accessibility

- Text and controls meet WCAG AA contrast
- Drugs are identified by number and name as well as colour, and eyes are written out
- Large print schedule and larger text phone view for low vision
- Keyboard focus is visible throughout, with a skip link and labelled controls

## Clinical disclaimer

This is a clinical aid. It does not replace clinical judgement. Verify every prescription and schedule before giving it to a patient. Cap colours follow the American Academy of Ophthalmology class convention and should be checked against the dispensed product. LU codes refer to the Ontario Drug Benefit program.

## Development

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # dosing, tapers, sig text, dose times, alarms, phone link
npm run build
npm run deploy     # publishes the website to GitHub Pages (eyedroptracker.com)
```

### Phone app (iOS and Android)

The phone app is the same code wrapped with [Capacitor](https://capacitorjs.com). It adds dose notifications that work without the calendar, and opens plan links from the QR code (`eyedroptracker://p/...`).

```bash
npm run app:android   # builds, syncs and opens Android Studio
npm run app:ios       # builds, syncs and opens Xcode (macOS only)
```

Publishing needs an Apple Developer account (US$99 a year) and a Google Play developer account (US$25 once). The app id is `com.eyedroptracker.app`. iOS allows 64 scheduled notifications per app, so reminders are scheduled about two weeks ahead and topped up each time the app opens.

### Project layout

```
src/
  App.jsx                  clinician steps, patient view and routing
  config.js                site name, authors and contact email
  data/formulary.js        default drug list (bump FORMULARY_VERSION when it changes)
  lib/regimen.js           dosing, tapers, sig text, dose times, duplicate checks
  lib/calendar.js          schedule length
  lib/ics.js               calendar alarm file
  lib/share.js             phone link encoding
  lib/native.js            phone app notifications and links
  components/              pages
tests/                     automated checks of the clinical logic
android/, ios/             phone app projects
public/                    icons, web app manifest, offline support, CNAME
```

## Contributing

Issues and pull requests are welcome, especially formulary corrections, translations and accessibility feedback. Please run `npm test` before opening a pull request.

## Contact

eyedroptracker@gmail.com

## Authors

Yusuf Ahmed and Fahad Butt
