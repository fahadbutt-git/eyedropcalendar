// The panel on the Oscar chart. It reads the open patient's notes and
// medication list from Oscar, shows the drops it found with everything it
// had to assume, and opens the checked drops in Eye Drop Tracker.
import { SEED_FORMULARY } from "../../../src/data/formulary.js";
import { parseNote, parseRxList } from "../../../src/lib/noteParser.js";
import { patientInstruction } from "../../../src/lib/wording.js";
import { codeFromUrl, decodeRegimen } from "../../../src/lib/share.js";
import { oscarClient, openPatientId, restBase } from "./oscarApi.js";
import STYLE from "./panel.css";

const SITE_HOST = new URL(__EDT_SITE__).host;

const formulary = SEED_FORMULARY;
const medOf = (brand) => formulary.find((m) => m.brand === brand);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fmtDate = (iso) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "Undated" : d.toLocaleDateString("en-CA", { day: "numeric", month: "short", year: "numeric" });
};

function mount() {
  const host = document.createElement("div");
  host.id = "edt-oscar-panel";
  host.style.cssText = "all:initial;position:fixed;top:0;right:0;height:100vh;z-index:2147483647";
  // Its own styles, kept apart from Oscar's.
  const root = host.attachShadow({ mode: "open" });
  const style = document.createElement("style");
  style.textContent = STYLE;
  const panel = document.createElement("aside");
  panel.setAttribute("aria-label", "Eye Drop Tracker");
  panel.setAttribute("aria-live", "polite");
  root.append(style, panel);
  document.documentElement.append(host);
  return { host, panel };
}

