# Releasing the phone app

The website, the iPhone app and the Android app run the same React code. Capacitor wraps the built website in a native shell on each phone and adds dose notifications and plan links. A change is made once in `src/` and reaches all three.

## How the project is laid out

| Path | What it holds |
| --- | --- |
| `src/` | The app itself, shared by web, iPhone and Android |
| `src/lib/native.js` | The only file that talks to the phone (notifications, plan links). Every function does nothing in a browser |
| `public/icon.svg` | The logo. Every icon and splash image is drawn from it |
| `android/`, `ios/` | Native shells. Edit only for permissions, signing and store settings |
| `scripts/` | Version, icon and store screenshot tools |
| `store/` | Store screenshots and graphics |
| `capacitor.config.json` | App ID, notification icon, safe-area handling |

## Shipping an update

1. Make and test the change on the website as usual (`npm test`, `npm run lint`).
2. Raise `version` in `package.json` (for example 2.1.0 to 2.1.1). Every upload to either store needs a higher number.
3. Run `npm run app:sync`. This copies the version into both native projects, builds the site and copies it into both apps.
4. iPhone: `npm run app:ios` opens Xcode. Choose Product, then Archive, then Distribute App to send it to App Store Connect.
5. Android: `npm run app:android` opens Android Studio. Choose Build, then Generate Signed App Bundle, and upload the `.aab` file to Google Play Console.
6. Website: push to `main` and Vercel deploys it.

If the logo changes, edit `public/icon.svg` and run `npm run app:icons`. For new store screenshots, run `npm run build && npm run preview`, then `npm run app:screens` in a second terminal. Both need Chromium once: `npx playwright install chromium`.

## First release only

### Accounts

- Apple Developer Program, US$99 a year. Apple asks that healthcare apps be submitted by an organization rather than an individual (App Review Guideline 5.1.1(ix)). An organization account needs a D-U-N-S number, which is free but can take one to two weeks.
- Google Play Console, US$25 once. A new personal account must run a closed test with at least 12 testers for 14 days before it can publish. An organization account skips this.

### Signing

- iPhone: in Xcode, open the App target, Signing and Capabilities, and choose the team. Xcode manages the certificates.
- Android: Android Studio creates an upload key the first time you generate a signed bundle. Keep the key file and its password somewhere safe and out of the repository. Turn on Play App Signing when asked, so Google holds the final signing key.

### Store listing

**Name:** Eye Drop Tracker

**Subtitle (Apple, 30 characters):** Reminders for your eye drops

**Short description (Google, 80 characters):** Dose reminders and a daily checklist for the eye drop plan your clinic gives you.

**Description:**

Eye Drop Tracker helps you follow the eye drop plan your eye clinic gives you.

Scan the QR code on the calendar from your clinic and the app shows which drop is due, in which eye, and in what order. Tick each dose off as you put it in. The app reminds you at every dose time and keeps track of tapers, so you always know when a drop changes or stops.

- Today's drops, in order, with a reminder to wait 5 minutes between drops
- Tapers and courses that change on the right day
- Cap colours to help you find the right bottle. If the pharmacy gives you a generic with a different cap, you can change the colour to match
- Larger text that follows your phone's text size, and Read it to me for the next dose
- Reminders can hide drug names on your lock screen

No account, no ads and no tracking. Your plan and your check marks stay on your phone. The app does not give medical advice. Always check with your eye doctor, and follow their instructions if they differ from the plan.

Eye Drop Tracker is not a medical device and does not diagnose, treat, cure, or prevent any medical condition.

**Category:** Medical. **Keywords (Apple):** eye drops,glaucoma,reminder,taper,cataract,medication,ophthalmology,dose

**Privacy policy URL:** https://eyedroptracker.com/privacy.html. **Terms (license agreement):** https://eyedroptracker.com/terms.html. **Support URL:** https://eyedroptracker.com

### Privacy answers

- Apple App Privacy: Data Not Collected. No tracking.
- Google Data safety: no data collected, no data shared. Data is not encrypted in transit because none is sent.
- Google Health apps declaration: medication reminder and adherence. Not a medical device.
- Google content rating questionnaire: no user content, no ads. Expect Everyone.
- Apple age rating: none of the content categories apply. Answer Yes to medical or treatment information.
- Apple export compliance is already answered in `Info.plist` (no non-exempt encryption).

### Notes for App Review

The app needs a plan from an eye clinic. Give reviewers this sample plan link and ask them to paste it on the first screen:

```
https://eyedroptracker.com/#/p/eyJ2IjoyLCJuIjoicmV2aWV3MDEiLCJzIjoiMjAyNi0xMS0wMSIsInciOiIwODowMCIsImIiOiIyMjowMCIsImUiOltbIlhhbGF0YW4iLCJMYXRhbm9wcm9zdCAwLjAwNSUiLCJ0ZWFsIiwic29sdXRpb24iLDEsIk9VIiwxLCJvIiwxLDcsMSwwXSxbIlRpbW9wdGljIiwiVGltb2xvbCAwLjUlIiwieWVsbG93Iiwic29sdXRpb24iLDAsIk9VIiwxLCJvIiwyLDcsMSwwXV0sImMiOiJpa3Nud2IxZTdiZzNsIn0
```

Suggested note: "Eye Drop Tracker shows a medication plan set by the patient's eye doctor and reminds the patient at each dose time. It does not calculate doses. Plans are created by eye care teams at eyedroptracker.com and reach the app by QR code. No data leaves the device."

### Screenshots

`store/ios` (1320 x 2868, iPhone 6.9 inch) and `store/android` (1080 x 2160, plus the 1024 x 500 feature graphic and 512 x 512 icon). The app is iPhone only, so no iPad screenshots are needed.

### Before submitting

- Install a test build on a real iPhone (TestFlight) and a real Android phone.
- Scan a printed QR, tap Open in the app, turn on reminders and confirm one arrives on time with the phone locked.
- On Android 14 and later, check the "Allow exact times" prompt appears and works.
