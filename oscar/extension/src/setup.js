// The one-time setup page that asks Chrome to allow the Eye drops button on
// one Oscar address. Chrome only asks for a site permission from a click on
// the extension's own page, so the panel opens this small window.
const origin = new URLSearchParams(location.search).get("origin") || "";
const valid = /^https?:\/\/[^/\s]+$/.test(origin);
const $ = (id) => document.getElementById(id);
$("site").textContent = valid ? origin.replace(/^https?:\/\//, "") : "this Oscar";

const say = (text, kind) => {
  $("status").textContent = text;
  $("status").className = kind;
};

$("cancel").addEventListener("click", () => window.close());
$("allow").addEventListener("click", async () => {
  if (!valid) return say("This address cannot be used. Open the panel from an Oscar encounter and try again.", "error");
  const granted = await chrome.permissions.request({ origins: [`${origin}/*`] }).catch(() => false);
  if (!granted) return say("The button was not added. The toolbar button and right-click menu still work.", "error");
  await chrome.runtime.sendMessage({ type: "launcherAdded" }).catch(() => {});
  $("actions").hidden = true;
  say("Done. The Eye drops button is now at the bottom right of each encounter in this Oscar.", "done");
  setTimeout(() => window.close(), 4000);
});
