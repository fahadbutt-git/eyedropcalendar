// Passes a plan between the Oscar tab and the Eye Drop Tracker tab. The
// extension only touches a tab when the clinician clicks its button there
// (activeTab), so it holds no standing access to any website.
//
// A handoff (an Oscar tab, the patient open in it and the drops read) is
// kept in session storage, which Chrome clears when the browser closes, and
// the drops are deleted as soon as Eye Drop Tracker has taken them.

const DEFAULT_SITE = "https://eyedroptracker.com/";
const site = async () => (await chrome.storage.local.get("site")).site || DEFAULT_SITE;
const key = (id) => `handoff:${id}`;
const tabKey = (tabId) => `tab:${tabId}`;

// Oscar opens encounters in pop-up windows, which Chrome shows without
// extension buttons. So the panel also opens from the right-click menu and
// from a keyboard shortcut (Alt+Shift+E, Option+Shift+E on a Mac), which
// grant the same one-tab access as the button.
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

async function openTracker(sender, payload) {
  const handoff = crypto.randomUUID();
  const created = await trackerTab(`${await site()}#/oscar`, sender.tab);
  await chrome.storage.session.set({
    [key(handoff)]: { oscarTab: sender.tab.id, patientId: payload.patientId, payload },
    [tabKey(created.id)]: handoff,
  });
  return { ok: true };
}

// Eye Drop Tracker asks once for the plan meant for its tab.
async function pending(sender) {
  const handoff = (await chrome.storage.session.get(tabKey(sender.tab.id)))[tabKey(sender.tab.id)];
  if (!handoff) return null;
  const stored = (await chrome.storage.session.get(key(handoff)))[key(handoff)];
  if (!stored?.payload) return null;
  const { payload, ...rest } = stored;
  await chrome.storage.session.set({ [key(handoff)]: rest });
  return { handoff, drops: payload.drops, skipped: payload.skipped, patient: payload.patient, code: payload.code };
}

async function addToChart(sender, { handoff, text }) {
  const stored = handoff && (await chrome.storage.session.get(key(handoff)))[key(handoff)];
  if (!stored) return { ok: false, message: "This plan was not opened from Oscar in this browser session. Use Copy for chart note instead." };
  const mine = (await chrome.storage.session.get(tabKey(sender.tab.id)))[tabKey(sender.tab.id)];
  if (mine !== handoff) return { ok: false, message: "This tab did not open this plan." };
  try {
    return await chrome.tabs.sendMessage(stored.oscarTab, { type: "addNote", patientId: stored.patientId, text });
  } catch {
    return { ok: false, message: "The Oscar chart is closed or has moved on. Open it again and click the Eye Drop Tracker button, or use Copy for chart note." };
  }
}

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  if (!sender.tab) return false;
  const run = { open: () => openTracker(sender, msg.payload), pending: () => pending(sender), addToChart: () => addToChart(sender, msg) }[msg?.type];
  if (!run) return false;
  run().then(reply, (e) => reply({ ok: false, message: String(e?.message || e) }));
  return true;
});

chrome.tabs.onRemoved.addListener(async (tabId) => {
  const k = tabKey(tabId);
  const handoff = (await chrome.storage.session.get(k))[k];
  await chrome.storage.session.remove(handoff ? [k, key(handoff)] : [k]);
});
