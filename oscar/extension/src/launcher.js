// A small "Eye drops" button on Oscar's encounter page, so the clinician
// never needs a shortcut or menu. It runs only on an Oscar the clinic has
// allowed once, reads nothing, and opens the panel only on a person's click.
import { openPatientId } from "./oscarApi.js";

// Oscar's encounter, and its ophthalmology Eye Form (eyeform/eyeform.jsp).
const ENCOUNTER = /casemgmt\/forward\.jsp|CaseManagementEntry|oscarEncounter|encounter|eyeform/i;

function add() {
  if (window.top !== window || document.getElementById("edt-oscar-launcher")) return;
  if (!ENCOUNTER.test(location.pathname) || !openPatientId(location, document)) return;

  const host = document.createElement("div");
  host.id = "edt-oscar-launcher";
  host.style.cssText = "all: initial; position: fixed; right: 16px; bottom: 16px; z-index: 2147483646;";
  // Open like the panel, so tests can reach it. Scripted clicks are ignored.
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<style>
    button { display: flex; align-items: center; gap: 8px; font: 600 14px/1 -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #fff; background: #1f3a5f; border: 0; border-radius: 999px; padding: 10px 16px 10px 12px; cursor: pointer;
      box-shadow: 0 2px 10px rgba(0,0,0,.25); }
    button:hover { background: #17304f; }
    button:focus-visible { outline: 3px solid #4a7fc1; outline-offset: 2px; }
    svg { width: 18px; height: 18px; flex: none; }
  </style>
  <button type="button" title="Read the eye drop plan from this chart (Eye Drop Tracker)">
    <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M12 2.5c-.3 0-.6.2-.8.5C9.7 5.3 6 10.4 6 14a6 6 0 0 0 12 0c0-3.6-3.7-8.7-5.2-11-.2-.3-.5-.5-.8-.5Z"/></svg>
    Eye drops
  </button>`;
  const button = root.querySelector("button");
  // Keep the cursor where it was in the note box, so a selection there is
  // still the selection when the panel reads it.
  button.addEventListener("mousedown", (e) => e.preventDefault());
  button.addEventListener("click", (e) => {
    if (!e.isTrusted) return;
    const el = document.activeElement;
    const selection =
      el && /^(TEXTAREA|INPUT)$/.test(el.tagName) && el.selectionEnd > el.selectionStart
        ? el.value.slice(el.selectionStart, el.selectionEnd)
        : String(window.getSelection?.() || "");
    chrome.runtime.sendMessage({ type: "openPanel", selection: selection.slice(0, 20000) }).catch(() => {});
  });
  document.documentElement.appendChild(host);
}

add();
