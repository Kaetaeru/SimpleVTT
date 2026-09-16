/**
 * R20: the E2E gate. Runs every `scripts/capture-client-*.mjs` in turn against one Vite server and reports a table
 * of pass/fail, so `npm run gate:e2e` (and `npm run gate`) covers the browser paths the unit tests cannot.
 *
 *   npm run gate:e2e             every script
 *   npm run gate:e2e -- attack   only the ones whose name contains "attack"
 */
import { spawn, spawnSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { connect } from "node:net";
import path from "node:path";

const PORT = 1430;
const filter = process.argv.slice(2).filter((argument) => !argument.startsWith("-"));
const scripts = readdirSync("scripts").filter((name) => /^capture-client-.*\.mjs$/.test(name)).filter((name) => !filter.length || filter.some((needle) => name.includes(needle))).sort();
if (!scripts.length) { console.error("no capture scripts matched", filter.join(", ")); process.exit(1); }

const portOpen = (port) => new Promise((resolve) => { const socket = connect(port, "127.0.0.1"); socket.once("connect", () => { socket.end(); resolve(true); }); socket.once("error", () => resolve(false)); });
let server = null;
if (!(await portOpen(PORT))) {
  server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--config", "vite.client.config.ts", "--port", String(PORT), "--strictPort", "--host", "127.0.0.1"], { stdio: "ignore", detached: true });
  for (let at = 0; at < 100 && !(await portOpen(PORT)); at += 1) await new Promise((resolve) => setTimeout(resolve, 300));
  if (!(await portOpen(PORT))) { console.error(`vite did not come up on ${PORT}`); process.exit(1); }
}

// R54: the first script used to pay Vite's cold-start compile out of its own timeout, which made whichever script
// ran second (capture-client-attack.mjs, alphabetically) fail perhaps one run in two. Ask for the page once and wait
// for it to be served before anything is measured.
async function warm() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`http://127.0.0.1:${PORT}/`);
      if (response.ok) { await response.text(); return; }
    } catch { /* not up yet */ }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
}
await warm();

const failed = [];
const started = Date.now();
try {
  for (const name of scripts) {
    const at = Date.now();
    process.stdout.write(`${name.padEnd(34)} `);
    const run = spawnSync(process.execPath, [path.join("scripts", name)], { encoding: "utf8" });
    const output = `${run.stdout ?? ""}${run.stderr ?? ""}`;
    const ok = run.status === 0 && /^done\b/m.test(output);
    console.log(`${ok ? "OK" : "FAIL"}  ${Math.round((Date.now() - at) / 1000)}s`);
    if (!ok) {
      failed.push(name);
      for (const line of output.split("\n").filter((line) => /^(FAIL|Error|.*Error:)/.test(line)).slice(0, 6)) console.log(`    ${line}`);
    }
  }
// Windows: Vite binds `localhost` to ::1 only (hence `--host` above), and there are no process groups to signal.
} finally { if (server) { try { if (process.platform === "win32") server.kill(); else process.kill(-server.pid, "SIGTERM"); } catch { /* already gone */ } } }

console.log(`${scripts.length - failed.length}/${scripts.length} passed in ${Math.round((Date.now() - started) / 1000)}s`);
if (failed.length) { console.error(`failed: ${failed.join(", ")}`); process.exit(1); }
