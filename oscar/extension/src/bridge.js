// Runs on Eye Drop Tracker. Hands the plan from Oscar to the page, and
// passes the page's chart note back. Messages stay inside this tab: only
// this page's own origin is accepted and written to.

const ORIGIN = window.location.origin;
const post = (data) => window.postMessage({ source: "edt-extension", ...data }, ORIGIN);

async function offerPlan() {
  const plan = await chrome.runtime.sendMessage({ type: "pending" }).catch(() => null);
  if (plan) post({ type: "import", ...plan });
}

window.addEventListener("message", async (e) => {
  if (e.source !== window || e.origin !== ORIGIN || e.data?.source !== "edt-page") return;
  if (e.data.type === "ready") offerPlan();
  if (e.data.type === "addToChart" && typeof e.data.text === "string") {
    const result = await chrome.runtime
      .sendMessage({ type: "addToChart", handoff: e.data.handoff, text: e.data.text.slice(0, 20000) })
      .catch(() => ({ ok: false, message: "The extension did not answer. Reload the page and try again." }));
    post({ type: "added", id: e.data.id, ...result });
  }
});

document.documentElement.dataset.oscarBridge = "1";
post({ type: "hello" });
