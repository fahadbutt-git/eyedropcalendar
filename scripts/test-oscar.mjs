// Runs every browser suite of the Oscar extension against the stand-in Oscar
// and the built site, then stops what it started.
//
//   npm run test:oscar                 build, then all suites
//   npm run test:oscar -- edge eyeform only these suites
//
// A stand-in or site already running on its port is used as it is.
import { spawn, execFileSync } from "node:child_process";
import { setTimeout as sleep } from "node:timers/promises";

const SUITES = ["e2e", "security", "resilience", "edge", "eyeform", "lock"];
const chosen = process.argv.slice(2).filter((a) => SUITES.includes(a));
const run = chosen.length ? chosen : SUITES;
const node = (args, env = {}) => execFileSync(process.execPath, args, { stdio: "inherit", env: { ...process.env, ...env } });

const up = (url) =>
  fetch(url)
    .then(() => true)
    .catch(() => false);
const started = [];
async function serve(url, command, args) {
  if (await up(url)) return;
  const child = spawn(command, args, { stdio: "ignore" });
  started.push(child);
  for (let i = 0; i < 60 && !(await up(url)); i++) await sleep(250);
  if (!(await up(url))) throw new Error(`${command} ${args.join(" ")} did not start`);
}

const failed = [];
try {
  execFileSync("npm", ["run", "build", "--silent"], { stdio: "inherit" });
  node(["scripts/extension.mjs", "--dev"]);
  await serve("http://localhost:8080/oscar/index.jsp", process.execPath, ["oscar/standin/server.mjs"]);
  await serve("http://localhost:4173/", process.execPath, ["node_modules/vite/bin/vite.js", "preview", "--port", "4173", "--strictPort"]);
  for (const suite of run) {
    console.log(`\n── ${suite} ${"─".repeat(60 - suite.length)}`);
    try {
      // The lock suite needs a copy of the extension locked to another clinic.
      if (suite === "lock") node(["scripts/extension.mjs", "--dev", "--oscar=https://other-clinic.example.com"], { EDT_LOCK_TEST: "1" });
      node([`oscar/tests/${suite}.mjs`]);
    } catch {
      failed.push(suite);
    } finally {
      if (suite === "lock") node(["scripts/extension.mjs", "--dev"]);
    }
  }
} finally {
  for (const child of started) child.kill();
}
console.log(failed.length ? `\nFailed: ${failed.join(", ")}` : `\nAll ${run.length} browser suites passed.`);
process.exit(failed.length ? 1 : 0);
