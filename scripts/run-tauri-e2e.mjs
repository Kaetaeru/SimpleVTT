import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { remote } from "webdriverio";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(scriptDirectory, "..");
const binary = path.join(root, ".live-dev", "tauri-e2e-target", "debug", "simplevtt.exe");
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runRoot = path.join(root, ".live-dev", "tauri-e2e", runId);
const artifactRoot = path.join(runRoot, "artifacts");
const smokeOnly = process.argv.includes("--smoke");
const keepOpen = process.argv.includes("--keep-open");

const children = [];
const browsers = [];
let viteStarted = false;

function log(message) {
  process.stdout.write(`[TAURI E2E] ${message}\n`);
}

async function reservePort() {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.unref();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = typeof address === "object" && address ? address.port : 0;
      server.close((error) => error ? reject(error) : resolve(port));
    });
  });
}

async function canConnect(port, host = "127.0.0.1") {
  return new Promise((resolve) => {
    const socket = new Socket();
    const finish = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(250);
    socket.once("connect", () => finish(true));
    socket.once("timeout", () => finish(false));
    socket.once("error", () => finish(false));
    socket.connect(port, host);
  });
}

async function waitForPort(port, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not listen on 127.0.0.1:${port} within ${timeoutMs} ms`);
}

function spawnTracked(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: false,
    ...options,
  });
  children.push(child);
  child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
  child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  return child;
}

async function ensureVite() {
  if (await canConnect(1420)) {
    log("기존 Vite 서버(localhost:1420)를 사용합니다.");
    return;
  }
  assert.ok(existsSync(viteEntry), `Vite entry was not found: ${viteEntry}`);
  viteStarted = true;
  spawnTracked(process.execPath, [viteEntry, "--host", "0.0.0.0", "--port", "1420", "--strictPort"]);
  await waitForPort(1420, "Vite", 45_000);
  const response = await fetch("http://127.0.0.1:1420/");
  assert.equal(response.ok, true, `Vite warm-up failed with HTTP ${response.status}`);
  await response.text();
  log("격리된 Vite 서버를 시작했습니다.");
}

async function launchInstance(label, dataRoot, webdriverPort) {
  await mkdir(dataRoot, { recursive: true });
  const child = spawnTracked(binary, [
    `--simplevtt-data-root=${dataRoot}`,
    `--simplevtt-instance-label=${label}`,
  ], {
    env: {
      ...process.env,
      SIMPLEVTT_LOCAL_DATA_ROOT: dataRoot,
      SIMPLEVTT_INSTANCE_LABEL: label,
      TAURI_WEBDRIVER_PORT: String(webdriverPort),
    },
  });
  await waitForPort(webdriverPort, `${label} WebDriver`, 30_000);
  const browser = await remote({
    hostname: "127.0.0.1",
    port: webdriverPort,
    logLevel: "error",
    capabilities: {},
  });
  browsers.push(browser);
  log(`${label} WebDriver 세션이 생성되었습니다.`);
  await browser.setTimeout({ implicit: 0, pageLoad: 30_000, script: 60_000 });
  log(`${label} title: ${await browser.getTitle()}`);
  await browser.waitUntil(async () => (await browser.$("body").getText()).includes("SimpleVTT"), {
    timeout: 30_000,
    timeoutMsg: `${label} UI did not finish loading`,
  });
  const instance = { label, child, browser, dataRoot, webdriverPort };
  await completeFirstRun(instance);
  return instance;
}

function exactButton(text) {
  return `//button[normalize-space(.)=${JSON.stringify(text)}]`;
}

function navButton(text) {
  return `//nav[@aria-label='주요 메뉴']//button[.//span[normalize-space(.)=${JSON.stringify(text)}]]`;
}

function labelControl(label, tag = "input", within = "") {
  const scope = within ? `${within}//` : "//";
  return `${scope}label[.//*[self::span or self::legend][normalize-space(.)=${JSON.stringify(label)}]]//${tag}`;
}

async function click(browser, selector, description = selector) {
  const element = await browser.$(selector);
  await element.waitForDisplayed({ timeout: 15_000, timeoutMsg: `${description} is not visible` });
  await element.waitForEnabled({ timeout: 15_000, timeoutMsg: `${description} is disabled` });
  await element.click();
}

async function replaceValue(browser, selector, value, description = selector) {
  const element = await browser.$(selector);
  await element.waitForDisplayed({ timeout: 15_000, timeoutMsg: `${description} is not visible` });
  await element.click();
  await element.setValue(value);
  assert.equal(await element.getValue(), String(value), `${description} did not accept input`);
}

async function waitForText(browser, text, timeout = 20_000) {
  await browser.waitUntil(async () => (await browser.$("body").getText()).includes(text), {
    timeout,
    timeoutMsg: `UI text did not appear: ${text}`,
  });
}

