// Builds the Oscar extension into oscar/extension/dist, ready for Chrome's
// "Load unpacked", and zips it for the Chrome Web Store.
//
//   npm run ext:build
//   npm run ext:build -- --dev     also runs on localhost:4173 and :5173
//   npm run ext:build -- --oscar=https://clinic.example.com
//                                   lets the Eye drops button be allowed on
//                                   that Oscar address, and nowhere else
//
// Without --oscar the extension cannot ask for access to any site, and the
// panel opens only from the toolbar, the right-click menu or the shortcut.
//
// The panel shares the note reader, drug list and wording with the website,
// so a change in src/ reaches both.
import { build } from "esbuild";
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const ext = join(root, "oscar/extension");
const out = join(ext, "dist");
const dev = process.argv.includes("--dev");
// The Oscar addresses the button may be allowed on, fixed in the build.
const oscars = process.argv
  .filter((a) => a.startsWith("--oscar="))
  .flatMap((a) => a.slice(8).split(","))
  .map((o) => new URL(o.trim()).origin);
if (dev) oscars.push("http://localhost:8080");

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { background: join(ext, "src/background.js"), panel: join(ext, "src/panel.js"), bridge: join(ext, "src/bridge.js"), launcher: join(ext, "src/launcher.js"), setup: join(ext, "src/setup.js") },
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome116",
  loader: { ".css": "text" },
  legalComments: "none",
  minify: !dev,
  // Where Eye Drop Tracker lives. Fixed in the build, never a setting.
  define: { __EDT_SITE__: JSON.stringify(dev ? "http://localhost:4173/" : "https://eyedroptracker.com/"), __EDT_OSCARS__: JSON.stringify(oscars) },
});

const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
manifest.version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).extensionVersion || manifest.version;
// The service worker is bundled, so it is a classic script.
delete manifest.background.type;
if (oscars.length) manifest.optional_host_permissions = oscars.map((o) => `${o}/*`);
if (dev) {
  manifest.name += " (development)";
  manifest.content_scripts[0].matches.push("http://localhost:4173/*", "http://localhost:5173/*");
  // The stand-in Oscar, so tests can open the panel without a toolbar click.
  manifest.host_permissions = ["http://localhost:8080/*", "http://localhost:4173/*"];
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
cpSync(join(ext, "icons"), join(out, "icons"), { recursive: true });
cpSync(join(ext, "setup.html"), join(out, "setup.html"));

if (!dev) {
  const tag = oscars.length ? `-${new URL(oscars[0]).hostname.split(".")[0]}` : "";
  const zip = join(ext, `eye-drop-tracker-oscar-${manifest.version}${tag}.zip`);
  rmSync(zip, { force: true });
  execSync(`cd "${out}" && zip -qrX "${zip}" .`);
  // Fingerprints, so a clinic can check the package is the one we published.
  const sums = execSync(`cd "${out}" && find . -type f | sort | xargs shasum -a 256 && cd "${ext}" && shasum -a 256 "$(basename "${zip}")"`).toString();
  writeFileSync(`${zip}.sha256.txt`, sums);
  console.log(`Built ${out} and ${zip}${oscars.length ? ` for ${oscars.join(", ")}` : " (no Eye drops button)"}`);
} else console.log(`Built ${out} (development)`);
