// Passes a plan between the Oscar tab and the Eye Drop Tracker tab. The
// extension only touches a tab when the clinician asks it to there
// (activeTab), so it holds no standing access to any website.
//
// A hand-off records the Oscar page, the patient and the clinician the plan
// was read from. It is kept in session storage, which only this service
// worker can read and which Chrome clears when the browser closes. The
// patient's name, date of birth and drops are deleted as soon as Eye Drop
// Tracker has taken them, or after two hours if it never does. The rest goes
// when either tab closes.
import { decodeRegimen } from "../../../src/lib/share.js";
import { chartNote } from "../../../src/lib/chartNote.js";

// Fixed at build time (scripts/extension.mjs), never a setting.
// eslint-disable-next-line no-undef
const SITE = __EDT_SITE__;
// The only Oscar addresses the Eye drops button may be allowed on. Empty in
// the general build, so it can never ask for access to any site.
// eslint-disable-next-line no-undef
const OSCARS = __EDT_OSCARS__;
const PLAN_TTL = 2 * 60 * 60 * 1000;
const key = (id) => `handoff:${id}`;
const tabKey = (tabId) => `tab:${tabId}`;
const read = async (k) => (await chrome.storage.session.get(k))[k];

// Oscar opens encounters in pop-up windows, which Chrome shows without
// extension buttons. So the panel opens from an Eye drops button on the
// encounter (once the clinic allows it for its Oscar), the right-click menu,
// or a keyboard shortcut (Alt+Shift+E, Control+Shift+E on a Mac).
const MENU = "edt-read";
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: MENU, title: "Read eye drops with Eye Drop Tracker", contexts: ["page", "selection", "editable", "frame"] });
});

async function openPanel(tab, selection = "", frameId) {
  if (!tab?.id) return;
  const target = { tabId: tab.id, ...(frameId ? { frameIds: [frameId] } : {}) };
  try {
    // Text selected inside Oscar's note box is not visible to the page's own
    // selection, so the menu hands it over.
    await chrome.scripting.executeScript({ target, func: (text) => (window.__edtSelection = text), args: [String(selection).slice(0, 20000)] });
    await chrome.scripting.executeScript({ target, files: ["panel.js"] });
  } catch {
    // Chrome's own pages and the web store cannot be read. Nothing to do.
  }
}

chrome.action.onClicked.addListener((tab) => openPanel(tab));

// The Eye drops button runs only on Oscar addresses the clinic has allowed
// from the setup page. Never on Eye Drop Tracker itself.
const LAUNCHER = "edt-launcher";
const SITE_ORIGIN = new URL(SITE).origin;
// Setup grants the permission and messages the worker at the same moment,
// so two syncs can overlap. They run one at a time, or the second
// registration fails as a duplicate and the setup page never hears back.
let syncing = Promise.resolve();
function syncLauncher() {
  const run = syncing.then(async () => {
    const { origins = [] } = await chrome.permissions.getAll();
    const matches = origins.filter((o) => OSCARS.some((x) => o === `${x}/*`));
    await chrome.scripting.unregisterContentScripts({ ids: [LAUNCHER] }).catch(() => {});
    if (matches.length) await chrome.scripting.registerContentScripts([{ id: LAUNCHER, matches, js: ["launcher.js"], runAt: "document_idle", persistAcrossSessions: true }]);
    return matches;
  });
  syncing = run.catch(() => {});
  return run;
}
// After setup, the button appears on encounters already open, with no reload.
async function showLauncherNow() {
  const matches = await syncLauncher();
  if (!matches.length) return;
  for (const t of await chrome.tabs.query({ url: matches })) chrome.scripting.executeScript({ target: { tabId: t.id }, files: ["launcher.js"] }).catch(() => {});
}
chrome.runtime.onInstalled.addListener(syncLauncher);
chrome.runtime.onStartup.addListener(syncLauncher);
chrome.permissions.onAdded.addListener(showLauncherNow);
chrome.permissions.onRemoved.addListener(syncLauncher);