async function completeFirstRun(instance) {
  const finish = await instance.browser.$(exactButton("선택 저장 · Home으로"));
  if (!await finish.isExisting()) return;
  const optimized = await instance.browser.$("//button[.//strong[normalize-space(.)='SimpleVTT 최적화']]");
  await optimized.click();
  await finish.waitForEnabled({ timeout: 10_000 });
  await finish.click();
  await waitForText(instance.browser, "TABLETOP, YOUR WAY");
  log(`${instance.label} 첫 실행 안내를 UI로 완료했습니다.`);
}

async function saveEvidence(instance, suffix) {
  const screenshot = await instance.browser.takeScreenshot();
  await writeFile(path.join(artifactRoot, `${instance.label.replace(/\s+/g, "-").toLowerCase()}-${suffix}.png`), screenshot, "base64");
  const bodyText = await instance.browser.$("body").getText();
  await writeFile(path.join(artifactRoot, `${instance.label.replace(/\s+/g, "-").toLowerCase()}-${suffix}.txt`), bodyText, "utf8");
}

async function createHostCampaign(host) {
  await click(host.browser, navButton("캠페인"), "캠페인 메뉴");
  const body = await host.browser.$("body").getText();
  if (body.includes("아직 캠페인이 없습니다.")) {
    await click(host.browser, exactButton("새 캠페인 만들기"), "새 캠페인 만들기");
  } else {
    await click(host.browser, exactButton("새 캠페인"), "새 캠페인");
  }
  await replaceValue(host.browser, labelControl("캠페인 이름"), "Tauri 자동 검증 캠페인", "캠페인 이름");
  await click(host.browser, exactButton("캠페인 만들기"), "캠페인 만들기 제출");
  await waitForText(host.browser, "Tauri 자동 검증 캠페인");
}

async function openHostSession(host, sessionPort) {
  await click(host.browser, navButton("세션"), "세션 메뉴");
  const direct = "//*[@aria-label='직접 네트워크 세션 시작']";
  await replaceValue(host.browser, `${direct}//label[.//span[normalize-space(.)='Bind / Listen IP']]//input`, "127.0.0.1", "Host bind 주소");
  const portInputs = await host.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);
  assert.ok(portInputs.length >= 1, "Host port input was not found");
  await portInputs[0].setValue(String(sessionPort));
  const openButtons = await host.browser.$$(`${direct}//button[normalize-space(.)='세션 열기']`);
  assert.equal(openButtons.length, 1, "Direct Host open button should be unique");
  await openButtons[0].click();
  await waitForText(host.browser, "호스트 · DM", 30_000);
}

async function joinClientSession(client, sessionPort) {
  await click(client.browser, navButton("세션"), "세션 메뉴");
  const direct = "//*[@aria-label='직접 네트워크 세션 시작']";
  await replaceValue(client.browser, `${direct}//label[.//span[normalize-space(.)='Host IP / 주소']]//input`, "127.0.0.1", "Client Host 주소");
  const portInputs = await client.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);
  assert.ok(portInputs.length >= 2, "Client port input was not found");
  await portInputs[1].setValue(String(sessionPort));
  const joinButtons = await client.browser.$$(`${direct}//button[normalize-space(.)='참가하기']`);
  assert.equal(joinButtons.length, 1, "Direct Client join button should be unique");
  await joinButtons[0].click();
  await waitForText(client.browser, "클라이언트 · 플레이어", 30_000);
}

async function grantGpFromHost(host, amount) {
  await click(host.browser, exactButton("아이템"), "DM 아이템 도구");
  const panel = "//aside[@aria-label='DM 아이템과 재화 지급 및 회수']";
  await replaceValue(host.browser, `${panel}//label[.//span[normalize-space(.)='변경할 GP']]//input`, amount, "DM GP 변경량");
  await click(host.browser, `${panel}//button[normalize-space(.)='지급']`, "DM GP 지급");
  await host.browser.waitUntil(async () => (await host.browser.$(panel).getText()).includes(`${amount} GP`), {
    timeout: 20_000,
    timeoutMsg: `Host DM panel did not show ${amount} GP after grant`,
  });
}

async function openClientInventoryAndStash(client) {
  await click(client.browser, exactButton("인벤토리"), "Player 인벤토리");
  const inventory = "//aside[contains(@aria-label,'세션 인벤토리')]";
  await client.browser.$(inventory).waitForDisplayed({ timeout: 15_000 });
  await click(client.browser, `${inventory}//button[normalize-space(.)='공유 보관함 열기']`, "공유 보관함 열기");
  const stash = "//aside[@aria-label='공유 보관함']";
  await client.browser.$(stash).waitForDisplayed({ timeout: 15_000 });
  return { inventory, stash };
}

