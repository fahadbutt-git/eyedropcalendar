// Writes public/licenses.txt: the licence of every package that ships with
// the site and the app (production dependencies and what they pull in),
// including the typefaces. Runs before every build so it stays current.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const dirs = execSync("npm ls --omit=dev --all --parseable", { cwd: root, encoding: "utf8" })
  .split("\n")
  .filter((d) => d.includes("node_modules"));
const seen = new Set();
const parts = [];
for (const dir of dirs.sort()) {
  const pkg = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
  const id = `${pkg.name}@${pkg.version}`;
  if (seen.has(id)) continue;
  seen.add(id);
  const file = readdirSync(dir).find((f) => /^(licen[cs]e|copying)(\.|$)/i.test(f));
  const text = file && existsSync(join(dir, file)) ? readFileSync(join(dir, file), "utf8").trim() : `Licence: ${pkg.license || "see package"}`;
  parts.push(`${id} (${pkg.license || "unknown"})\n${pkg.homepage || ""}\n\n${text}`);
}
const head = `Eye Drop Tracker
Copyright 2026 Yusuf Ahmed and Fahad Butt. Licensed under the Apache License 2.0.
Source: https://github.com/fahadbutt-git/eyedropcalendar

Eye Drop Tracker includes the following open source software and typefaces.
`;
writeFileSync(join(root, "public/licenses.txt"), `${head}\n${"=".repeat(72)}\n\n${parts.join(`\n\n${"=".repeat(72)}\n\n`)}\n`);
console.log(`licenses.txt: ${parts.length} packages`);