async function buttonStatus(sender) {
  const origin = new URL(sender.tab.url).origin;
  if (!OSCARS.includes(origin)) return { offer: false };
  return { offer: !(await chrome.permissions.contains({ origins: [`${origin}/*`] })), origin };
}
async function setup(sender) {
  const origin = new URL(sender.tab.url).origin;
  if (!OSCARS.includes(origin)) return { ok: false };
  await chrome.windows.create({ url: chrome.runtime.getURL(`setup.html?origin=${encodeURIComponent(origin)}`), type: "popup", width: 520, height: 380, focused: true });
  return { ok: true };
}
chrome.contextMenus.onClicked.addListener((info, tab) => info.menuItemId === MENU && openPanel(tab, info.selectionText || "", info.frameId));

// Eye Drop Tracker opens in an ordinary window, even when Oscar's encounter
// is a pop-up.
async function trackerTab(url, from) {
  const win = await chrome.windows.get(from.windowId).catch(() => null);
  if (win?.type === "normal") return chrome.tabs.create({ url, windowId: win.id, index: from.index + 1 });
  const normal = await chrome.windows.getLastFocused({ windowTypes: ["normal"] }).catch(() => null);
  if (normal) {
    const tab = await chrome.tabs.create({ url, windowId: normal.id });
    await chrome.windows.update(normal.id, { focused: true });
    return tab;
  }
  const created = await chrome.windows.create({ url, type: "normal" });
  return created.tabs[0];
}

// Only plain, bounded data is passed on: at most a dozen drops, short text,
// and nothing that is not plain JSON.
const MAX_PAYLOAD = 64 * 1024;
const plain = (v) => JSON.parse(JSON.stringify(v ?? null));
function checkPayload(p) {
  if (!p || typeof p !== "object" || JSON.stringify(p).length > MAX_PAYLOAD) return null;
  if (!/^\d{1,10}$/.test(String(p.patientId))) return null;
  return plain({
    patientId: String(p.patientId),
    provider: String(p.provider ?? "").slice(0, 20),
    patient: { name: String(p.patient?.name ?? "").slice(0, 160), dob: String(p.patient?.dob ?? "").slice(0, 10) },
    drops: Array.isArray(p.drops) ? p.drops.slice(0, 12) : [],
    skipped: Array.isArray(p.skipped) ? p.skipped.slice(0, 20) : [],
    code: typeof p.code === "string" ? p.code.slice(0, 4000) : "",
  });
}

async function openTracker(sender, raw) {
  const payload = checkPayload(raw);
  if (!payload) return { ok: false, message: "The plan could not be read. Nothing was opened." };
  const handoff = crypto.randomUUID();
  const { patientId, provider } = payload;
  // Stored before the tab opens, so the page always finds it. The document
  // ID ties later writes to this exact Oscar page: if the tab has moved on,
  // nothing is written.
  await chrome.storage.session.set({
    [key(handoff)]: { oscarTab: sender.tab.id, oscarDoc: sender.documentId || "", patientId, provider, at: Date.now(), written: [], payload },
  });
  try {
    const created = await trackerTab(`${SITE}#/oscar`, sender.tab);
    await chrome.storage.session.set({ [tabKey(created.id)]: handoff });
    return { ok: true };
  } catch {
    await chrome.storage.session.remove(key(handoff));
    return { ok: false, message: "Eye Drop Tracker could not be opened." };
  }
}

// Eye Drop Tracker asks once for the plan meant for its tab.
async function pending(sender) {
  const handoff = await read(tabKey(sender.tab.id));
  const stored = handoff && (await read(key(handoff)));
  if (!stored?.payload) return null;
  const { payload, ...rest } = stored;
  await chrome.storage.session.set({ [key(handoff)]: rest });
  if (Date.now() - stored.at > PLAN_TTL) return null;
  const { patient, drops, skipped, code } = payload;
  return { handoff, patient, drops, skipped, code };
}

