# Contributing

Thank you for helping. Formulary corrections, accessibility feedback and bug reports are especially welcome.

## Ground rules

- Use made-up patients only. Never develop or test against a live chart, and never paste real patient details into an issue.
- Patient data never leaves the browser. A change that sends patient details to a server, an analytics service or a third-party script will not be accepted.
- The calendar, prescription, phone view, alarms and chart note must always agree. Change the shared logic in `src/lib/` rather than one output.

## Workflow

1. Branch from `main` with a short descriptive name, such as `fix/taper-end-date` or `feat/rx-fax`.
2. Make the change with a test that fails without it. Pure logic goes in `src/lib/` with a unit test in `tests/`. Extension behaviour gets a check in `oscar/tests/`.
3. Run `npm run check` (lint, formatting, unit tests and browser suites).
4. Open a pull request into `main`. CI runs the same checks. Merging to `main` deploys the website.

## Code conventions

- `src/lib/` is plain JavaScript with no React, so it runs in Node tests and in the extension.
- `src/hooks/` holds React hooks, `src/components/` the pages and their parts, `src/app/` the shells around them.
- Prefer what the browser already provides (`Intl`, `crypto`, `URL`, `structuredClone`) over hand-written helpers or new dependencies.
- Anything read from a link, a file, storage or the extension is checked in `src/lib/validate.js` or `src/app/clinician/state.js` before use.
- Comments explain why, in plain sentences. User-facing text is plain language, eyes are written out in full, and OD, OS and OU are internal keys only.
- Prettier formats the code (`npm run format`) and ESLint checks it (`npm run lint`).

## Commits

Write the subject in the imperative and under 72 characters ("Fill the prescriber from the Oscar login"). Use the body to say what changed and why.

## Releases

- Website: merge to `main`.
- Oscar extension: raise `extensionVersion` in `package.json`, then build with `npm run ext:build -- --oscar=<clinic origin>`. See [docs/OSCAR.md](docs/OSCAR.md).
- Phone app: see [docs/RELEASE.md](docs/RELEASE.md).
