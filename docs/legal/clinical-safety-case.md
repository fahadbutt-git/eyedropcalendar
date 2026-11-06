# Clinical safety case and intended use

Eye Drop Tracker. Version 1.0, 6 November 2026. Owner: Yusuf Ahmed and Fahad Butt.

## Intended use

Eye Drop Tracker displays and prints an eye drop regimen that a health professional has chosen, as a calendar, a phone schedule with reminders, a prescription and a chart note. It shows general prescribing cautions the professional can review. It does not choose drugs, doses or tapers, analyze images or measurements, or make decisions about care.

Intended users are licensed health professionals and staff under their supervision, and patients and caregivers following a plan their eye care team set.

## Regulatory position

Health Canada's guidance, Software as a Medical Device (SaMD): Definition and Classification, excludes clinical decision support software that meets all four of these criteria. Eye Drop Tracker is designed to meet each one.

| Criterion | Eye Drop Tracker |
| --- | --- |
| Not intended to acquire, process or analyze a medical image or a signal | It handles only text the clinician types or the chart holds |
| Intended to display, analyze or print medical information | It displays and prints the clinician's plan with general reference information, such as product cautions |
| Intended only to support decisions by a professional, patient or caregiver | Every output is checked and confirmed by the clinician. The patient is told to follow the doctor's instructions |
| Not intended to replace clinical judgement, and the user can review the basis | The note reader shows every assumption, the source text and what it left out. Cautions name their source |

Health Canada's guidance names scheduling and electronic records as examples of software that is not a medical device. It does not address medication reminder apps directly. Confirm the position with Health Canada's Medical Devices Directorate, or a regulatory adviser, before any claim that goes beyond displaying the clinician's plan, such as recommending doses.

Any future feature that chooses a drug, dose or taper, or interprets measurements such as eye pressure, would change this position and needs review before release.

## Hazard log

Severity: 1 minor, 2 moderate, 3 serious. Likelihood after controls: low, medium, high.

| Hazard | Cause | Controls | Severity | Likelihood |
| --- | --- | --- | --- | --- |
| Wrong drug, eye or frequency on the calendar | Note misread by the reader | Each assumption flagged. Outputs locked until each drop confirmed. 54 unit tests on the reader | 3 | Low |
| Taper step dates wrong | Date calculation error | Unit tests on schedules. Calendar shows each step date | 3 | Low |
| Patient follows an old plan | Old calendar or link kept | New plan link keeps the patient code and replaces the old plan on the phone. Chart note holds the current link | 2 | Medium |
| Missed dose | Reminder not delivered | Terms state reminders may fail. Printed calendar and daily chart as backup | 2 | Medium |
| Plan for one patient opened by another on a shared phone | Different patient code | Separate history per patient code. Check marks never carry over | 2 | Low |
| Plan written to the wrong chart | Oscar tab changed patient | Patient match and clinician checks at write. Note unsigned until the clinician signs | 3 | Low |
| Outdated drug list or caution | Monograph change | Terms tell clinicians to confirm. Source named for each default | 2 | Medium |
| Mispronounced drug name in read aloud | Phone voice | Text shown on screen with the voice | 1 | Medium |
| Lost calendar or QR code | Patient loses paper | Keep a copy card on the phone. Link in chart for reprinting | 1 | Medium |

## Release checks

Before each release: unit tests, the end-to-end extension test and the 18-check security suite pass. Any change to the note reader, schedules or prescriptions is checked against a sample of real-format notes from made-up patients. Releases are listed with version and date.

## Reporting

Errors that reach or could reach a patient go through the incident and breach response plan, and are added to this log with the fix.
