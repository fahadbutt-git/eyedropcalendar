# Clinical safety case and intended use

Eye Drop Tracker. Version 1.2, 6 November 2026. Owners: Yusuf Ahmed and Fahad Butt. Clinical safety lead: to be named, who signs off each release.

## Intended use

Eye Drop Tracker displays and prints an eye drop regimen that a health professional has chosen, as a calendar, a phone schedule with reminders, a prescription and a chart note. It shows general prescribing cautions the professional can review. It does not analyze images or measurements or make decisions about care.

When it reads a chart note that leaves something out, it may fill in a usual value: the drug's usual frequency, both eyes, or a weekly taper when the note says "taper" without steps. Each such value is flagged in words, and the clinician ticks each drop as checked against the sentence it came from before anything is printed. Taper presets, including one named for Durezol, are templates the clinician picks. They are never applied without a choice.

Intended users are licensed health professionals and staff under their supervision, and patients and caregivers following a plan their eye care team set.

Out of scope: drops used hourly or more often, intravitreal or systemic drugs, and plans with more than 8 doses a day. The reader leaves hourly drops off the calendar and tells the clinician to write them by hand.

## Regulatory position

Health Canada's guidance, Software as a Medical Device (SaMD): Definition and Classification, excludes clinical decision support software that meets all four of these criteria. We believe Eye Drop Tracker meets each one, for the reasons below. This needs confirmation by a regulatory adviser.

| Criterion | Eye Drop Tracker |
| --- | --- |
| Not intended to acquire, process or analyze a medical image or a signal | It handles only text the clinician types or the chart holds |
| Intended to display, analyze or print medical information | It displays and prints the clinician's plan with general reference information, such as product cautions |
| Intended only to support decisions by a professional, patient or caregiver | Every output is checked and confirmed by the clinician. Filled-in values are flagged and editable. The patient is told to follow the doctor's instructions |
| Not intended to replace clinical judgement, and the user can review the basis | The reader shows each assumption, the source sentence and what it left out. Cautions name their source. Limited Use codes are picked by the clinician, never filled in |

The filled-in defaults are the weakest point. If a regulator saw them as the software choosing a dose, the fix is to leave those fields blank until the clinician enters them.

Health Canada's guidance names scheduling and electronic records as examples of software that is not a medical device. It does not address medication reminder apps directly. Any future feature that recommends a drug, dose or taper, or interprets measurements such as eye pressure, needs review before release.

## Risk method

Severity: 1 minor (inconvenience), 2 moderate (temporary harm, such as a missed day of drops), 3 serious (harm needing treatment, such as a steroid in the wrong eye), 4 catastrophic (permanent vision loss).

Likelihood after controls: low, medium, high.

Acceptance: a hazard rated 4 at any likelihood, or 3 at medium or high, must have a further control or a written decision by the clinical safety lead before release. Everything else is acceptable once its controls are in place and tested.

Benefit: missed and mistimed drops are a common cause of glaucoma progression and poor outcomes after surgery. A clear printed calendar and reminders are expected to reduce that harm. Residual risks are judged against this benefit.

## Hazard log

Status shows whether the control is in place and how it is tested.

