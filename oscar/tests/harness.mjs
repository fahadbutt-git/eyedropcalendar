// Shared setup for the browser suites: Chrome with the built extension, the
// stand-in Oscar on port 8080 and the built site on port 4173.
// `npm run test:oscar` starts both servers and runs every suite.
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import { TERMS_VERSION } from "../../src/config.js";

export const OSCAR = "http://localhost:8080/oscar";
export const SITE = "http://localhost:4173/";
export const EXTENSION = join(dirname(fileURLToPath(import.meta.url)), "../extension/dist");

// The stand-in's test routes (reset, saved, break, ...).
export async function standin(route) {
  const r = await fetch(`${OSCAR}/__standin/${route}`);
  return (r.headers.get("content-type") || "").includes("json") ? r.json() : r.text();
}

export const ok = (what) => console.log(`ok    ${what}`);

// Chrome's full headless mode, which loads extensions, with the extension's
// service worker ready. `acceptTerms` agrees to the site's terms once.
export async function launch(name, { acceptTerms = true, viewport = { width: 1360, height: 860 } } = {}) {
  const context = await chromium.launchPersistentContext(mkdtempSync(join(tmpdir(), `edt-${name}-`)), {
    // EDT_HEADED=1 runs a visible Chrome, for CI under a virtual display.
    headless: !process.env.EDT_HEADED,
    channel: "chromium",
    viewport,
    args: [`--disable-extensions-except=${EXTENSION}`, `--load-extension=${EXTENSION}`],
  });
  const worker = context.serviceWorkers()[0] || (await context.waitForEvent("serviceworker"));
  if (process.env.EDT_TEST_DEBUG) debug(context, worker);
  if (acceptTerms) {
    const site = await context.newPage();
    await site.goto(SITE);
    await site.evaluate((v) => localStorage.setItem("edt.terms", JSON.stringify(v)), TERMS_VERSION);
    await site.close();
  }
  return { context, worker };
}

// Signs in to the stand-in Oscar and waits for the schedule.
export async function signIn(page) {
  await page.goto(`${OSCAR}/index.jsp`);
  await page.fill('input[name="username"]', "oscardoc");
  await page.fill('input[name="password"]', "mac2002");
  await page.fill('input[name="pin"]', "1117");
  await page.click("button");
  await page.waitForURL(/providercontrol/);
  return page;
}

// What the toolbar button, the shortcut and the right-click menu do: hand
// over any selected text, then run the panel in the page's tab.
export const openPanel = (worker, page, selection = "") =>
  worker.evaluate(
    async ({ url, selection }) => {
      const tab = (await chrome.tabs.query({})).find((t) => t.url === url);
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, func: (t) => (window.__edtSelection = t), args: [selection] });
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ["panel.js"] });
    },
    { url: page.url(), selection },
  );

export const panelOf = (page) => page.locator("#edt-oscar-panel");
export const panelText = (page) =>
  page.evaluate(() => document.getElementById("edt-oscar-panel")?.shadowRoot.querySelector("aside").innerText ?? "");

// Named scenarios that each run to the end, so one failure does not hide the
// rest. Pages a scenario opens are closed after it, and the stand-in reset.
export function scenarios() {
  const results = [];
  async function scenario(name, fn) {
    const opened = [];
    try {
      await fn(opened);
      results.push({ name, pass: true });
      console.log(`PASS  ${name}`);
    } catch (e) {
      results.push({ name, pass: false, why: e.message.split("\n")[0] });
      console.log(`FAIL  ${name}\n      ${e.message.split("\n").slice(0, 4).join("\n      ")}`);
    } finally {
      for (const p of opened) await p.close().catch(() => {});
      await standin("reset").catch(() => {});
    }
  }
  // Prints the totals and exits with 1 if any scenario failed.
  function finish(label) {
    const failed = results.filter((r) => !r.pass);
    console.log(`\n${label}: ${results.length - failed.length} of ${results.length} passed`);
    for (const f of failed) console.log(`  FAIL ${f.name}: ${f.why}`);
    process.exit(failed.length ? 1 : 0);
  }
  return { scenario, finish };
}

// EDT_TEST_DEBUG=1 logs every page, page error, crash and worker message.
function debug(context, worker) {
  const t0 = Date.now();
  const log = (...a) => console.log(`[debug +${((Date.now() - t0) / 1000).toFixed(1)}s]`, ...a);
  const watch = (p) => {
    log("page", p.url());
    p.on("console", (m) => m.type() === "error" && log("console error", p.url(), m.text()));
    p.on("pageerror", (e) => log("page error", p.url(), e.message));
    p.on("crash", () => log("crash", p.url()));
    p.on("close", () => log("closed", p.url()));
  };
  context.pages().forEach(watch);
  context.on("page", watch);
  context.on("serviceworker", (w) => log("service worker started", w.url()));
  worker.on("console", (m) => log("worker", m.type(), m.text()));
  worker.on("close", () => log("service worker stopped"));
}
