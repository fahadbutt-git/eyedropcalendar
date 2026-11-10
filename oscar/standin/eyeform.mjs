// Oscar's ophthalmology Eye Form (oscar/eyeform/eyeform.jsp), in two layouts:
//
//   "oscar": the boxes and ids of the open-source Eye Form, where today's
//   Current Hx, Impression and Plan are textareas with fixed ids.
//   "kai": a clinic's customised Eye Form (as seen at Milton Eye on
//   10 November 2026), where the same boxes have no ids, only titles, and
//   other boxes such as Office Communication are textareas too.
//
// Both open in a pop-up window from the schedule, like the real one.
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

const CSS = `body{font:12px Arial,sans-serif;margin:0;background:#fff}
.hdr{background:#dfe6f2;padding:6px 10px;border-bottom:1px solid #9aa8c0;font-size:13px}
.wrap{display:flex;gap:8px;padding:8px}.col{flex:1;display:flex;flex-direction:column;gap:8px;min-width:0}
.smallBox,.wideBox,.halfBox{border:1px solid #9aa8c0;background:#fff}
.title,.boxTitle{background:#6d7c95;color:#fff;font-weight:bold;padding:3px 6px;font-size:11px}
.content{padding:4px 6px;min-height:30px}.content li{margin:2px 0}
textarea{width:98%;height:90px;margin:4px;font:12px Arial,sans-serif}
.btns{padding:8px;display:flex;gap:8px;justify-content:flex-end}.btns div{border:1px solid #888;padding:4px 10px;cursor:pointer;background:#eee}`;

const list = (items) => `<ul>${items.map((i) => `<li>${esc(i)}</li>`).join("")}</ul>`;

export function eyeformPage(p, variant, signedHistory) {
  const f = p.eyeform || {};
  const history = signedHistory.map((h) => `<div class="item"><strong>${esc(h.date.slice(0, 10))}</strong> ${esc(h.text)}</div>`).join("");
  const sign = `<script>document.getElementById("sign").onclick=async()=>{
    const boxes=[...document.querySelectorAll("textarea")].filter(t=>t.dataset.part);
    const body={demographicNo:${p.id}};boxes.forEach(t=>body[t.dataset.part]=t.value);
    await fetch("/oscar/__standin/eyeformsign",{method:"POST",body:JSON.stringify(body)});
    document.getElementById("saveMsg").textContent="Saved";boxes.forEach(t=>t.readOnly=true);};</script>`;
  const head = `<!doctype html><html><head><meta charset="utf-8"><title>${esc(p.lastName)}, ${esc(p.firstName)} - Eyeform</title><style>${CSS}</style></head><body>`;
  const hdr = `<div class="hdr"><b>${esc(p.lastName)}, ${esc(p.firstName)}</b> (${p.sex}) (DOB: ${p.dob}) &nbsp; MRP Demo, Doctor</div>`;
  if (variant === "kai")
    return `${head.replace(".title,.boxTitle{", ".title,.bt{")}${hdr}<div class="wrap"><div class="col">
      <div class="smallBox"><div class="bt">Current Hx</div><textarea data-part="current">${esc(f.current || "")}</textarea></div>
      <div class="smallBox"><div class="bt">Past Eye History</div><div class="content">${list(f.pastEye || [])}</div></div>
      <div class="smallBox"><div class="bt">Eye Meds</div><div class="content">${list(f.meds || [])}</div></div>
      <div class="smallBox"><div class="bt">Other Meds</div><div class="content">${list(f.otherMeds || [])}</div></div>
    </div><div class="col">
      <div class="smallBox"><div class="bt">Office Communication</div><textarea>${esc(f.office || "")}</textarea></div>
      <div class="smallBox"><div class="bt">Research/Notes</div><textarea>${esc(f.research || "")}</textarea></div>
      <div class="halfBox"><div class="bt">Measurements</div><div class="content">IOP OD <b>27</b> OS <b>26</b></div></div>
      <div class="halfBox"><div class="bt">Impression History</div><div class="content">${history}</div></div>
      <div class="wideBox"><div class="bt">Impression</div><textarea data-part="impression">${esc(f.impression || "")}</textarea></div>
      <div class="halfBox"><div class="bt">Plan</div><textarea data-part="plan">${esc(f.plan || "")}</textarea></div>
    </div></div><div class="btns"><span id="saveMsg"></span><div id="sign">Sign, Save &amp; Exit</div></div>${sign}</body></html>`;
  return `${head}${hdr}<div class="wrap"><div class="col">
    <div class="smallBox boxTitleLink" id="eyedrops"><div class="title">Eye drops</div><div class="content">${list(f.meds || [])}</div></div>
    <div class="smallBox boxTitleLink" id="planHistory"><div class="title">Previous Plans</div><div class="content">${list(f.previousPlans || [])}</div></div>
    <div class="smallBox boxTitleLink" id="ocularHistory"><div class="title">Past Ocular History</div><div class="content">${list(f.pastEye || [])}</div></div>
  </div><div class="col">
    <div class="wideBox" id="currentIssueBox"><div class="title">Current Hx</div><textarea id="currentIssueAreaBox" data-part="current">${esc(f.current || "")}</textarea></div>
    <div class="halfBox tallHalfBox" id="impressionHistory"><div class="title">Impression History</div><div class="content">${history}</div></div>
    <div class="wideBox" id="impressionBox"><div class="title">Impression</div><textarea id="impressionAreaBox" data-part="impression">${esc(f.impression || "")}</textarea></div>
    <div class="halfBox" id="planHalfBox"><div class="title">Plan</div><textarea id="planBox" data-part="plan">${esc(f.plan || "")}</textarea></div>
  </div></div><div class="btns"><span id="saveMsg"></span><div id="saveSignExitBtn"><span id="sign">Sign, Save &amp; Exit</span></div></div>${sign}</body></html>`;
}
