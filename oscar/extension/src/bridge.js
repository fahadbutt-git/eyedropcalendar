// Runs on Eye Drop Tracker. Hands the plan from Oscar to the page, and
// passes the page's chart note back. Messages stay inside this tab: only
// this page's own origin is accepted and written to.

const ORIGIN = window.location.origin;
const post = (data) => window.postMessage({ source: "edt-extension", ...data }, ORIGIN);

// The plan is stored before this tab opens. A short retry covers a service
// worker that is still waking up.
let offered = false;
async function offerPlan() {
  if (offered) return;
  for (let i = 0; i < 5; i++) {
    const plan = await chrome.runtime.sendMessage({ type: "pending" }).catch(() => null);
    if (plan) {
      offered = true;
      return post({ type: "import", ...plan });
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

window.addEventListener("message", async (e) => {
  if (e.source !== window || e.origin !== ORIGIN || e.data?.source !== "edt-page") return;
  if (e.data.type === "ready") offerPlan();
  // Writing to a chart needs a person's click on this page, so a script on the
  // page cannot do it by itself.
  if (e.data.type === "addToChart" && !navigator.userActivation?.isActive) {
    post({ type: "added", id: e.data.id, ok: false, message: "Click Add to Oscar chart to add the plan." });
    return;
  }
  if (e.data.type === "addToChart" && typeof e.data.code === "string") {
    // Only the plan code goes back. The extension writes the note itself.
    const result = await chrome.runtime
      .sendMessage({ type: "addToChart", handoff: String(e.data.handoff).slice(0, 64), code: e.data.code.slice(0, 4000) })
      .catch(() => ({ ok: false, message: "The extension did not answer. Reload the page and try again." }));
    post({ type: "added", id: e.data.id, ...result });
  }
});

document.documentElement.dataset.oscarBridge = "1";
post({ type: "hello" });
