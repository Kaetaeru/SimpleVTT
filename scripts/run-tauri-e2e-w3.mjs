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
const verificationSha = process.env.V1_VERIFICATION_SHA ?? process.env.GITHUB_SHA ?? "local";
const keepOpen = process.argv.includes("--keep-open");

const children = [];
const browsers = [];
let viteStarted = false;

function log(message) {
  process.stdout.write(`[TAURI W3 E2E] ${message}\n`);
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
  let response;
  for (let attempt = 0; attempt < 50 && !response?.ok; attempt += 1) {
    try {
      response = await fetch("http://127.0.0.1:1420/");
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  assert.ok(response?.ok, "Vite warm-up did not become HTTP-ready");
  await response.text();
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
  await browser.setTimeout({ implicit: 0, pageLoad: 30_000, script: 60_000 });
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
}

async function saveEvidence(instance, suffix) {
  const base = instance.label.replace(/\s+/g, "-").toLowerCase();
  const screenshot = await instance.browser.takeScreenshot();
  await writeFile(path.join(artifactRoot, `${base}-${suffix}.png`), screenshot, "base64");
  await writeFile(path.join(artifactRoot, `${base}-${suffix}.txt`), await instance.browser.$("body").getText(), "utf8");
}

async function stopInstance(instance) {
  try { await instance.browser.deleteSession(); } catch { /* best effort */ }
  if (instance.child.pid && instance.child.exitCode === null) {
    spawnSync("taskkill.exe", ["/PID", String(instance.child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
  }
}

async function completeVisibleCharacterChoices(browser, preferredLabels = []) {
  for (let attempt = 0; attempt < 120; attempt += 1) {
    const result = await browser.execute((preferred) => {
      const sections = [...document.querySelectorAll(".focused-create-stage .create-v09-section")];
      for (const section of sections) {
        if (section.querySelector(".create-status-pill")?.textContent?.trim() !== "선택 필요") continue;
        const candidates = section.querySelectorAll(
          ".dynamic-choice-grid .create-option-card, .equipment-options .create-option-card, .spell-choice-grid button, .proficiency-grid button",
        );
        const available = [...candidates].filter((item) => {
          const button = item;
          const selected = button.classList.contains("selected") || Boolean(button.querySelector(".selected"));
          return !button.disabled && button.getAttribute("aria-disabled") !== "true" && !selected;
        });
        const target = available.find((item) => preferred.some((label) => item.textContent?.includes(label))) ?? available[0];
        if (target instanceof HTMLElement) {
          const selectedBefore = [...candidates].filter((item) => item.classList.contains("selected") || item.querySelector(".selected")).length;
          const textBefore = section.textContent;
          target.scrollIntoView({ block: "center" });
          target.click();
          return { clicked: true, section: section.id, selectedBefore, textBefore };
        }
      }
      const unresolved = sections
        .filter((section) => section.querySelector(".create-status-pill")?.textContent?.trim() === "선택 필요")
        .map((section) => section.id);
      return { clicked: false, unresolved };
    }, preferredLabels);
    if (!result.clicked) return result.unresolved;
    await browser.waitUntil(async () => browser.execute(({ sectionId, selectedBefore, textBefore }) => {
      const section = document.getElementById(sectionId);
      if (!section) return false;
      const selectedNow = section.querySelectorAll(".create-option-card.selected, .spell-choice-grid .spell-tile.selected, .proficiency-grid button.selected").length;
      return selectedNow > selectedBefore
        || section.textContent !== textBefore
        || section.querySelector(".create-status-pill")?.textContent?.trim() !== "선택 필요";
    }, { sectionId: result.section, selectedBefore: result.selectedBefore, textBefore: result.textBefore }), {
      timeout: 15_000,
      timeoutMsg: `Character choice did not commit in ${result.section}`,
    });
  }
  throw new Error("Character choice completion exceeded 120 UI clicks");
}

async function chooseCharacterSource(browser, tab, name) {
  await click(browser, `//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(tab)}]]`, `${tab} 탭`);
  const option = `//button[contains(@class,'create-option-card')][.//strong[normalize-space(.)=${JSON.stringify(name)}]]`;
  await click(browser, option, `${tab} ${name}`);
  await browser.waitUntil(async () => (await browser.$(option).getAttribute("class")).includes("selected"), {
    timeout: 15_000,
    timeoutMsg: `${tab} ${name} selection did not commit`,
  });
  const unresolved = await completeVisibleCharacterChoices(browser);
  assert.deepEqual(unresolved, [], `${tab} UI choices remain unresolved: ${unresolved.join(", ")}`);
}

async function openCharacterTab(browser, label, sectionId) {
  await click(browser, `//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`, `${label} 탭`);
  await browser.$(`//section[@id=${JSON.stringify(sectionId)}]`).waitForDisplayed({ timeout: 15_000 });
}

async function createPlayableCharacter(instance, name) {
  await click(instance.browser, navButton("캐릭터"), "캐릭터 메뉴");
  await click(instance.browser, exactButton("새 캐릭터"), "새 캐릭터");
  await openCharacterTab(instance.browser, "정체성", "identity");
  await replaceValue(instance.browser, labelControl("캐릭터 이름"), name, "캐릭터 이름");
  await chooseCharacterSource(instance.browser, "종족", "인간");
  await chooseCharacterSource(instance.browser, "클래스", "파이터");
  await chooseCharacterSource(instance.browser, "배경", "군인");
  for (const [tab, sectionId] of [["정체성", "identity"], ["종족", "species"], ["클래스", "class"], ["배경", "background"]]) {
    await openCharacterTab(instance.browser, tab, sectionId);
    const unresolved = await completeVisibleCharacterChoices(instance.browser);
    assert.deepEqual(unresolved, [], `${tab} dependent UI choices remain unresolved: ${unresolved.join(", ")}`);
  }
  await openCharacterTab(instance.browser, "능력치", "abilities");
  await click(instance.browser, "//section[@id='abilities']//button[contains(normalize-space(.),'파이터 추천 배치')]", "파이터 추천 배치");
  await openCharacterTab(instance.browser, "기술", "proficiencies");
  const unresolved = await completeVisibleCharacterChoices(instance.browser);
  assert.deepEqual(unresolved, [], `Character UI choices remain unresolved: ${unresolved.join(", ")}`);
  await openCharacterTab(instance.browser, "검토", "review");
  const save = await instance.browser.$(exactButton("모험 시작"));
  if (!await save.isEnabled()) {
    const diagnostics = await instance.browser.execute(() => ({
      validation: [...document.querySelectorAll(".validation.blocking")].map((item) => item.textContent?.trim()),
    }));
    throw new Error(`Character 저장 is disabled: ${JSON.stringify(diagnostics)}`);
  }
  await click(instance.browser, exactButton("모험 시작"), "Character 저장");
  await waitForText(instance.browser, name, 30_000);
}

async function createCampaignWithCalendar(host, campaignName) {
  await click(host.browser, navButton("캠페인"), "캠페인 메뉴");
  const body = await host.browser.$("body").getText();
  await click(host.browser, exactButton(body.includes("아직 캠페인이 없습니다.") ? "새 캠페인 만들기" : "새 캠페인"));
  await replaceValue(host.browser, labelControl("캠페인 이름"), campaignName, "캠페인 이름");
  await click(host.browser, exactButton("캠페인 만들기"), "캠페인 만들기 제출");
  await waitForText(host.browser, campaignName);
  const calendarCard = "//article[.//h3[normalize-space(.)='달력']]";
  const initialMinuteText = await host.browser.$(`${calendarCard}//p`).getText();
  const initialMinuteMatch = initialMinuteText.match(/현재 절대 시간\s+(\d+)분/);
  assert.ok(initialMinuteMatch, `Could not read the initial Campaign absolute minute: ${initialMinuteText}`);
  const initialAbsoluteMinute = Number(initialMinuteMatch[1]);
  await click(host.browser, exactButton("세션 시작"), "캠페인 세션 시작");
  const setup = "//section[@aria-label='세션 시작 설정']";
  const calendar = await host.browser.$(`${setup}//label[.//strong[normalize-space(.)='세션 달력 사용']]//input`);
  await calendar.waitForDisplayed({ timeout: 15_000 });
  if (!await calendar.isSelected()) await calendar.click();
  assert.equal(await calendar.isSelected(), true, "Campaign calendar was not enabled for W3-08");
  await click(host.browser, `${setup}//button[normalize-space(.)='준비 화면으로']`, "준비 화면으로");
  await waitForText(host.browser, "캠페인에서 세션 만들기");
  return initialAbsoluteMinute;
}

async function openHostSession(host, sessionPort) {
  await click(host.browser, navButton("세션"), "세션 메뉴");
  const direct = "//*[@aria-label='직접 네트워크 세션 시작']";
  await replaceValue(host.browser, `${direct}//label[.//span[normalize-space(.)='Bind / Listen IP']]//input`, "127.0.0.1", "Host bind 주소");
  const portInputs = await host.browser.$$(`${direct}//label[.//span[normalize-space(.)='포트']]//input`);
  assert.ok(portInputs.length >= 1, "Host port input was not found");
  await portInputs[0].setValue(String(sessionPort));
  await click(host.browser, `${direct}//button[normalize-space(.)='세션 열기']`, "Direct Host 세션 열기");
  await waitForText(host.browser, "호스트 · DM", 30_000);
}

async function performLongRest(host) {
  const clockSelector = "//header[contains(@class,'session-reference-play-chrome')]//button[starts-with(@aria-label,'Campaign 시간')]";
  const clock = await host.browser.$(clockSelector);
  await clock.waitForDisplayed({ timeout: 15_000 });
  const beforeClock = await clock.getAttribute("aria-label");
  assert.ok(beforeClock && !beforeClock.includes("추적 꺼짐"), "Campaign clock is not active in the live session");

  const restButton = "//header[contains(@class,'session-reference-play-chrome')]//button[.//span[normalize-space(.)='휴식']]";
  await click(host.browser, restButton, "세션 휴식");
  const pane = "//aside[@aria-label='세션 휴식']";
  await host.browser.$(pane).waitForDisplayed({ timeout: 15_000 });
  const advance = await host.browser.$(`${pane}//input[@aria-label='장기 휴식과 함께 캠페인 시간 8시간 진행']`);
  await advance.waitForDisplayed({ timeout: 15_000 });
  await advance.waitForEnabled({ timeout: 15_000 });
  if (!await advance.isSelected()) await advance.click();
  await click(host.browser, `${pane}//button[normalize-space(.)='장기 휴식 적용']`, "장기 휴식 적용");
  await host.browser.waitUntil(async () => {
    const text = await host.browser.$(pane).getText();
    return text.includes("장기 휴식을 적용했습니다") && text.includes("시간 +8시간");
  }, {
    timeout: 20_000,
    timeoutMsg: "Long Rest did not confirm the +8 hour campaign transaction",
  });
  await host.browser.waitUntil(async () => (await clock.getAttribute("aria-label")) !== beforeClock, {
    timeout: 20_000,
    timeoutMsg: "Campaign clock did not advance after Long Rest",
  });
  const afterClock = await clock.getAttribute("aria-label");
  assert.ok(afterClock, "Campaign clock label disappeared after Long Rest");
  const afterCalendarDisplay = afterClock.split(" · ").slice(2).join(" · ");
  assert.ok(afterCalendarDisplay, `Could not parse post-rest campaign time from: ${afterClock}`);
  return { beforeClock, afterClock, afterCalendarDisplay };
}

async function endSessionFromUi(host) {
  const sessionButton = "//header[contains(@class,'session-reference-play-chrome')]//button[normalize-space(.)='세션']";
  await click(host.browser, sessionButton, "세션 도구");
  const pane = "//aside[@aria-label='세션 공유 및 설정']";
  await host.browser.$(pane).waitForDisplayed({ timeout: 15_000 });
  await click(host.browser, `${pane}//button[normalize-space(.)='세션 종료']`, "세션 종료");
  await host.browser.waitUntil(async () => !(await host.browser.$("body").getText()).includes("호스트 · DM"), {
    timeout: 20_000,
    timeoutMsg: "Host remained on the live session surface after ending the session",
  });
  await waitForText(host.browser, "세션 시작");
}

async function verifyRestartedCampaign(host, campaignName, expectedAbsoluteMinute) {
  await click(host.browser, navButton("캠페인"), "재시작 후 캠페인 메뉴");
  await waitForText(host.browser, campaignName);
  const calendarCard = "//article[.//h3[normalize-space(.)='달력']]";
  const calendarDisplay = await host.browser.$(`${calendarCard}//strong`).getText();
  const absoluteMinuteText = await host.browser.$(`${calendarCard}//p`).getText();
  assert.equal(absoluteMinuteText, `현재 절대 시간 ${expectedAbsoluteMinute}분`, "Restarted Campaign calendar did not preserve the +8h Long Rest advancement");
  const historyCard = "//article[.//h3[normalize-space(.)='세션 기록']]";
  const historyCount = await host.browser.$(`${historyCard}//strong`).getText();
  assert.equal(historyCount, "1회", "Completed local session was not recorded after restart");
  return { calendarDisplay, absoluteMinuteText, historyCount };
}

async function runW308() {
  assert.equal(process.platform, "win32", "W3-08 Tauri verification is Windows-only");
  assert.ok(existsSync(binary), `Tauri E2E binary was not found: ${binary}`);
  await rm(runRoot, { recursive: true, force: true });
  await mkdir(artifactRoot, { recursive: true });
  await ensureVite();

  const hostDataRoot = path.join(runRoot, "w3", "host-data");
  const campaignName = `W3 Local Session ${runId.slice(-6)}`;
  const characterName = `W3 Local Fighter ${runId.slice(-6)}`;
  const host = await launchInstance("W3 Local Host", hostDataRoot, await reservePort());
  const sessionPort = await reservePort();

  await createPlayableCharacter(host, characterName);
  await saveEvidence(host, "w3-08-character-ready");
  const initialAbsoluteMinute = await createCampaignWithCalendar(host, campaignName);
  await openHostSession(host, sessionPort);
  await saveEvidence(host, "w3-08-live-host");

  const rest = await performLongRest(host);
  await saveEvidence(host, "w3-08-rest-complete");

  await endSessionFromUi(host);
  await saveEvidence(host, "w3-08-session-ended");
  await stopInstance(host);

  const restarted = await launchInstance("W3 Local Restart", hostDataRoot, await reservePort());
  const restart = await verifyRestartedCampaign(restarted, campaignName, initialAbsoluteMinute + 480);
  await saveEvidence(restarted, "w3-08-restarted");

  await writeFile(path.join(artifactRoot, "w3-08.json"), JSON.stringify({
    gate: "W3-08",
    status: "PASS",
    verificationSha,
    windowsTauri: true,
    lifecycle: "actual Tauri Character -> local Host session -> DM Long Rest (+8h) -> UI session end -> process exit -> same Host data root restart -> Campaign continuity",
    endpoint: "127.0.0.1",
    characterName,
    campaignName,
    initialAbsoluteMinute,
    expectedRestartAbsoluteMinute: initialAbsoluteMinute + 480,
    rest,
    restart,
  }, null, 2), "utf8");
  log(`W3-08 complete local session lifecycle 통과 · ${artifactRoot}`);
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
  await runW308();
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