function start() {
  const { host, panel } = mount();
  const client = oscarClient(restBase(window.location));
  // Text the clinician selected: on the page, inside Oscar's note box, or
  // handed over by the right-click menu.
  const fieldSelection = () => {
    const el = document.activeElement;
    return el && /^(TEXTAREA|INPUT)$/.test(el.tagName) && el.selectionEnd > el.selectionStart ? el.value.slice(el.selectionStart, el.selectionEnd) : "";
  };
  const selection = String(window.__edtSelection || window.getSelection?.() || fieldSelection() || "").trim();
  window.__edtSelection = "";
  // The note being written at this visit, not saved yet. Oscar starts it with
  // a date line such as "[05-Nov-2026 .: ]", which is not part of the plan.
  const draft = () =>
    [...document.querySelectorAll('textarea[name="caseNote_note"]')]
      .map((t) => t.value.replace(/^\s*\[[^\]\n]{0,60}\]\s*/, "").trim())
      .filter((t) => t.length > 10)
      .join("\n\n");
  const state = { patient: null, notes: [], rx: [], source: null, result: null, chosen: new Set(), error: "", busy: true, opened: false, offerButton: false };

  const sourceText = () => {
    if (state.source === "selection") return selection;
    if (state.source === "draft") return draft();
    return state.notes.find((n) => n.id === state.source)?.text || "";
  };
  // A note Eye Drop Tracker wrote carries the plan link, which gives the
  // plan exactly, and lets the patient keep their check marks.
  const fromLink = (text) => {
    const code = codeFromUrl(text);
    if (!code) return null;
    try {
      const plan = decodeRegimen(code);
      return { code, drops: plan.entries.map((e) => ({ ...e, flags: [] })), skipped: [] };
    } catch {
      return null;
    }
  };
  const read = () => {
    state.readDraft = draft();
    state.stale = false;
    state.result = state.source === "rx" ? parseRxList(state.rx, formulary) : fromLink(sourceText()) || parseNote(sourceText(), formulary);
    state.chosen = new Set(state.result.drops.map((_, i) => i));
    state.opened = false;
  };

  function render() {
    // Redrawing keeps keyboard focus on the same control.
    const was = panel.getRootNode().activeElement;
    const focusKey = was && (was.dataset.i != null ? `[data-i="${was.dataset.i}"]` : was.dataset.act ? `[data-act="${was.dataset.act}"]` : null);
    draw();
    if (focusKey) panel.querySelector(focusKey)?.focus();
  }

  function draw() {
    const r = state.result;
    const options = [
      selection.length > 10 && `<option value="selection">Text selected on this page</option>`,
      draft() && `<option value="draft">Today's note, not saved yet</option>`,
      ...state.notes.map((n) => `<option value="${esc(n.id)}">Note, ${esc(fmtDate(n.date))}${n.provider ? `, ${esc(n.provider)}` : ""}</option>`),
      state.rx.length && `<option value="rx">Medication list (Rx)</option>`,
    ].filter(Boolean);
    panel.innerHTML = `
      <header><div><h1>Eye Drop Tracker</h1><p class="origin">Reading ${esc(window.location.host)}</p></div><button class="x" data-act="close" aria-label="Close">×</button></header>
      <div class="body">
        ${state.error ? `<p class="error" role="alert">${esc(state.error)}${state.errorDetail ? `<span class="detail">Details for support: ${esc(state.errorDetail)}</span>` : ""}</p>` : ""}
        ${state.retry ? `<button class="secondary" data-act="retry">Try again</button>` : ""}
        ${(state.partial || []).map((m) => `<p class="note-partial">${esc(m)}. Select the drops in the note, or use today's note.</p>`).join("")}
        ${state.busy ? `<p class="muted">Reading the chart…</p>` : ""}
        ${state.stale ? `<div class="note-changed" role="status"><p>Today's note has changed since it was read.</p><button class="secondary" data-act="reread">Read today's note again</button></div>` : ""}
        ${state.patient ? `<p class="who"><strong>${esc(state.patient.name)}</strong>${state.patient.dob ? `<span>Born ${esc(state.patient.dob)}</span>` : ""}</p>` : ""}
        ${options.length ? `<label class="field">Read drops from<select data-act="source">${options.join("")}</select></label>` : ""}
        ${state.source && state.source !== "rx" ? `<details class="src"><summary>Show the text</summary><pre>${esc(sourceText())}</pre></details>` : ""}
        ${r ? drops(r) : ""}
        ${state.patient && !state.busy && !state.error && !state.source && !state.stale && !state.partial?.length ? `<p class="muted">This chart has no notes or medications to read yet. Write the plan in today's note and open the panel again, or add the drops by hand.</p>` : ""}
      </div>
      <footer>
        <button class="primary" data-act="open" ${!state.patient || state.opened ? "disabled" : ""}>${state.opened ? "Opened in Eye Drop Tracker" : state.chosen.size ? `Open ${state.chosen.size} in Eye Drop Tracker` : "Open Eye Drop Tracker and add drops by hand"}</button>
        <p class="muted small">Read on this computer only. Check every drop against the chart before anything is printed.</p>
        ${state.offerButton ? `<div class="setup"><button class="secondary" data-act="setup">Add an Eye drops button to every encounter</button><p class="muted small">Opens this panel in one click, without the shortcut. You can remove it at any time in Chrome.</p></div>` : ""}
      </footer>`;
    const select = panel.querySelector('[data-act="source"]');
    if (select && state.source) select.value = state.source;
  }

  function drops(r) {
    const unknown = (r.unknown || []).length
      ? `<h2>Not recognised</h2><ul class="skipped">${r.unknown.map((w) => `<li><strong>${esc(w)}</strong>: not on the drug list. If it is a drop, add it by hand in Eye Drop Tracker.</li>`).join("")}</ul>`
      : "";
    if (!r.drops.length && !r.skipped.length)
      return `<p class="muted">No eye drops recognised here. Choose another note, select the plan in the note and click the button again, or open Eye Drop Tracker and add the drops by hand. The patient's details are filled in, and the plan can still be added to this chart.</p>${unknown}`;
    const items = r.drops
      .map((d, i) => {
        const med = medOf(d.brand);
        return `<li class="${d.flags.length ? "flagged" : ""}">
          <label><input type="checkbox" data-i="${i}" ${state.chosen.has(i) ? "checked" : ""} ${r.code ? "disabled" : ""}>
          <span><strong>${esc(d.brand)}</strong> <span class="muted">${esc(med?.generic || "")}</span><br>${esc(patientInstruction(d, med?.qhs))}</span></label>
          ${d.flags.length ? `<ul class="flags">${d.flags.map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
        </li>`;
      })
      .join("");
    const skipped = r.skipped.length
      ? `<h2>Not added</h2><ul class="skipped">${r.skipped.map((s) => `<li><strong>${esc(s.name)}</strong>: ${esc(s.why)}</li>`).join("")}</ul>`
      : "";
    const link = r.code ? `<p class="link-note">This note has an Eye Drop Tracker plan link. The plan opens exactly as it was saved, and the patient keeps their check marks.</p>` : "";
    return `${r.drops.length ? `<h2>Drops found</h2>${link}<ul class="drops">${items}</ul>` : `<p class="muted">No eye drops recognised here. Open Eye Drop Tracker to add them by hand.</p>`}${skipped}${unknown}`;
  }

  panel.addEventListener("change", (e) => {
    const t = e.target;
    if (t.dataset.act === "source") {
      state.source = t.value;
      read();
      render();
    } else if (t.dataset.i != null) {
      const i = Number(t.dataset.i);
      if (t.checked) state.chosen.add(i);
      else state.chosen.delete(i);
      state.opened = false;
      render();
    }
  });

  panel.addEventListener("click", async (e) => {
    // Only a person's click counts. A script on the Oscar page cannot press
    // the panel's buttons.
    if (!e.isTrusted) return;
    const act = e.target.closest("[data-act]")?.dataset.act;
    if (act === "close") close();
    if (act === "retry") {
      Object.assign(state, { error: "", errorDetail: "", retry: false, partial: [], busy: true });
      render();
      return load();
    }
    if (act === "reread") {
      if (draft()) state.source = "draft";
      if (state.source) read();
      state.stale = false;
      return render();
    }
    if (act === "setup") {
      await chrome.runtime.sendMessage({ type: "setup" }).catch(() => {});
      state.offerButton = false;
      return draw();
    }
    if (act === "open") {
      const chosen = (state.result?.drops || []).filter((_, i) => state.chosen.has(i));
      const reply = await chrome.runtime.sendMessage({
        type: "open",
        payload: {
          patientId: state.patient.id,
          provider: state.provider,
          patient: { name: state.patient.name, dob: state.patient.dob },
          // The note stays here. Each drop takes only the sentence it was read
          // from, so the clinician can check it against the chart.
          drops: chosen.map((d) => ({ ...d, source: typeof d.source === "string" ? d.source.slice(0, 200) : "" })),
          code: state.result?.code || "",
          // Unknown words go with the skipped ones, so the review lists them.
          skipped: [...(state.result?.skipped || []), ...(state.result?.unknown || []).map((w) => ({ name: w, why: "not on the drug list, so add it by hand if it is a drop" }))],
        },
      });
      state.opened = !!reply?.ok;
      state.error = reply?.ok ? "" : reply?.message || "Eye Drop Tracker could not be opened.";
      render();
    }
  });

  async function load() {
    const id = openPatientId(window.location, document);
    // Oscar has refused this encounter to the person signed in, so the panel
    // reads nothing either.
    if (id && /access denied/i.test(document.title + " " + (document.body?.innerText || "").slice(0, 400))) {
      state.busy = false;
      state.error = "Oscar does not allow you to open this patient's encounter, so nothing was read.";
      return render();
    }
    if (!id) {
      state.busy = false;
      state.error = "Open a patient's encounter in Oscar, then click the Eye Drop Tracker button.";
      return render();
    }
    try {
      // The patient is required. Saved notes and the Rx list are not, so a
      // clinic whose Oscar differs can still read today's note or a selection.
      const [patient, notes, rx, provider] = await Promise.all([
        client.patient(id),
        client.notes(id).catch((e) => ((state.partial = state.partial || []).push(`Saved notes could not be read (${e.detail || e.message})`), [])),
        client.currentDrugs(id).catch((e) => ((state.partial = state.partial || []).push(`The medication list could not be read (${e.detail || e.message})`), [])),
        client.me().catch(() => ""),
      ]);
      Object.assign(state, { patient, notes, rx, provider });
      const withDrops = notes.find((n) => fromLink(n.text) || parseNote(n.text, formulary).drops.length);
      // Selected text first, then today's unsaved note if it names a drop,
      // then the newest saved note that does.
      const draftHasDrops = draft() && (fromLink(draft()) || parseNote(draft(), formulary).drops.length);
      state.source = selection.length > 10 ? "selection" : draftHasDrops ? "draft" : withDrops?.id || notes[0]?.id || (rx.length ? "rx" : draft() ? "draft" : null);
      if (state.source) read();
      else state.readDraft = draft();
    } catch (e) {
      state.error = e.message || "Oscar could not be read.";
      state.errorDetail = e.detail || "";
      // A signed-out clinician signs in first. Anything else may pass.
      state.retry = e.kind !== "signed-out";
      if (state.retry) state.error += ` Try again in a moment. If it keeps failing, enter the patient and drops by hand at ${SITE_HOST}.`;
    }
    state.busy = false;
    render();
  }

  // Eye Drop Tracker sends the finished chart note back here. It is added
  // only to the patient the plan was read from, and only while that chart is
  // still the one open.
  window.__edtAddNote = (msg, reply) => {
    if (!state.patient || msg.patientId !== state.patient.id || openPatientId(window.location, document) !== msg.patientId) {
      reply({ ok: false, message: "The Oscar tab now shows a different patient, so nothing was added. Use Copy for chart note." });
      return false;
    }
    // The same clinician must still be signed in to Oscar.
    client
      .me()
      .catch((e) => {
        if (e.kind === "signed-out") throw new Error("Oscar has signed you out, so nothing was added. Sign in to Oscar, open the chart again and use the Eye drops button, or use Copy for chart note.");
        return "";
      })
      .then((now) => {
        if (msg.provider && now !== msg.provider) throw new Error("A different person is now signed in to Oscar, so nothing was added. Read the chart again.");
        // Today's note is open in this encounter: the plan goes into it, below
        // what the clinician has written, and is signed with it. A separate
        // note saved behind it would make Oscar drop the unsaved draft the
        // next time the encounter opens.
        const box = [...document.querySelectorAll('textarea[name="caseNote_note"]')].filter((t) => !t.disabled && !t.readOnly && t.offsetParent !== null).pop();
        if (box) {
          const before = box.value.replace(/\s+$/, "");
          box.value = `${before}${before ? "\n\n" : ""}${msg.text}\n`;
          for (const type of ["input", "keyup", "change"]) box.dispatchEvent(new Event(type, { bubbles: true }));
          return "draft";
        }
        return client.addNote(msg.patientId, msg.text).then(() => "note");
      })
      .then(
        (where) =>
          reply({
            ok: true,
            message:
              where === "draft"
                ? "Added to today's note in Oscar, below what was already written. Review it and sign the note as usual."
                : "Added to the Oscar chart as an unsigned note. Sign it in the chart.",
          }),
        (e) => reply({ ok: false, message: e.message || "Oscar did not save the note." })
      );
    return true;
  };

  // Keyboard: focus moves into the panel when it opens, Escape closes it and
  // returns focus to where the clinician was in Oscar.
  const returnTo = document.activeElement;
  // Typing in today's note after the panel read it: offer to read it again,
  // so the panel never shows a plan the note no longer says.
  const onNoteInput = (e) => {
    if (e.target?.name !== "caseNote_note" || state.busy || state.stale || !state.patient) return;
    if (draft() !== (state.readDraft ?? "")) {
      state.stale = true;
      render();
    }
  };
  document.addEventListener("input", onNoteInput, true);
  function close() {
    document.removeEventListener("input", onNoteInput, true);
    host.remove();
    window.__edtPanel = null;
    if (returnTo?.isConnected) returnTo.focus?.();
  }
  panel.addEventListener("keydown", (e) => {
    if (e.key === "Escape") close();
  });

  render();
  panel.querySelector('[data-act="close"]')?.focus();
  load();
  chrome.runtime
    .sendMessage({ type: "buttonStatus" })
    .then((s) => {
      state.offerButton = s?.offer === true;
      if (state.offerButton) draw();
    })
    .catch(() => {});
  return host;
}

// One listener for the page, whichever panel is the latest, so a note is
// never added twice.
if (!window.__edtListening) {
  window.__edtListening = true;
  chrome.runtime.onMessage.addListener((msg, _sender, reply) => (msg?.type === "addNote" && window.__edtAddNote ? window.__edtAddNote(msg, reply) : false));
}

// Clicking the toolbar button again closes the panel.
if (window.__edtPanel?.isConnected) {
  window.__edtPanel.remove();
  window.__edtPanel = null;
} else {
  window.__edtPanel = start();
}