async function assertTextEventually(browser, selector, expected, description) {
  await browser.waitUntil(async () => (await browser.$(selector).getText()).includes(expected), {
    timeout: 20_000,
    interval: 150,
    timeoutMsg: `${description} did not show ${expected}`,
  });
}

async function verifyGpProjectionAndSingleDeposit(host, client) {
  await grantGpFromHost(host, 40);
  const { inventory, stash } = await openClientInventoryAndStash(client);
  await assertTextEventually(client.browser, inventory, "40 GP", "Client inventory after DM grant");
  await replaceValue(client.browser, `${stash}//label[.//span[normalize-space(.)='옮길 금액']]//input`, 10, "Player stash GP amount");
  await click(client.browser, `${stash}//button[@aria-label='10 GP 공유 보관함으로 이동']`, "Player GP 보관");
  await assertTextEventually(client.browser, inventory, "30 GP", "Client inventory after stash deposit");
  await assertTextEventually(client.browser, stash, "10 GP", "Party Stash after deposit");
  await assertTextEventually(host.browser, "//aside[@aria-label='DM 아이템과 재화 지급 및 회수']", "30 GP", "Host owner inventory after Player stash deposit");

  const inventoryText = await client.browser.$(inventory).getText();
  const stashText = await client.browser.$(stash).getText();
  assert.match(inventoryText, /\b30 GP\b/, "Client gold should be decremented exactly once");
  assert.doesNotMatch(inventoryText, /\b10 GP\b/, "one 10 GP deposit must not debit the Client three times");
  assert.match(stashText, /공유 골드\s+10 GP/, "Party Stash gold should be incremented exactly once");
  assert.doesNotMatch(stashText, /공유 골드\s+30 GP/, "Party Stash must not duplicate the deposit");
  log("DM 40 GP 지급 → Client 즉시 40 GP → 10 GP 보관 → Client/Host 30 / 보관함 10 검증 통과");
}

async function runScenario() {
  assert.equal(process.platform, "win32", "The current Tauri E2E launcher is Windows-only");
  assert.ok(existsSync(binary), `Tauri E2E binary was not found: ${binary}`);
  await rm(runRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  await ensureVite();

  const hostDriverPort = await reservePort();
  const clientDriverPort = await reservePort();
  const sessionPort = await reservePort();
  log(`포트: Host WebDriver ${hostDriverPort}, Client WebDriver ${clientDriverPort}, Session ${sessionPort}`);

  const host = await launchInstance("Tauri E2E Host", path.join(runRoot, "host", "data"), hostDriverPort);
  const client = await launchInstance("Tauri E2E Client", path.join(runRoot, "client", "data"), clientDriverPort);
  log("실제 Tauri 창 두 개에 WebDriver가 연결되었습니다.");

  if (smokeOnly) {
    await saveEvidence(host, "smoke");
    await saveEvidence(client, "smoke");
    assert.match(await host.browser.getTitle(), /SimpleVTT/);
    assert.match(await client.browser.getTitle(), /SimpleVTT/);
    log(`스모크 검증 통과 · 증거: ${artifactRoot}`);
    return;
  }

  await createHostCampaign(host);
  await openHostSession(host, sessionPort);
  await joinClientSession(client, sessionPort);
  await verifyGpProjectionAndSingleDeposit(host, client);
  await saveEvidence(host, "connected");
  await saveEvidence(client, "connected");
  log(`Host/Client 실제 UI 입력·재화 일관성 검증 통과 · 증거: ${artifactRoot}`);
}

async function cleanup() {
  if (keepOpen) {
    log(`--keep-open 지정됨 · 테스트 창과 ${viteStarted ? "Vite 서버" : "기존 Vite 서버"}를 유지합니다.`);
    return;
  }
  for (const browser of browsers.reverse()) {
    try {
      await Promise.race([
        browser.deleteSession(),
        new Promise((resolve) => setTimeout(resolve, 3_000)),
      ]);
    } catch { /* best effort */ }
  }
  for (const child of children.reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  }
}

let exitCode = 0;
try {
  await runScenario();
} catch (error) {
  exitCode = 1;
  log(`실패: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  for (const [index, browser] of browsers.entries()) {
    try {
      const screenshot = await browser.takeScreenshot();
      await writeFile(path.join(artifactRoot, `failure-${index + 1}.png`), screenshot, "base64");
      await writeFile(path.join(artifactRoot, `failure-${index + 1}.txt`), await browser.$("body").getText(), "utf8");
    } catch { /* best effort */ }
  }
  log(`실패 증거: ${artifactRoot}`);
} finally {
  await cleanup();
}
process.exitCode = exitCode;
