// Where the clinician writes at this visit. Oscar's encounter has one note
// box. Oscar's ophthalmology Eye Form has several (Current Hx, Impression,
// Plan), and clinics customise it, so boxes are also found by their titles.

const KNOWN = [
  { sel: 'textarea[name="caseNote_note"]', label: "Today's note", role: "note" },
  { sel: "#planBox", label: "Plan", role: "plan" },
  { sel: "#impressionAreaBox", label: "Impression", role: "impression" },
  { sel: "#currentIssueAreaBox", label: "Current Hx", role: "history" },
];

// Boxes about the past, other people or other tasks. Drops written there are
// not this visit's plan.
const NOT_TODAY = /\b(?:past|previous|family|social|allerg|tickler|message|communication|research|log|reminder|specs?|measurement|billing|macro|search|consult|letter|referr)/i;

const usable = (t) => t && !t.disabled && !t.readOnly && t.offsetParent !== null && !t.closest("#edt-oscar-panel, #edt-oscar-launcher");

const clean = (s) => String(s || "").replace(/\s+/g, " ").trim();

// The title shown above a box: its label, or the first short text before it
// inside its own box. The search never climbs into a container that holds
// another writing box, so one box can never take another's title, or a
// number from elsewhere on the page.
function titleOf(t) {
  if (t.getAttribute("aria-label")) return clean(t.getAttribute("aria-label"));
  if (t.id) {
    const l = t.ownerDocument.querySelector(`label[for="${CSS.escape(t.id)}"]`);
    if (l) return clean(l.textContent);
  }
  let el = t;
  for (let up = 0; up < 4 && el.parentElement; up++) {
    el = el.parentElement;
    if ([...el.querySelectorAll("textarea, input[type=text], [contenteditable=true]")].some((x) => x !== t)) break;
    for (const h of el.querySelectorAll("*")) {
      if (h === t || h.contains(t) || t.contains(h)) continue;
      if (!(h.compareDocumentPosition(t) & Node.DOCUMENT_POSITION_FOLLOWING)) continue;
      const text = clean(h.textContent);
      if (text && text.length <= 40 && /[A-Za-z]{2}/.test(text) && ![...h.children].some((c) => clean(c.textContent) === text)) return text;
    }
  }
  return "";
}

const roleOf = (label) => (/\bplan\b/i.test(label) ? "plan" : /impression|assessment/i.test(label) ? "impression" : /\b(?:hx|history|concern|complaint)\b/i.test(label) ? "history" : "note");

// Today's boxes, plan first. Each is { el, label, role }.
export function todayBoxes(doc = document) {
  const seen = new Set();
  const out = [];
  for (const k of KNOWN)
    for (const el of doc.querySelectorAll(k.sel))
      if (usable(el) && !seen.has(el)) {
        seen.add(el);
        out.push({ el, label: k.label, role: k.role });
      }
  // An Eye Form or encounter whose boxes have other names.
  if (!out.some((b) => b.role === "note" || b.role === "plan" || b.role === "impression"))
    for (const el of doc.querySelectorAll("textarea")) {
      if (!usable(el) || seen.has(el) || el.clientHeight < 30) continue;
      const label = titleOf(el);
      if (!label || NOT_TODAY.test(label)) continue;
      seen.add(el);
      out.push({ el, label, role: roleOf(label) });
    }
  const order = { plan: 0, impression: 1, note: 2, history: 3 };
  return out.sort((a, b) => order[a.role] - order[b.role]);
}

// Oscar starts a note with a date line such as "[05-Nov-2026 .: ]", which is
// not part of the plan.
const body = (t) => t.value.replace(/^\s*\[[^\]\n]{0,60}\]\s*/, "").trim();

// What was written today, as one text. With several boxes, each keeps its
// title, so a heading such as "Plan:" still tells the reader what follows.
export function todayText(doc = document) {
  const boxes = todayBoxes(doc).filter((b) => body(b.el).length > 2);
  if (boxes.length === 1 && boxes[0].role === "note") return body(boxes[0].el).length > 10 ? body(boxes[0].el) : "";
  return boxes.map((b) => `${b.label}:\n${body(b.el)}`).join("\n\n");
}

// Where a plan from Eye Drop Tracker goes: the Plan box, else today's note.
export function planTarget(doc = document) {
  const boxes = todayBoxes(doc);
  return (boxes.find((b) => b.role === "plan") || boxes.find((b) => b.role === "note") || null)?.el || null;
}

export const isTodayBox = (el, doc = document) => !!el && todayBoxes(doc).some((b) => b.el === el);

// The chart's list of eye medications (the Eye Form's "Eye Meds" or "Eye
// drops" box), as plain lines.
export function eyeMedsList(doc = document) {
  const TITLE = /^(?:eye|ocular) ?(?:meds|medications?|drops)$|^eyedrops$/i;
  for (const h of doc.querySelectorAll("body *")) {
    if (h.children.length || h.closest("#edt-oscar-panel, #edt-oscar-launcher, script, style")) continue;
    const title = clean(h.textContent);
    if (!TITLE.test(title)) continue;
    // The list is in the title's own box, a level or two up.
    let box = h.parentElement;
    for (let up = 0; up < 3 && box; up++, box = box.parentElement) {
      if (box.querySelectorAll("textarea").length) break;
      const lines = (box.innerText || box.textContent || "")
        .split("\n")
        .map(clean)
        .filter((l) => l && l !== title && !/^[+x]$/i.test(l) && !/^none$/i.test(l));
      if (lines.length) return lines.join("\n");
    }
  }
  return "";
}
