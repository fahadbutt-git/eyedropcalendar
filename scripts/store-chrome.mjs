// Chrome Web Store images for the Oscar extension: five 1280 x 800
// screenshots and the 440 x 280 promo tile, written to store/chrome.
// The pictures in store/chrome/src are from a demo Oscar (Open-O 25) and
// eyedroptracker.com, with a made-up patient.
//
//   node scripts/store-chrome.mjs
import { chromium } from "playwright";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const OUT = new URL("../store/chrome/", import.meta.url).pathname;
const SRC = `${OUT}src/`;
const require = createRequire(import.meta.url);
const font = (w) => readFileSync(require.resolve(`@fontsource/ibm-plex-sans/files/ibm-plex-sans-latin-${w}-normal.woff2`)).toString("base64");
const img = (f) => `data:image/${f.endsWith(".svg") ? "svg+xml" : "jpeg"};base64,${readFileSync(f).toString("base64")}`;
const icon = img(new URL("../public/icon.svg", import.meta.url).pathname);

const css = `
@font-face { font-family: Plex; font-weight: 400; src: url(data:font/woff2;base64,${font(400)}) format('woff2'); }
@font-face { font-family: Plex; font-weight: 600; src: url(data:font/woff2;base64,${font(600)}) format('woff2'); }
@font-face { font-family: Plex; font-weight: 700; src: url(data:font/woff2;base64,${font(700)}) format('woff2'); }
* { box-sizing: border-box; margin: 0; }
body { width: 1280px; height: 800px; overflow: hidden; background: #f7f5f0; color: #1b1f24; font-family: Plex, sans-serif; display: flex; align-items: center; gap: 56px; padding: 0 64px; }
.media { flex: none; display: flex; align-items: center; justify-content: center; }
.browser { border-radius: 12px; overflow: hidden; border: 1px solid #d9d5cb; background: #fff; box-shadow: 0 20px 50px rgba(20,30,50,.2); }
.bar { height: 30px; background: #ecebe6; display: flex; align-items: center; gap: 6px; padding: 0 12px; border-bottom: 1px solid #d9d5cb; }
.bar i { width: 10px; height: 10px; border-radius: 5px; display: block; }
.paper { background: #fff; padding: 22px; box-shadow: 0 16px 40px rgba(20,30,50,.18); rotate: -0.6deg; }
.phone { background: #16191e; padding: 10px; border-radius: 40px; box-shadow: 0 20px 50px rgba(20,30,50,.25); }
.phone img { border-radius: 31px; display: block; }
.text { display: flex; flex-direction: column; gap: 18px; }
.k { font-size: 16px; font-weight: 600; letter-spacing: .08em; text-transform: uppercase; color: #1f3a5f; }
h1 { font-size: 42px; line-height: 1.12; font-weight: 700; text-wrap: balance; }
p { font-size: 21px; line-height: 1.5; color: #4a515b; }`;

const browser = (src, h) => `<div class="browser"><div class="bar"><i style="background:#e66a5e"></i><i style="background:#e6b84f"></i><i style="background:#69b85a"></i></div><img src="${img(SRC + src)}" style="height:${h}px;display:block"></div>`;
const SHOTS = [
  {
    file: "1-read",
    media: browser("oscar-panel.jpg", 700),
    k: "In Oscar",
    title: "Read the eye drop plan from the chart in one click",
    body: "On a patient's encounter, click the button, choose Read eye drops from the right-click menu, or press Option+Shift+E. Anything the extension had to assume is flagged in amber.",
  },
  {
    file: "2-check",
    media: browser("review.jpg", 700),
    k: "Check",
    title: "Nothing prints until every drop is checked",
    body: "Eye Drop Tracker opens with the patient and drops filled in. Each drop sits beside the sentence it came from, and the calendar stays locked until the clinician ticks every one.",
  },
  {
    file: "3-calendar",
    media: `<div class="paper"><img src="${img(SRC + "calendar.jpg")}" style="width:640px;display:block"></div>`,
    k: "Print",
    title: "A calendar the patient can follow",
    body: "Cap colours, a tick box for every dose, and taper changes marked on the day they happen.",
  },
  {
    file: "4-phone",
    media: `<div class="phone"><img src="${img(SRC + "phone.jpg")}" style="height:690px"></div>`,
    k: "On the patient's phone",
    title: "Today's drops, in order, with reminders",
    body: "The QR code on the calendar opens the plan on the patient's phone. It holds no name or health card number.",
  },
  {
    file: "5-chart",
    media: browser("oscar-note.jpg", 700),
    k: "Back to the chart",
    title: "The plan goes back into Oscar for the next visit",
    body: "Added as an unsigned note for the clinician to sign. At follow-up the plan reopens exactly as it was, so a taper can be changed without starting over.",
  },
];

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1280, height: 800 } });
for (const s of SHOTS) {
  await page.setContent(`<style>${css}</style><div class="media">${s.media}</div><div class="text"><div class="k">${s.k}</div><h1>${s.title}</h1><p>${s.body}</p></div>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: `${OUT}${s.file}.png` });
}

const tile = await b.newPage({ viewport: { width: 440, height: 280 } });
await tile.setContent(`<style>${css} body { width: 440px; height: 280px; background: #1f3a5f; color: #fff; padding: 0 34px; gap: 22px; }</style>
  <img src="${icon}" style="width:84px;height:84px;border-radius:18px;flex:none">
  <div><div style="font-size:30px;font-weight:700;line-height:1.1">Eye Drop Tracker for Oscar</div><div style="font-size:16px;margin-top:10px;opacity:.85;line-height:1.4">From the chart note to the patient's calendar</div></div>`);
await tile.evaluate(() => document.fonts.ready);
await tile.screenshot({ path: `${OUT}promo-440x280.png` });
await b.close();
console.log(`Wrote ${SHOTS.length} screenshots and the promo tile to ${OUT}`);
