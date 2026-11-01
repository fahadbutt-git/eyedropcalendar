# Eye Drop Tracker

A free, open-source tool that helps eye care teams turn a drop regimen into a patient calendar, a prescription and phone reminders in a few clicks.

**Live:** [eyedroptracker.com](https://eyedroptracker.com)

## Why

Adherence to glaucoma and post-operative drops is poor, and complex regimens (several drops, different eyes, tapers) are a common source of error for patients and prescribers. This tool lets the prescriber enter the regimen once and produces everything the patient needs from that single source:

- a printed calendar with tick boxes for every dose
- a prescription with a sig written out in full
- a phone view with a daily checklist and calendar alarms

## Features

**Patient and drops**
- Patient name, date of birth, healthcare number (optional) and address (optional)
- Up to 8 drops per eye, right (OD) and left (OS) entered separately
- Frequency and drops per dose fill in from the formulary and stay editable
- Course type per drop: ongoing, fixed course (for example 7 days) or taper
- Taper builder with templates (weekly QID to daily, 2-week taper, Durezol) and editable steps
- Start-day offset for drops that begin later
- Copy a drop to the other eye
- Duplicate therapy warnings (same drug twice, or two drugs from the same class in one eye)

**Schedule**
- Calendar layout with numbered, colour-coded drugs and one tick box per dose
- Weekly pages from the start date, by-month pages, or a checklist table
- Taper changes and stop days marked on the calendar
- Patient-friendly wording (no Latin abbreviations), suggested dose times, how-to instructions
- Large print mode for low vision (bigger text and boxes, 2 weeks per page)
- QR code that opens the plan on the patient's phone

**Prescription**
- Prescriber details saved on the device; clinic, address, phone and fax are optional
- One entry per drug with full sig, dispense quantity, refills and LU code
- Patient address and healthcare number are left off when blank
- Prints on a single letter page

**Phone (installable web app)**
- Opens from the QR code or link with no account or download
- Today's drops grouped by time, tap to mark each dose taken
- 7-day adherence summary
- One-tap calendar alarms (.ics) for the whole plan
- Add to home screen, works offline, larger text option

**Formulary**
- 31 glaucoma and post-operative drops with generic name, class, usual dose, LU code, cap colour and formulation
- Add, edit, delete, search and sort; export and import as JSON to share across a clinic

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
npm run build
npm run deploy     # builds and publishes to GitHub Pages
```

Project layout:

```
src/
  App.jsx                  routing between clinician and patient views
  config.js                site name, owners and contact email
  data/formulary.js        default drug list
  lib/regimen.js           dosing, tapers, sig text, dose times, safety checks
  lib/calendar.js          schedule span
  lib/ics.js               calendar alarm export
  lib/share.js             patient link encoding
  components/              pages
public/                    icons, web app manifest, service worker, CNAME
```

To change the contact email shown in the footer, edit `CONTACT_EMAIL` in `src/config.js`.

## Contributing

Issues and pull requests are welcome, especially formulary corrections, translations and accessibility feedback.

## Authors

Yusuf Ahmed and Fahad Butt
