# Changelog

Notable changes, newest first. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/). The website deploys from `main` continuously. The Oscar extension and the phone app are versioned and tagged (`extension-v0.6.4`, `v2.1.0`).

## Unreleased

### Changed

- The app shell is split into `src/app` (root, clinician and patient sides, layout) and `src/hooks`, with clinician state, the formulary and the prescriber in their own modules.
- Dates are formatted with `Intl.DateTimeFormat`, and ids and patient codes come from `crypto`.
- The Oscar browser suites share one harness and run with `npm run test:oscar`.
- Prettier formats the code, and CI runs lint, formatting, unit tests and the browser suites.

### Added

- A prescriber can choose to keep a drawn signature in the browser and place it on later prescriptions with one click.

## Extension 0.6.4, 16 November 2026

### Added

- The patient's health card number and address, and the signed-in clinician's name, CPSO number, phone and practice address, are filled in from Oscar. The prescriber is still confirmed before printing.

## Extension 0.6.3, 10 November 2026

### Fixed

- A customised Eye Form's box titles are read only from inside each box, so boxes such as Office Communication are never read as today's plan.

## Extension 0.6.2, 10 November 2026

### Added

- Oscar's ophthalmology Eye Form: today's Plan, Impression and Current Hx are read, the Eye Meds list is offered, and the plan goes back into the Plan box.

## Extension 0.6.1, 9 November 2026

### Fixed

- The setup page confirms reliably after Allow, and the keyboard shortcut is documented correctly.

## Extension 0.6.0, 9 November 2026

### Fixed

- The panel no longer mistakes its own write for the clinician changing the note.

## Extension 0.5.0 to 0.5.9, 6 to 9 November 2026

### Added

- An optional Eye drops button on encounters, limited to the clinic's own Oscar address fixed in the build.
- The plan is added to today's open note, so Oscar never drops a draft.
- The panel offers to re-read a changed note and explains empty charts and refused encounters.
- Misspelled and shortened drug names are recognised cautiously, tested on 450 independently written notes.

### Fixed

- The plan link is written in short lines, so Oscar's encounter page keeps its width.
- Fixes from the Open-O 25 rehearsal and launch day.

## Extension 0.1.0 to 0.4.0, 5 to 6 November 2026

### Added

- Read eye drops from the Oscar chart, open them in Eye Drop Tracker for checking, and add the plan back as a chart note.
- Works in Oscar's pop-up encounters and reads the note being written.
- Security and privacy hardening, and safety fixes from the clinical review.

## Website and phone app 2.1.0, 31 October 2026

### Added

- Clinical chart redesign and a choice of printed layouts.

## Website and phone app 2.0.0, 31 October 2026

### Added

- A simpler clinician flow, the iOS and Android phone app, and the automated test suite.
