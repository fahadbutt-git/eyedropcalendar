// Store screenshots of the phone app, made from a sample post-op plan.
// Start the site first (npm run build && npm run preview), then run
// `npm run app:screens`. Images go to store/ios and store/android.
import { chromium } from "playwright";
import { encodeRegimen } from "../src/lib/share.js";
import { SEED_FORMULARY } from "../src/data/formulary.js";

const SITE = "http://localhost:4173";
const OUT = new URL("../store/", import.meta.url).pathname;
const entries = [
  { brand: "Pred Forte", eye: "OD", drops: 1, mode: "taper", freq: 4, durationDays: 7, startDay: 1, steps: [{ freq: 4, days: 7 }, { freq: 3, days: 7 }, { freq: 2, days: 7 }, { freq: 1, days: 7 }] },
  { brand: "Vigamox", eye: "OD", drops: 1, mode: "duration", freq: 3, durationDays: 7, startDay: 1, steps: [] },
  { brand: "Xalatan", eye: "OU", drops: 1, mode: "ongoing", freq: 1, durationDays: 7, startDay: 1, steps: [] },
];
const code = encodeRegimen({ entries, formulary: SEED_FORMULARY, start: "2026-11-02", wake: "08:00", bed: "22:00", nonce: "store001" });
const b = await chromium.launch();
// At 3x these give the sizes each store asks for: 1320 x 2868 (iPhone 6.9")
// and 1080 x 2160 (Android phone).
const devices = { ios: { width: 440, height: 956 }, android: { width: 360, height: 720 } };
for (const [name, viewport] of Object.entries(devices)) {
  const p = await b.newPage({ viewport, deviceScaleFactor: 3 });
  // Show the app's own screens rather than the website's.
  await p.addInitScript(() => {
    window.CapacitorCustomPlatform = { name: "ios" };
  });
  await p.clock.setFixedTime(new Date("2026-11-05T08:04:00"));
  const shot = (file) => p.screenshot({ path: `${OUT}${name}/${file}.png` });
  await p.goto(SITE);
  await p.waitForTimeout(400);
  await shot("1-welcome");
  await p.goto(`${SITE}/#/p/${code}`);
  await p.waitForTimeout(600);
  await shot("2-today");
  await p.getByRole("button", { name: /I have put in/ }).click();
  await p.waitForTimeout(400);
  await shot("3-done");
  await p.locator("h2", { hasText: "Coming up" }).evaluate((el) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - 12));
  await p.waitForTimeout(200);
  await shot("4-plan");
  await p.close();
}
await b.close();
