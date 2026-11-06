# Incident and breach response plan

Eye Drop Tracker. Version 1.0, 6 November 2026. Owner: privacy officer (Fahad Butt). Deputy: Yusuf Ahmed.

## Scope

This plan covers any event that could let someone access, use, change or disclose personal information without authority through Eye Drop Tracker, or that causes a wrong plan to reach a patient. Examples: a security flaw in the extension or site, a tampered release, a mis-written chart note, an error in the drug list, or email to us that contains patient information.

## Legal duties

| Law | Who it binds | Duty |
| --- | --- | --- |
| PHIPA s. 12(2) and (3), O. Reg. 329/04 s. 6.3 | The clinic, as custodian | Notify the patient at the first reasonable opportunity of theft, loss or unauthorized use or disclosure, and the Information and Privacy Commissioner of Ontario in the prescribed cases |
| O. Reg. 329/04 s. 6(3) | Health information network providers. Adopted by us voluntarily | Notify every affected custodian at the first reasonable opportunity of unauthorized access, use or disclosure |
| PIPEDA s. 10.1 and the Breach of Security Safeguards Regulations (SOR/2018-64) | Us, for personal information we hold in commercial activity | Report breaches with a real risk of significant harm to the Privacy Commissioner of Canada and notify affected people as soon as feasible. Keep a record of every breach for 24 months |
| Quebec private sector Act, as amended by Law 25 | Us and clinics, for Quebec residents | Notify the Commission d'accès à l'information and affected people of incidents with a risk of serious injury. Keep a register of confidentiality incidents |
| Other provinces' health privacy laws | Clinics there | Their own notification rules |

Because we do not hold patient information, most incidents will be a clinic's to report. Our job is to find, contain and fix the cause fast, and give clinics the facts they need.

## Steps

1. **Report received.** Anyone, including a clinic, patient or researcher, reports by email with "Security" or "Privacy" in the subject. Acknowledge within one business day.
2. **Assess (same day).** Privacy officer and deputy decide: could patient information have been exposed, or a wrong plan reached a patient? Record the decision and reasons.
3. **Contain (within one business day).** As needed: take the site down or roll back the release on Vercel, unpublish or roll back the extension in the Chrome Web Store, pull the app version, delete any patient information emailed to us.
4. **Notify clinics.** At the first reasonable opportunity, tell every clinic that may be affected: what happened, when, what information, what we have done, what they should do. Clinics decide on notifying patients and their commissioner.
5. **Report to regulators where we are bound.** If personal information we hold creates a real risk of significant harm, report to the Office of the Privacy Commissioner of Canada with the content set out in section 2(1) of the Breach of Security Safeguards Regulations, and notify affected people with the content in section 3. For Quebec residents, report to the Commission d'accès à l'information where there is a risk of serious injury.
6. **Fix.** Release a fix, add a test that would have caught the problem, and rerun the full test and security suites.
7. **Record.** Enter the incident in the register below within one week. Keep each entry for at least 24 months.
8. **Review.** Within 30 days, review what happened and update this plan, the security page or the software.

## Assessing harm

A real risk of significant harm depends on how sensitive the information is and how likely it is to be misused. Health information is sensitive by nature. Consider: was it encrypted or identifying, who could have seen it, for how long, and whether it has been recovered.

## Clinical errors

A wrong plan that reached, or could have reached, a patient is handled in the same steps. Also: tell affected clinics so they can contact patients, correct the drug list or reader, and add the case to the hazard log in the clinical safety case.

## Contacts

| Role | Name | Contact |
| --- | --- | --- |
| Privacy officer | Fahad Butt | eyedroptracker@gmail.com |
| Deputy | Yusuf Ahmed | eyedroptracker@gmail.com |
| Office of the Privacy Commissioner of Canada | | priv.gc.ca |
| Information and Privacy Commissioner of Ontario | | ipc.on.ca |
| Commission d'accès à l'information du Québec | | cai.gouv.qc.ca |

## Incident register

| Date found | What happened | Information involved | Clinics told (date) | Regulator told (date) | Fix and release | Closed |
| --- | --- | --- | --- | --- | --- | --- |
| | | | | | | |
