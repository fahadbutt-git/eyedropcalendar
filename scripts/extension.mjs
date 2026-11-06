// Builds the Oscar extension into oscar/extension/dist, ready for Chrome's
// "Load unpacked", and zips it for the Chrome Web Store.
//
//   npm run ext:build
//   npm run ext:build -- --dev     also runs on localhost:4173 and :5173
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

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

await build({
  entryPoints: { background: join(ext, "src/background.js"), panel: join(ext, "src/panel.js"), bridge: join(ext, "src/bridge.js") },
  outdir: out,
  bundle: true,
  format: "iife",
  target: "chrome116",
  loader: { ".css": "text" },
  legalComments: "none",
  minify: !dev,
});

const manifest = JSON.parse(readFileSync(join(ext, "manifest.json"), "utf8"));
manifest.version = JSON.parse(readFileSync(join(root, "package.json"), "utf8")).extensionVersion || manifest.version;
// The service worker is bundled, so it is a classic script.
delete manifest.background.type;
if (dev) {
  manifest.name += " (development)";
  manifest.content_scripts[0].matches.push("http://localhost:4173/*", "http://localhost:5173/*");
  // The stand-in Oscar, so tests can open the panel without a toolbar click.
  manifest.host_permissions = ["http://localhost:8080/*", "http://localhost:4173/*"];
}
writeFileSync(join(out, "manifest.json"), JSON.stringify(manifest, null, 2));
cpSync(join(ext, "icons"), join(out, "icons"), { recursive: true });

if (!dev) {
  const zip = join(ext, `eye-drop-tracker-oscar-${manifest.version}.zip`);
  rmSync(zip, { force: true });
  execSync(`cd "${out}" && zip -qr "${zip}" .`);
  console.log(`Built ${out} and ${zip}`);
} else console.log(`Built ${out} (development)`);
