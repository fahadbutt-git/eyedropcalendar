# Privacy impact assessment and threat risk assessment

Eye Drop Tracker and Eye Drop Tracker for Oscar. Template for clinics, completed by the makers. Version 1.1, 6 November 2026, for extension 0.3.0.

The clinic, as health information custodian, adopts or adapts this assessment and signs it in section 9. It follows the structure of the Information and Privacy Commissioner of Ontario's Planning for Success: Privacy Impact Assessment Guide. Sections marked "Clinic to complete" need the clinic's own answers.

## 1. Project description

| Item | Detail |
| --- | --- |
| Purpose | Turn a clinician's eye drop plan into a printed calendar, a prescription, phone reminders for the patient and a chart note, to improve adherence |
| Users | Clinicians and staff working under them. Patients and their caregivers on their own phones |
| Components | Website (eyedroptracker.com), phone app (iOS, Android), Chrome extension for Oscar |
| Server-side storage | None. No accounts, no database, no analytics |
| Clinic using it | Clinic to complete |
| Clinic privacy contact | Clinic to complete |
| Go-live date | Clinic to complete |

## 2. Authority

- The clinic is the custodian under PHIPA (or the equivalent law of its province) for all patient information entered, printed, charted or given to the patient.
- Use of patient information to prepare the patient's own drop plan is a use for providing health care. Within the circle of care the clinic may rely on assumed implied consent under PHIPA section 20(2), unless the patient has said otherwise.
- The makers supply electronic goods under PHIPA section 10(4). The software is designed so that patient information is not sent to them, so no disclosure to them occurs (O. Reg. 329/04, section 6(4)). They are not a health information network provider.
- Clinic to confirm whether its policies need express consent before the plan link is sent to a patient by email or text.

## 3. Data inventory

| Data element | Source | Where held | Retention | Identifiability |
| --- | --- | --- | --- | --- |
| Patient name, date of birth | Typed, or read from Oscar | Browser tab session storage | Cleared on New patient, tab close, or 30 minutes idle | Direct |
| Health card number, address | Typed, for the prescription | Browser tab session storage | As above | Direct |
| Drops, eyes, frequency, taper, dates | Typed or read from chart | Browser tab, plan link | Tab as above. Link as long as kept | Indirect only in the link |
| Random patient code | Generated | Plan link, patient phone | As long as kept | Not identifying alone |
| Chart notes, medication list (read only) | Clinic's Oscar | Extension panel in the Oscar tab | Not stored. Gone when the panel closes | Direct |
| Hand-off of drops, name, date of birth | Extension | Chrome session storage | Deleted on hand-off. Tab and patient number until tab close or 2 hours | Direct |
| Chart note written back | Extension | Clinic's Oscar | Clinic's retention rules | Direct |
| Doses ticked, reminder setting | Patient | Patient's phone | Until the patient removes them | Not linked to identity off the phone |
| Prescriber name, licence number, clinic address | Typed | Browser local storage | Until cleared | Clinician identity |

## 4. Data flows

1. The clinician opens a patient's encounter in Oscar and opens the extension. The extension reads that patient's notes and medication list through Oscar's own interface with the clinician's login.
2. The clinician selects the drops and opens Eye Drop Tracker. Drops, name and date of birth pass inside the same browser to the Eye Drop Tracker tab.
3. The clinician confirms every drop. The calendar, prescription and plan link are made in the browser.
4. The clinician prints, hands the calendar to the patient, and the patient scans the QR code. The plan opens on the patient's phone from the link. No server receives it.
5. The clinician clicks Add to Oscar chart. The extension writes an unsigned note to the same patient and the clinician signs it in Oscar.

No step sends patient information outside the clinic computer, the clinic's Oscar or the patient's phone.

## 5. Privacy analysis against the ten fair information principles

| Principle | How it is met |
| --- | --- |
| Accountability | Clinic is custodian. Makers name a privacy officer and publish clinic terms and a security page |
| Identifying purposes | Single purpose, stated in the terms and Chrome Web Store listing |
| Consent | Clinic's existing authority for care. Clinic decides on express consent for electronic sending |
| Limiting collection | Only fields needed for the calendar and prescription. Health card and address only for the prescription |
| Limiting use, disclosure, retention | No disclosure to makers. Automatic clearing after 30 minutes idle. Hand-off deleted on use |
| Accuracy | Each drop read from a chart shows what was assumed. Outputs locked until the clinician confirms |
| Safeguards | See section 6 |
| Openness | Privacy notice, clinic terms, security page and source code are public |
| Individual access | Patients ask the clinic. Makers hold no patient records |
| Challenging compliance | Privacy officer contact. Complaints to the clinic, the provincial commissioner or the federal commissioner |

## 6. Threat risk assessment

Likelihood and impact are rated low, medium or high after the listed controls.

| Threat | Controls | Residual likelihood | Residual impact |
| --- | --- | --- | --- |
| Patient data sent to an outside server | No server. Content security policy allows connections to the site only. Extension talks only to Oscar and the site. Tested on every release | Low | High |
| Malicious web page reads or forges hand-off | Extension accepts messages only from its own scripts, never from web pages. Writes need a real click. Free text refused | Low | High |
| Note written to the wrong patient | Patient match checked at write. Refused if the Oscar tab changed patient, or the name was edited | Low | High |
| Note written under the wrong clinician | Signed-in clinician re-checked at write | Low | Medium |
| Markup in a chart runs in the panel | All chart text displayed as text | Low | High |
| Shared computer shows previous patient | 30 minute idle clear, New patient button, clinic practice | Low | Medium |
| Lost printed calendar | Calendar carries name and date of birth. Plan link carries none | Medium | Low |
| Plan link shared beyond the patient | Link holds drops and dates only | Medium | Low |
| Lock screen shows drug names | Option to hide drug names | Medium | Low |
| Tampered extension or site code | Extension installed from the official store. Site served over HTTPS with HSTS. Public source | Low | High |
| Clinic computer compromised | Out of scope for the software. Clinic device controls apply | Clinic to complete | Clinic to complete |
| Incorrect plan reaches patient | Review gate, clinician signs the chart note, patient reminded to follow the doctor's instructions | Low | Medium |

## 7. Recommendations for the clinic

- Use clinic-managed computers with disk encryption and current Chrome updates.
- Require multi-factor authentication for Oscar where available.
- Install the extension only from the official listing or through IT policy.
- Add the use of Eye Drop Tracker to the clinic's statement of information practices.
- Train staff to press New patient after each patient and to shred unused printouts.

## 8. Open items

| Item | Owner | Due |
| --- | --- | --- |
| Clinic consent policy for sending the link electronically | Clinic | Clinic to complete |
| Independent penetration test of the extension and site | Makers | Before hospital use |
| French versions of public documents. Not offered in Quebec until then | Makers | Before use in Quebec |
| Clinic joins the makers' clinic contact list for security notices | Clinic | At go-live |

## 9. Sign-off

| Role | Name | Signature | Date |
| --- | --- | --- | --- |
| Clinic privacy officer | | | |
| Clinic lead physician | | | |
| Eye Drop Tracker privacy officer | Fahad Butt | | |
