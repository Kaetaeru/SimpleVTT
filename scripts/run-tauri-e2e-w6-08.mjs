import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { remote } from "webdriverio";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const binary = path.join(root, ".live-dev", "tauri-e2e-target", "debug", "simplevtt.exe");
const viteEntry = path.join(root, "node_modules", "vite", "bin", "vite.js");
const runId = new Date().toISOString().replace(/[:.]/g, "-");
const runRoot = path.join(root, ".live-dev", "tauri-e2e", `${runId}-w6-08`);
const artifactRoot = path.join(runRoot, "artifacts");
const verificationSha = process.env.V1_VERIFICATION_SHA ?? process.env.GITHUB_SHA ?? "local";
const children = [];
const browsers = [];
let viteStarted = false;

function log(message) {
  process.stdout.write(`[TAURI W6-08] ${message}\n`);
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

async function canConnect(port) {
  return new Promise((resolve) => {
    const socket = new Socket();
    const done = (value) => {
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(250);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, "127.0.0.1");
  });
}

async function waitForPort(port, label, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await canConnect(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`${label} did not listen on 127.0.0.1:${port}`);
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
  if (await canConnect(1420)) return;
  assert.ok(existsSync(viteEntry), `Vite entry was not found: ${viteEntry}`);
  viteStarted = true;
  spawnTracked(process.execPath, [viteEntry, "--host", "0.0.0.0", "--port", "1420", "--strictPort"]);
  await waitForPort(1420, "Vite", 45_000);
}

function exactButton(text) {
  return `//button[normalize-space(.)=${JSON.stringify(text)}]`;
}

function navButton(text) {
  return `//nav[@aria-label='주요 메뉴']//button[.//span[normalize-space(.)=${JSON.stringify(text)}]]`;
}

function labelControl(label) {
  return `//label[.//*[self::span or self::legend][normalize-space(.)=${JSON.stringify(label)}]]//input`;
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

async function waitAbsent(browser, selector, description) {
  await browser.waitUntil(async () => {
    const element = await browser.$(selector);
    return !await element.isExisting() || !await element.isDisplayed();
  }, { timeout: 20_000, interval: 150, timeoutMsg: `${description} remained visible` });
}

async function launchInstance(label, dataRoot, webdriverPort) {
  await mkdir(dataRoot, { recursive: true });
  spawnTracked(binary, [
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
  await waitForPort(webdriverPort, `${label} WebDriver`);
  const browser = await remote({ hostname: "127.0.0.1", port: webdriverPort, logLevel: "error", capabilities: {} });
  browsers.push(browser);
  await browser.waitUntil(async () => {
    const body = await browser.$("body").getText();
    if (body.includes("TABLETOP, YOUR WAY")) return true;
    return await browser.$(exactButton("선택 저장 · Home으로")).isExisting();
  }, { timeout: 30_000, timeoutMsg: `${label} did not reach Home or first-run setup` });
  const finish = await browser.$(exactButton("선택 저장 · Home으로"));
  if (await finish.isExisting()) {
    await click(browser, "//button[.//strong[normalize-space(.)='SimpleVTT 최적화']]", `${label} first-run preset`);
    await finish.waitForEnabled({ timeout: 10_000 });
    await finish.click();
  }
  await waitForText(browser, "TABLETOP, YOUR WAY", 30_000);
  return { label, browser, dataRoot };
}

async function saveEvidence(instance, suffix) {
  const base = instance.label.replace(/\s+/g, "-").toLowerCase();
  await writeFile(path.join(artifactRoot, `${base}-${suffix}.png`), await instance.browser.takeScreenshot(), "base64");
  await writeFile(path.join(artifactRoot, `${base}-${suffix}.txt`), await instance.browser.$("body").getText(), "utf8");
}

async function createHostCampaign(host) {
  await click(host.browser, navButton("캠페인"), "Host 캠페인 메뉴");
  const body = await host.browser.$("body").getText();
  await click(host.browser, exactButton(body.includes("아직 캠페인이 없습니다.") ? "새 캠페인 만들기" : "새 캠페인"), "새 캠페인");
  await replaceValue(host.browser, labelControl("캠페인 이름"), "W6-08 Windows H+P1 Journey", "캠페인 이름");
  await click(host.browser, exactButton("캠페인 만들기"), "캠페인 만들기 제출");
  await waitForText(host.browser, "W6-08 Windows H+P1 Journey");
}

async function openHostSession(host, port) {
  await click(host.browser, navButton("세션"), "Host 세션 메뉴");
  const direct = "//*[@aria-label='직접 네트워크 세션 시작']";
  await replaceValue(host.browser, `${direct}//label[.//span[normalize-space(.)='Bind / Listen IP']]//input`, "127.0.0.1", "Host bind 주소");
  const inputs = await host.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);
  assert.ok(inputs.length >= 1, "Host port input was not found");
  await inputs[0].setValue(String(port));
  await click(host.browser, `${direct}//button[normalize-space(.)='세션 열기']`, "Host 세션 열기");
  await waitForText(host.browser, "호스트 · DM", 30_000);
}

async function joinClient(client, port) {
  await click(client.browser, navButton("세션"), "P1 세션 메뉴");
  const direct = "//*[@aria-label='직접 네트워크 세션 시작']";
  const character = await client.browser.$(`${direct}//label[contains(normalize-space(.),'플레이 Character')]//select`);
  await character.waitForDisplayed({ timeout: 15_000, timeoutMsg: "P1 Character select is not visible" });
  const options = await character.$$("option");
  let selectedIndex = -1;
  for (let index = 0; index < options.length; index += 1) {
    if (await options[index].getAttribute("value")) {
      selectedIndex = index;
      break;
    }
  }
  assert.ok(selectedIndex >= 0, "P1 saved Character option was not found");
  await character.selectByIndex(selectedIndex);
  await replaceValue(client.browser, `${direct}//label[.//span[normalize-space(.)='Host IP / 주소']]//input`, "127.0.0.1", "P1 Host 주소");
  const inputs = await client.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);
  assert.ok(inputs.length >= 2, "P1 port input was not found");
  await inputs[1].setValue(String(port));
  await click(client.browser, `${direct}//button[normalize-space(.)='참가하기']`, "P1 참가하기");
  await waitForText(client.browser, "클라이언트 · 플레이어", 30_000);
  const snapshot = await client.browser.executeAsync((done) => {
    import("/src/app/mockAdapter.ts").then(async ({ mockAdapter }) => {
      const value = await mockAdapter.getSnapshot();
      done({ name: value.activeCharacter?.name ?? null });
    }).catch((error) => done({ error: String(error?.stack ?? error) }));
  });
  assert.ok(!snapshot.error, snapshot.error);
  assert.ok(snapshot.name, "P1 active Character name was unavailable after join");
  return snapshot.name;
}

async function selectRemoteActor(host, characterName) {
  const card = `//section[@aria-label='아군 Actor Board']//button[contains(@class,'session-actor-card') and contains(@aria-label,${JSON.stringify(characterName)})]`;
  await host.browser.$(card).waitForDisplayed({ timeout: 20_000, timeoutMsg: `${characterName} did not appear on Host allied Actor board` });
  await click(host.browser, card, `${characterName} Actor 선택`);
  await host.browser.waitUntil(async () => await host.browser.$(card).getAttribute("aria-pressed") === "true", {
    timeout: 15_000,
    timeoutMsg: `${characterName} did not become Host selected Actor`,
  });
}

async function openDmInventory(host) {
  await click(host.browser, exactButton("아이템"), "DM 아이템 도구");
  const panel = "//aside[@aria-label='DM 아이템과 재화 지급 및 회수']";
  await host.browser.$(panel).waitForDisplayed({ timeout: 15_000 });
  return panel;
}

async function adjustGp(host, panel, amount, operation, expectedTotal) {
  await replaceValue(host.browser, `${panel}//input[@aria-label='변경할 GP']`, amount, `DM GP ${operation}`);
  await click(host.browser, `${panel}//button[normalize-space(.)=${JSON.stringify(operation)}]`, `DM GP ${operation}`);
  await host.browser.waitUntil(async () => (await host.browser.$(panel).getText()).includes(`${expectedTotal} GP`), {
    timeout: 20_000,
    timeoutMsg: `Host DM panel did not show ${expectedTotal} GP after ${operation}`,
  });
}

async function openClientInventoryAndStash(client) {
  await click(client.browser, exactButton("인벤토리"), "P1 인벤토리");
  const inventory = "//aside[contains(@aria-label,'세션 인벤토리')]";
  await client.browser.$(inventory).waitForDisplayed({ timeout: 15_000 });
  await click(client.browser, `${inventory}//button[contains(normalize-space(.),'공유 보관함')]`, "공유 보관함 열기");
  const stash = "//aside[@aria-label='공유 보관함']";
  await client.browser.$(stash).waitForDisplayed({ timeout: 15_000 });
  return { inventory, stash };
}

async function verifyGrantRevokeAndStash(host, client, characterName) {
  await selectRemoteActor(host, characterName);
  const panel = await openDmInventory(host);
  await adjustGp(host, panel, 40, "지급", 40);
  const { inventory, stash } = await openClientInventoryAndStash(client);
  await client.browser.waitUntil(async () => (await client.browser.$(inventory).getText()).includes("40 GP"), { timeout: 20_000 });
  await replaceValue(client.browser, `${stash}//input[@aria-label='옮길 GP']`, 10, "P1 Stash GP amount");
  await click(client.browser, `${stash}//button[@aria-label='10 GP 공유 보관함으로 이동']`, "P1 10 GP 보관");
  await client.browser.waitUntil(async () => {
    const inventoryText = await client.browser.$(inventory).getText();
    const stashText = await client.browser.$(stash).getText();
    return inventoryText.includes("30 GP") && stashText.includes("10 GP");
  }, { timeout: 20_000, timeoutMsg: "P1 Party Stash deposit did not converge" });
  await adjustGp(host, panel, 5, "회수", 25);
  await client.browser.waitUntil(async () => (await client.browser.$(inventory).getText()).includes("25 GP"), {
    timeout: 20_000,
    timeoutMsg: "P1 inventory did not project the DM revoke",
  });
  return { grantedGp: 40, stashDepositGp: 10, revokedGp: 5, finalCharacterGp: 25, finalStashGp: 10 };
}

async function verifyHandout(host, client) {
  await click(host.browser, "//header[contains(@class,'session-reference-play-chrome')]//button[normalize-space(.)='세션']", "Host 세션 도구");
  await click(host.browser, exactButton("이미지 보여주기"), "Host Handout 열기");
  const pane = "//aside[@aria-label='DM Handout 도구']";
  await host.browser.$(pane).waitForDisplayed({ timeout: 15_000 });
  const base64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Z9xkAAAAASUVORK5CYII=";
  const injected = await host.browser.execute((selector, encoded) => {
    const input = document.querySelector(selector);
    if (!(input instanceof HTMLInputElement)) return { ok: false };
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    const file = new File([bytes], "w6-08-handout.png", { type: "image/png" });
    const transfer = new DataTransfer();
    transfer.items.add(file);
    input.files = transfer.files;
    input.dispatchEvent(new Event("change", { bubbles: true }));
    return { ok: true, fileName: input.files?.[0]?.name ?? null };
  }, `${pane} input[type='file']`, base64);
  assert.deepEqual(injected, { ok: true, fileName: "w6-08-handout.png" });
  await host.browser.$(".session-handout-preview").waitForDisplayed({ timeout: 15_000 });
  assert.equal(await client.browser.$(".session-handout-viewer").isExisting(), false, "P1 saw the handout before reveal");
  await click(host.browser, exactButton("플레이어에게 공개"), "Handout 공개");
  await client.browser.$(".session-handout-viewer").waitForDisplayed({ timeout: 20_000, timeoutMsg: "P1 rendered handout did not appear" });
  const src = await client.browser.$(".session-handout-viewer img").getAttribute("src");
  assert.ok(src?.startsWith("data:image/png;base64,"), "P1 handout image was not rendered from the shared asset");
  await click(host.browser, exactButton("공유 철회"), "Handout 공유 철회");
  await waitAbsent(client.browser, ".session-handout-viewer", "P1 withdrawn handout viewer");
  await click(host.browser, `${pane}//button[@aria-label='Handout 도구 닫기']`, "Handout 도구 닫기");
  return { fileName: "w6-08-handout.png", revealedToP1: true, withdrawnFromP1: true };
}

async function verifyDistributedLongRest(host, client) {
  const hostClock = "//header[contains(@class,'session-reference-play-chrome')]//button[starts-with(@aria-label,'Campaign 시간')]";
  const beforeClock = await host.browser.$(hostClock).getAttribute("aria-label");
  assert.ok(beforeClock && !beforeClock.includes("추적 꺼짐"), "Campaign clock is not active for W6-08 Long Rest");
  await click(host.browser, "//header[contains(@class,'session-reference-play-chrome')]//button[.//span[normalize-space(.)='휴식']]", "Host 휴식");
  const hostPane = "//aside[@aria-label='세션 휴식']";
  await host.browser.$(hostPane).waitForDisplayed({ timeout: 15_000 });
  const advance = await host.browser.$(`${hostPane}//input[@aria-label='장기 휴식과 함께 캠페인 시간 8시간 진행']`);
  await advance.waitForDisplayed({ timeout: 15_000 });
  if (!await advance.isSelected()) await advance.click();
  const connected = `${hostPane}//section[@aria-label='연결된 플레이어 장기 휴식']`;
  await host.browser.$(connected).waitForDisplayed({ timeout: 20_000, timeoutMsg: "Connected Long Rest DM controls were not rendered" });
  await click(host.browser, `${connected}//button[normalize-space(.)='장기 휴식 제안']`, "P1 장기 휴식 제안");
  await host.browser.waitUntil(async () => (await host.browser.$(connected).getText()).includes("장기 휴식 제안을 보냈습니다"), {
    timeout: 20_000,
    timeoutMsg: "Host did not confirm the connected Long Rest offer",
  });

  await click(client.browser, "//header[contains(@class,'session-reference-play-chrome')]//button[.//span[normalize-space(.)='휴식']]", "P1 휴식");
  const clientPane = "//aside[@aria-label='세션 휴식']";
  await client.browser.$(clientPane).waitForDisplayed({ timeout: 15_000 });
  await client.browser.waitUntil(async () => (await client.browser.$(clientPane).getText()).includes("장기 휴식 요청"), {
    timeout: 20_000,
    timeoutMsg: "P1 connected Long Rest prompt did not arrive",
  });
  await click(client.browser, `${clientPane}//button[normalize-space(.)='승인']`, "P1 장기 휴식 승인");
  await client.browser.waitUntil(async () => (await client.browser.$(clientPane).getText()).includes("완료"), {
    timeout: 30_000,
    timeoutMsg: "P1 connected Long Rest did not reach complete",
  });
  await host.browser.waitUntil(async () => (await host.browser.$(hostClock).getAttribute("aria-label")) !== beforeClock, {
    timeout: 30_000,
    timeoutMsg: "Host Campaign clock did not advance after distributed Long Rest",
  });
  const afterClock = await host.browser.$(hostClock).getAttribute("aria-label");
  return { beforeClock, afterClock, p1Accepted: true, p1Phase: "complete", advanceMinutes: 480 };
}

async function runScenario() {
  assert.equal(process.platform, "win32", "W6-08 Tauri verification is Windows-only");
  assert.ok(existsSync(binary), `Tauri E2E binary was not found: ${binary}`);
  await rm(runRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  await ensureVite();

  const host = await launchInstance("W6-08 Host", path.join(runRoot, "host", "data"), await reservePort());
  const client = await launchInstance("W6-08 P1", path.join(runRoot, "p1", "data"), await reservePort());
  const sessionPort = await reservePort();
  await createHostCampaign(host);
  await openHostSession(host, sessionPort);
  const characterName = await joinClient(client, sessionPort);
  await saveEvidence(host, "connected-start");
  await saveEvidence(client, "connected-start");

  const inventory = await verifyGrantRevokeAndStash(host, client, characterName);
  await saveEvidence(host, "grant-revoke-stash");
  await saveEvidence(client, "grant-revoke-stash");

  const handout = await verifyHandout(host, client);
  await saveEvidence(host, "handout-withdrawn");
  await saveEvidence(client, "handout-withdrawn");

  const longRest = await verifyDistributedLongRest(host, client);
  await saveEvidence(host, "long-rest-complete");
  await saveEvidence(client, "long-rest-complete");

  await writeFile(path.join(artifactRoot, "w6-08.json"), JSON.stringify({
    gate: "W6-08",
    status: "PASS",
    verificationSha,
    windowsTauri: true,
    topology: "H+P1",
    journey: "Journey J5 representative DM live operations across MP-E~G",
    characterName,
    inventory,
    handout,
    longRest,
    p2ObserverParityClaimed: false,
  }, null, 2), "utf8");
  log(`W6-08 H+P1 rendered journey passed · ${artifactRoot}`);
}

async function cleanup() {
  for (const browser of browsers.reverse()) {
    try {
      await Promise.race([browser.deleteSession(), new Promise((resolve) => setTimeout(resolve, 3_000))]);
    } catch { /* best effort */ }
  }
  for (const child of children.reverse()) {
    if (!child.pid || child.exitCode !== null) continue;
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  }
  if (viteStarted) log("W6-08 private Vite process cleanup requested with child process cleanup");
}

let exitCode = 0;
try {
  await runScenario();
} catch (error) {
  exitCode = 1;
  log(`실패: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
  for (const [index, browser] of browsers.entries()) {
    try {
      await writeFile(path.join(artifactRoot, `failure-${index + 1}.png`), await browser.takeScreenshot(), "base64");
      await writeFile(path.join(artifactRoot, `failure-${index + 1}.txt`), await browser.$("body").getText(), "utf8");
    } catch { /* best effort */ }
  }
  log(`실패 증거: ${artifactRoot}`);
} finally {
  await cleanup();
}
process.exitCode = exitCode;