const digest = async (text) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)))].map((b) => b.toString(16).padStart(2, "0")).join("");
const busy = new Set();

// The note is written by the extension from the plan code, never taken as
// text from the website, so the page cannot put anything but a well-formed
// Eye Drop Tracker plan in a chart.
async function addToChart(sender, { handoff, code }) {
  let plan;
  try {
    plan = decodeRegimen(String(code || ""));
  } catch {
    return { ok: false, message: "This is not an Eye Drop Tracker plan, so nothing was added." };
  }
  const stored = typeof handoff === "string" && (await read(key(handoff)));
  if (!stored)
    return { ok: false, message: "This plan can no longer go back to Oscar, because its chart was closed. Open the chart again and use the Eye drops button, or use Copy for chart note." };
  // A hand-off is good for two hours, for writing as well as reading.
  if (Date.now() - stored.at > PLAN_TTL) {
    await chrome.storage.session.remove(key(handoff));
    return { ok: false, message: "This plan was read from Oscar more than two hours ago, so it was not added. Open the chart again and use the Eye drops button, or use Copy for chart note." };
  }
  if ((await read(tabKey(sender.tab.id))) !== handoff) return { ok: false, message: "This tab did not open this plan." };
  const text = chartNote({ ...plan, link: `${SITE}#/p/${code}` });
  const sum = await digest(text);
  if (stored.written.includes(sum)) return { ok: false, message: "This plan is already in the Oscar chart." };
  if (busy.has(handoff)) return { ok: false, message: "Already adding this plan. Wait a moment." };
  busy.add(handoff);
  try {
    const message = { type: "addNote", patientId: stored.patientId, provider: stored.provider, text };
    const result = await chrome.tabs.sendMessage(stored.oscarTab, message, stored.oscarDoc ? { documentId: stored.oscarDoc } : { frameId: 0 });
    if (result?.ok) await chrome.storage.session.set({ [key(handoff)]: { ...stored, written: [...stored.written, sum] } });
    return result || { ok: false, message: "The Oscar chart did not answer." };
  } catch {
    return { ok: false, message: "The Oscar chart is closed or has moved on. Open it again and use the Eye Drop Tracker button, or use Copy for chart note." };
  } finally {
    busy.delete(handoff);
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  // The setup page is the extension's own page, so it has no tab of its own.
  if (msg?.type === "launcherAdded" && sender.id === chrome.runtime.id && sender.url?.startsWith(chrome.runtime.getURL("setup.html"))) {
    showLauncherNow().then(
      () => reply({ ok: true }),
      () => reply({ ok: false })
    );
    return true;
  }
  if (!sender.tab || sender.id !== chrome.runtime.id) return false;
  const run = {
    open: () => openTracker(sender, msg.payload),
    pending: () => pending(sender),
    addToChart: () => addToChart(sender, msg),
    openPanel: async () => openPanel(sender.tab, typeof msg.selection === "string" ? msg.selection : "", sender.frameId),
    buttonStatus: () => buttonStatus(sender),
    setup: () => setup(sender),
  }[msg?.type];
  if (!run) return false;
  run().then(reply, () => reply({ ok: false, message: "Something went wrong. Nothing was changed." }));
  return true;
});

// Closing either tab ends the hand-off.
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const all = await chrome.storage.session.get(null);
  const handoff = all[tabKey(tabId)];
  const ended = Object.entries(all)
    .filter(([k, v]) => k.startsWith("handoff:") && (k === key(handoff) || v?.oscarTab === tabId))
    .map(([k]) => k);
  const tabs = Object.entries(all)
    .filter(([k, v]) => k.startsWith("tab:") && (k === tabKey(tabId) || ended.includes(key(v))))
    .map(([k]) => k);
  if (ended.length || tabs.length) await chrome.storage.session.remove([...ended, ...tabs]);
});
