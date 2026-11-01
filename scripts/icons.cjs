// Renders every app icon and splash image from public/icon.svg, so the logo
// is drawn once and every size stays the same. Edit the SVG, then run
// `npm run app:icons`. Needs Playwright: npx playwright install chromium.
const { chromium } = require("playwright");
const fs = require("fs"), path = require("path"), { execSync } = require("child_process");
const root = path.join(__dirname, "..");
const full = fs.readFileSync(root + "/public/icon.svg", "utf8");
const art = full.replace(/<rect width="512" height="512" fill="#1f3a5f"\/>/, "");
const sized = (svg, n) => svg.replace("<svg ", `<svg width="${n}" height="${n}" `);
// Width and height from the PNG header, so each file keeps its size.
const sizeOf = (f) => {
  const head = fs.readFileSync(f).subarray(16, 24);
  return [head.readUInt32BE(0), head.readUInt32BE(4)];
};
const only = process.argv[2];
(async () => {
  const b = await chromium.launch();
  const shot = async (file, w, h, html, transparent = false) => {
    const p = await b.newPage({ viewport: { width: w, height: h } });
    await p.setContent(`<html><body style="margin:0;width:${w}px;height:${h}px;display:grid;place-items:center;background:${transparent ? "transparent" : "#1f3a5f"}">${html}</body></html>`);
    await p.screenshot({ path: file, omitBackground: transparent });
    await p.close();
  };
  if (only === "preview") {
    await shot(process.argv[3], 512, 512, sized(full, 512));
    await b.close();
    return;
  }
  const res = root + "/android/app/src/main/res";
  const square = [...["180", "192", "512"].map((n) => root + `/public/icon-${n}.png`), root + "/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png"];
  for (const d of fs.readdirSync(res).filter((d) => d.startsWith("mipmap-") && !d.includes("anydpi"))) square.push(path.join(res, d, "ic_launcher.png"));
  for (const f of square) { const [n] = sizeOf(f); await shot(f, n, n, sized(full, n)); }
  for (const d of fs.readdirSync(res).filter((d) => d.startsWith("mipmap-") && !d.includes("anydpi"))) {
    const r = path.join(res, d, "ic_launcher_round.png"); const [n] = sizeOf(r);
    await shot(r, n, n, `<div style="width:${n}px;height:${n}px;border-radius:50%;overflow:hidden">${sized(full, n)}</div>`, true);
    const fg = path.join(res, d, "ic_launcher_foreground.png"); const [m] = sizeOf(fg);
    await shot(fg, m, m, sized(art, Math.round(m * 0.62)), true);
  }
  const splash = [];
  for (const d of fs.readdirSync(res).filter((d) => d.startsWith("drawable"))) { const f = path.join(res, d, "splash.png"); if (fs.existsSync(f)) splash.push(f); }
  const ios = root + "/ios/App/App/Assets.xcassets/Splash.imageset";
  for (const f of fs.readdirSync(ios).filter((f) => f.endsWith(".png"))) splash.push(path.join(ios, f));
  for (const f of splash) { const [w, h] = sizeOf(f); await shot(f, w, h, sized(art, Math.round(Math.min(w, h) * (w === h ? 0.16 : 0.3)))); }
  // The App Store refuses an icon with an alpha channel. Needs Python Pillow.
  execSync(`python3 -c "from PIL import Image;f='${square[3]}';Image.open(f).convert('RGB').save(f)"`);
  await b.close();
  console.log("done", square.length, splash.length);
})();
