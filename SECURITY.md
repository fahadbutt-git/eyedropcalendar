# Security policy

Eye Drop Tracker handles clinical information, so security reports are taken seriously and answered quickly.

## Reporting a vulnerability

Email eyedroptracker@gmail.com with "Security" in the subject. Please do not open a public issue for a vulnerability.

Include what you found, how to reproduce it, and what it could expose. Use made-up patient details only. We aim to reply within 3 business days and to fix confirmed issues before they are disclosed.

## Scope

- The website at eyedroptracker.com and the code in `src/`
- The Eye Drop Tracker for Oscar extension in `oscar/extension/`
- The iOS and Android apps in `ios/` and `android/`

## How the project protects data

- There is no server. Patient details stay in the browser tab, and the phone link carries the drop plan only.
- The site sends a strict content security policy and refuses to be framed (`vercel.json`).
- The extension holds no standing access to any website, accepts messages only from its own scripts, and writes chart notes itself from a validated plan.
- Every release runs a browser security suite (`oscar/tests/security.mjs`) that tries to leak, forge and misuse data.

The public [security page](https://eyedroptracker.com/security.html) describes these measures for clinics.
