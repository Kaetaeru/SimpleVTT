import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import process from "node:process";

const BRANCH = process.env.SIMPLEVTT_LIVE_BRANCH || "work/v1-composite";
const REMOTE = process.env.SIMPLEVTT_LIVE_REMOTE || "origin";
const POLL_MS = Math.max(3000, Number(process.env.SIMPLEVTT_LIVE_POLL_MS || 7000));
const ROOT = process.cwd();
const STATE_DIR = path.join(ROOT, ".live-dev");
const STATUS_FILE = path.join(STATE_DIR, "status.json");
const gitEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0" };

let appProcess = null;
let stopping = false;
let syncInProgress = false;
let lastStateKey = "";

function stamp() {
  return new Date().toLocaleTimeString("en-GB", { hour12: false });
}

function log(message) {
  console.log(`${stamp()}  ${message}`);
}

function fail(message) {
  console.error(`\n[SimpleVTT Live] ${message}\n`);
  process.exit(1);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
    env: options.env || process.env,
    stdio: options.inherit ? "inherit" : "pipe",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    const details = (result.stderr || result.stdout || "").trim();
    throw new Error(details || `${command} ${args.join(" ")} exited with ${result.status}`);
  }
  return {
    status: result.status ?? 1,
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
  };
}

function npmInvocation(args) {
  if (process.platform === "win32") {
    return {
      command: process.env.ComSpec || "cmd.exe",
      args: ["/d", "/s", "/c", ["npm", ...args].join(" ")],
    };
  }
  return { command: "npm", args };
}

function runNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return run(invocation.command, invocation.args, options);
}

function spawnNpm(args, options = {}) {
  const invocation = npmInvocation(args);
  return spawn(invocation.command, invocation.args, options);
}

function git(args, options = {}) {
  return run("git", args, { ...options, env: gitEnv });
}

function writeStatus(state) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(
    STATUS_FILE,
    `${JSON.stringify({ updatedAt: new Date().toISOString(), branch: BRANCH, ...state }, null, 2)}\n`,
    "utf8",
  );
}

function publishState(kind, detail, extra = {}) {
  const key = JSON.stringify([kind, detail, extra.localSha, extra.remoteSha]);
  if (key !== lastStateKey) {
    log(`[SYNC] ${detail}`);
    lastStateKey = key;
  }
  writeStatus({ kind, detail, ...extra });
}

function verifyWorkspace() {
  const inside = git(["rev-parse", "--is-inside-work-tree"]).stdout;
  if (inside !== "true") fail("Run this launcher from the SimpleVTT Git worktree.");

  const branch = git(["branch", "--show-current"]).stdout;
  if (branch !== BRANCH) {
    fail(`Wrong branch. Expected '${BRANCH}', but this worktree is on '${branch || "detached HEAD"}'.`);
  }

  const remoteUrl = git(["remote", "get-url", REMOTE], { allowFailure: true });
  if (remoteUrl.status !== 0 || !remoteUrl.stdout) fail(`Git remote '${REMOTE}' is not configured.`);

  return remoteUrl.stdout;
}

function hasDependencies() {
  const viteBin = process.platform === "win32" ? "vite.cmd" : "vite";
  const tauriBin = process.platform === "win32" ? "tauri.cmd" : "tauri";
  return existsSync(path.join(ROOT, "node_modules", ".bin", viteBin))
    && existsSync(path.join(ROOT, "node_modules", ".bin", tauriBin));
}

function installDependencies() {
  if (hasDependencies()) return;
  log("[SETUP] node_modules is missing or incomplete. Running npm ci...");
  runNpm(["ci"], { inherit: true });
  log("[SETUP] Dependencies are ready.");
}

function startApp() {
  if (appProcess || stopping) return;
  log("[APP] Starting Tauri + Vite development mode...");
  appProcess = spawnNpm(["run", "tauri:dev"], {
    cwd: ROOT,
    env: process.env,
    stdio: "inherit",
    windowsHide: false,
  });
  appProcess.on("exit", (code, signal) => {
    const expected = stopping || appProcess?.__restarting;
    appProcess = null;
    if (!expected) {
      log(`[APP] Development process exited (${signal || (code ?? "unknown")}). Git sync remains active.`);
      publishState("app-stopped", "App process stopped; remote sync is still active.");
    }
  });
}

async function stopApp(reason) {
  if (!appProcess) return;
  const child = appProcess;
  child.__restarting = !stopping;
  log(`[APP] Stopping development process (${reason})...`);
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
  } else {
    child.kill("SIGTERM");
  }
  const deadline = Date.now() + 5000;
  while (appProcess && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  appProcess = null;
}

function changedFilesBetween(localSha, remoteSha) {
  const output = git(["diff", "--name-only", `${localSha}..${remoteSha}`]).stdout;
  return output ? output.split(/\r?\n/).filter(Boolean) : [];
}

function needsContentGeneration(files) {
  return files.some((file) =>
    file.startsWith("content/")
      || file.startsWith("rules/")
      || /^scripts\/generate-.*\.mjs$/i.test(file),
  );
}

function needsDependencyRefresh(files) {
  return files.includes("package.json") || files.includes("package-lock.json");
}