| ID | Hazard | Cause | Controls | Severity | Likelihood | Status |
| --- | --- | --- | --- | --- | --- | --- |
| H1 | Wrong eye with no flag | Ordinary words read as eye abbreviations ("to be", "re-check", "right away") | Abbreviations count only in capitals. Phrases such as "right away" ignored. More than one eye flagged | 3 | Low | Fixed 6 Nov 2026. Tests in noteParser.test.mjs |
| H2 | "OD" read as right eye when once daily was meant | ISMP Canada error-prone abbreviation | Flag when "OD" appears with no frequency | 3 | Low | Fixed 6 Nov 2026. Tested |
| H3 | Software fills in eye, frequency or taper | Note leaves it out | Each default flagged in words. Each drop ticked on its own against its source sentence before printing | 3 | Low | Fixed 6 Nov 2026. Tested in the extension end-to-end run |
| H4 | Active drop left out | Past or allergy words elsewhere in the sentence | Past use judged on the four words next to the drug. "Start" and "continue" keep the drop. Skipped drops listed | 3 | Low | Fixed 6 Nov 2026. Tested |
| H5 | Hourly regimen cut down | Calendar holds at most 8 doses a day | Hourly drops left off and listed, with advice to write by hand | 3 | Low | Fixed 6 Nov 2026. Tested |
| H6 | Wrong strength, such as atropine 0.01% against 1% | Note strength differs from the drug list, or first strength picked | Mismatch flagged as a strength problem, and the tick reads "including the strength". The drug list holds only atropine 1%, so a 0.01% order must be added by the clinic | 4 | Low | Fixed 6 Nov 2026. Tested |
| H7 | Wrong drug, frequency or duration on the calendar | Note misread | Each assumption flagged. Outputs locked until the clinician confirms. 17 reader tests and 36 schedule tests | 3 | Low | In place |
| H8 | Taper step dates wrong | Date calculation error | Schedule tests. Calendar shows each step date | 3 | Low | In place |
| H9 | Plan written to the wrong chart | Oscar tab changed patient | Patient and clinician checks at write. Note unsigned until the clinician signs. Extension security suite | 3 | Low | In place. Tested |
| H10 | Old reminders continue after a plan change | Calendar file events stay on the phone | Phone app replaces all reminders. A new calendar file cancels alarms the plan no longer has, and the screen warns that the plan changed and how to remove old alarms. Repeating alarms stop after six months | 3 | Low | Fixed 6 Nov 2026. Tested. Some calendars ignore cancellations |
| H11 | Same agent counted twice | Combination plus single agent, or brand plus generic | Class duplicate warning | 2 | Medium | In place. Required acknowledgement is an open item |
| H12 | Drops instilled too close together | Same dose times for several drops | Five-minute spacing shown on the daily chart | 1 | High | In place |
| H13 | Steroid pressure rise not caught | No pressure check booked | Warning on any steroid course over 14 days to book a check within 2 to 4 weeks | 3 | Low | Fixed 6 Nov 2026. Tested |
| H14 | Drops stopped early | Patient feels better | "Do not stop or change drops" wording on the patient pages and terms | 2 | Medium | In place |
| H15 | Missed dose | Reminder not delivered | Terms state reminders may fail. Printed calendar and daily chart as backup | 2 | Medium | In place |
| H16 | Reminder at the wrong time | Daylight saving change or travel | Times follow the phone's clock. Daylight saving tests are an open item | 1 | Low | Open |
| H17 | Bottle runs out mid-course | Quantity not checked against course length | Quantity on the prescription. Bottle-days estimate is an open item | 2 | Medium | Open |
| H18 | Outdated drug list or caution | Monograph change | Terms tell clinicians to confirm. Source named for each default. Named reviewer for each formulary update is an open item | 2 | Medium | In place |
| H19 | Patient or caregiver cannot follow the plan | Low vision, cognitive impairment, language | Large print, cap colours in words, read aloud, screen reader support | 2 | Medium | In place. User testing with these groups is an open item |
| H20 | Printed prescription refused or forged | Signature drawn on screen | Terms ask for a handwritten signature on printed copies | 2 | Medium | In place |
| H21 | Unsigned chart note never signed | Clinician forgets | Note is saved unsigned, so Oscar shows it as unsigned. Audit during the pilot | 2 | Medium | Open |
| H22 | Lost calendar or QR code | Patient loses paper | Keep a copy card on the phone. Link in the chart for reprinting | 1 | Medium | In place |
| H23 | Plan for one patient opened by another on a shared phone | Different patient code | Separate history per patient code. Check marks never carry over | 2 | Low | In place |
| H24 | Wrong bottle used because the cap colour differs | Pharmacy dispenses the lowest cost generic, whose cap may not follow the AAO colour, and may switch supplier between refills | Drug name always shown first. Cap colour shown as "usually". Printed space to write the bottle's own cap. Patient sets their own bottle's cap on the phone and changes it at a refill. Clinician can print without cap colours | 2 | Low | Fixed 8 Nov 2026 after ophthalmologist review. Tested |
| H25 | Clinician's unsaved note lost | A separate unsigned note saved while today's note is still a draft makes Oscar replace the draft the next time the encounter opens | The plan is added into the open note instead, and a separate note is saved only when no note is open. End-to-end and security tests check that nothing is saved behind an open note | 3 | Low | Fixed 8 Nov 2026 after a test on Open-O 25. Tested |

## Evidence a hospital will ask for

| Evidence | Status |
| --- | --- |
| Hazard, control and test trace (the table above) | In place |
| Reader accuracy on 300 or more made-up notes in real formats, with wrong-eye errors reported on their own | Open |
| Usability testing with clinicians, older patients, low-vision users and caregivers | Three rounds done. Formal summative test open |
| Security suite and end-to-end extension test results | In place for each release |
| Independent penetration test | Open |
| Formulary version history with a named reviewer | Open |
| Post-release error log and yearly review | Starts with the pilot |

## Release checks

Before each release: all unit tests, the end-to-end extension test and the 18-check security suite pass. Any change to the reader, schedules or prescriptions is also run against the made-up note set. The clinical safety lead signs off releases that change any of these.

## Reporting

Errors that reach or could reach a patient go through the incident and breach response plan, are added to this log with the fix, and are reported voluntarily to ISMP Canada.