function needsAppRestart(files) {
  return needsDependencyRefresh(files)
    || files.includes("vite.config.ts")
    || files.includes("vite.config.js")
    || files.includes("src-tauri/tauri.conf.json")
    || files.some((file) => file.startsWith("src-tauri/src/"));
}

async function afterFastForward(files) {
  if (needsDependencyRefresh(files)) {
    await stopApp("dependencies changed");
    log("[SETUP] package files changed. Running npm ci...");
    runNpm(["ci"], { inherit: true });
    log("[SETUP] Dependencies refreshed.");
    startApp();
    return;
  }

  if (needsContentGeneration(files)) {
    log("[GEN] Content/rules changed. Regenerating generated content...");
    runNpm(["run", "generate:content"], { inherit: true });
    log("[GEN] Generated content refreshed; Vite will apply the local file changes.");
  }

  if (needsAppRestart(files)) {
    await stopApp("runtime configuration changed");
    startApp();
  }
}

async function syncOnce() {
  if (stopping || syncInProgress) return;
  syncInProgress = true;
  try {
    const branch = git(["branch", "--show-current"]).stdout;
    if (branch !== BRANCH) {
      publishState("blocked", `Branch changed to '${branch || "detached HEAD"}'. Expected '${BRANCH}'.`);
      return;
    }

    const dirty = git(["status", "--porcelain", "--untracked-files=normal"]).stdout;
    if (dirty) {
      publishState("paused", "Local changes detected. Automatic Git sync is paused to protect your work.");
      return;
    }

    const remoteRef = `refs/remotes/${REMOTE}/${BRANCH}`;
    const fetchRefspec = `+refs/heads/${BRANCH}:${remoteRef}`;
    const fetchResult = git(["fetch", "--quiet", REMOTE, fetchRefspec], { allowFailure: true });
    if (fetchResult.status !== 0) {
      publishState("offline", `Fetch failed: ${fetchResult.stderr || fetchResult.stdout || "unknown Git error"}`);
      return;
    }

    const localSha = git(["rev-parse", "HEAD"]).stdout;
    const remoteShaResult = git(["rev-parse", "--verify", `${REMOTE}/${BRANCH}`], { allowFailure: true });
    if (remoteShaResult.status !== 0 || !remoteShaResult.stdout) {
      publishState("blocked", `Remote tracking ref '${REMOTE}/${BRANCH}' is unavailable.`, { localSha });
      return;
    }
    const remoteSha = remoteShaResult.stdout;

    if (localSha === remoteSha) {
      publishState("watching", `Up to date at ${localSha.slice(0, 7)}. Watching ${REMOTE}/${BRANCH}.`, { localSha, remoteSha });
      return;
    }

    const mergeBase = git(["merge-base", localSha, remoteSha], { allowFailure: true });
    if (mergeBase.status !== 0 || mergeBase.stdout !== localSha) {
      publishState("blocked", "Local and remote history diverged. No automatic merge/reset was attempted.", { localSha, remoteSha });
      return;
    }

    const files = changedFilesBetween(localSha, remoteSha);
    const remoteMessage = git(["log", "-1", "--pretty=%s", remoteSha]).stdout;
    log(`[SYNC] New remote commit ${remoteSha.slice(0, 7)}: ${remoteMessage}`);

    const merge = git(["merge", "--ff-only", `${REMOTE}/${BRANCH}`], { allowFailure: true });
    if (merge.status !== 0) {
      publishState("blocked", `Fast-forward failed: ${merge.stderr || merge.stdout || "unknown Git error"}`, { localSha, remoteSha });
      return;
    }

    log(`[SYNC] Fast-forwarded ${localSha.slice(0, 7)} -> ${remoteSha.slice(0, 7)} (${files.length} file${files.length === 1 ? "" : "s"}).`);
    await afterFastForward(files);
    publishState("updated", `Updated to ${remoteSha.slice(0, 7)}: ${remoteMessage}`, { localSha: remoteSha, remoteSha, changedFiles: files });
  } catch (error) {
    publishState("error", error instanceof Error ? error.message : String(error));
  } finally {
    syncInProgress = false;
  }
}

async function shutdown(signal) {
  if (stopping) return;
  stopping = true;
  log(`[LIVE] ${signal} received. Shutting down...`);
  writeStatus({ kind: "stopping", detail: `Stopping after ${signal}.` });
  await stopApp("launcher shutdown");
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));

console.log("=======================================");
console.log(" SimpleVTT Live Development");
console.log("=======================================\n");

const remoteUrl = verifyWorkspace();
installDependencies();
const startSha = git(["rev-parse", "--short", "HEAD"]).stdout;
log(`[LIVE] Branch : ${BRANCH}`);
log(`[LIVE] Local  : ${startSha}`);
log(`[LIVE] Remote : ${remoteUrl}`);
log(`[LIVE] Poll   : ${POLL_MS} ms`);
log("[LIVE] Local edits pause auto-sync; only fast-forward updates are allowed.");
startApp();
await syncOnce();

while (!stopping) {
  await new Promise((resolve) => setTimeout(resolve, POLL_MS));
  await syncOnce();
}
