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

async function chooseCharacterSource(browser, tab, name, preferredLabels = []) {
  await click(browser, `//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(tab)}]]`, `${tab} 탭`);
  const option = `//button[contains(@class,'create-option-card')][.//strong[normalize-space(.)=${JSON.stringify(name)}]]`;
  await click(browser, option, `${tab} ${name}`);
  await browser.waitUntil(async () => (await browser.$(option).getAttribute("class")).includes("selected"), {
    timeout: 15_000,
    timeoutMsg: `${tab} ${name} selection did not commit`,
  });
  const unresolved = await completeVisibleCharacterChoices(browser, preferredLabels);
  assert.deepEqual(unresolved, [], `${tab} UI choices remain unresolved: ${unresolved.join(", ")}`);
}

async function openCharacterTab(browser, label, sectionId) {
  await click(browser, `//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`, `${label} 탭`);
  await browser.$(`//section[@id=${JSON.stringify(sectionId)}]`).waitForDisplayed({ timeout: 15_000 });
}

async function createPlayableCharacter(instance, name, { className = "소서러", speciesName = "인간", backgroundName = "군인", preferredLabels = [] } = {}) {
  await click(instance.browser, navButton("캐릭터"), "캐릭터 메뉴");
  await click(instance.browser, exactButton("새 캐릭터"), "새 캐릭터");
  await openCharacterTab(instance.browser, "정체성", "identity");
  await replaceValue(instance.browser, labelControl("캐릭터 이름"), name, "캐릭터 이름");
  await chooseCharacterSource(instance.browser, "종족", speciesName, preferredLabels);
  await chooseCharacterSource(instance.browser, "클래스", className, preferredLabels);
  await chooseCharacterSource(instance.browser, "배경", backgroundName, preferredLabels);
  for (const [tab, sectionId] of [["정체성", "identity"], ["종족", "species"], ["클래스", "class"], ["배경", "background"]]) {
    await openCharacterTab(instance.browser, tab, sectionId);
    const unresolved = await completeVisibleCharacterChoices(instance.browser, preferredLabels);
    assert.deepEqual(unresolved, [], `${tab} dependent UI choices remain unresolved: ${unresolved.join(", ")}`);
  }
  await openCharacterTab(instance.browser, "능력치", "abilities");
  await click(instance.browser, `//section[@id='abilities']//button[contains(normalize-space(.),${JSON.stringify(`${className} 추천 배치`)})]`, `${className} 추천 배치`);
  await openCharacterTab(instance.browser, "기술", "proficiencies");
  const unresolved = await completeVisibleCharacterChoices(instance.browser, preferredLabels);
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

async function saveCurrentCharacterPcPreset(host, characterName) {
  const panel = "//section[@aria-label='DM 라이브러리 PC preset과 폴더']";
  await host.browser.$(panel).waitForDisplayed({ timeout: 15_000, timeoutMsg: "Campaign PC preset organizer was not visible" });
  await click(host.browser, `${panel}//button[normalize-space(.)='현재 Character 불러오기']`, "현재 Character PC preset 불러오기");
  const actionInput = await host.browser.$(`${panel}//label[.//span[normalize-space(.)='행동']]//input`);
  const loadedActions = await actionInput.getValue();
  assert.ok(loadedActions.trim().length > 0 && loadedActions !== "기본 공격", `Current Character actions were not projected into the PC preset form: ${loadedActions}`);
  const presetName = `${characterName} DM`;
  await replaceValue(host.browser, `${panel}//label[.//span[normalize-space(.)='이름']]//input`, presetName, "PC preset 이름");
  await click(host.browser, `${panel}//button[normalize-space(.)='PC preset 저장']`, "PC preset 저장");
  const saved = `${panel}//div[contains(@class,'campaign-option-list')]//strong[normalize-space(.)=${JSON.stringify(presetName)}]`;
  await host.browser.$(saved).waitForDisplayed({ timeout: 20_000, timeoutMsg: `${presetName} PC preset was not saved` });
  return presetName;
}

async function createCampaignWithCalendar(host, campaignName, characterName) {
  await click(host.browser, navButton("캠페인"), "캠페인 메뉴");
  const body = await host.browser.$("body").getText();
  await click(host.browser, exactButton(body.includes("아직 캠페인이 없습니다.") ? "새 캠페인 만들기" : "새 캠페인"));
  await replaceValue(host.browser, labelControl("캠페인 이름"), campaignName, "캠페인 이름");
  await click(host.browser, exactButton("캠페인 만들기"), "캠페인 만들기 제출");
  await waitForText(host.browser, campaignName);
  const presetName = await saveCurrentCharacterPcPreset(host, characterName);
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
  return { initialAbsoluteMinute, presetName };
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

async function spawnPcPreset(host, presetName) {
  await click(host.browser, exactButton("라이브러리"), "DM 라이브러리");
  const pane = "//aside[@aria-label='DM 라이브러리']";
  await host.browser.$(pane).waitForDisplayed({ timeout: 15_000 });
  const entrySelector = `${pane}//article[@data-library-kind='pc-preset'][.//strong[normalize-space(.)=${JSON.stringify(presetName)}]]`;
  const entry = await host.browser.$(entrySelector);
  await entry.waitForDisplayed({ timeout: 15_000, timeoutMsg: `${presetName} was not visible in the Session DM Library` });
  const stage = await host.browser.$("//section[@aria-label='Mapless Play Context']");
  await stage.waitForDisplayed({ timeout: 15_000 });
  const dropDiagnostic = await host.browser.execute((expectedName) => {
    const entryElement = [...document.querySelectorAll("aside[aria-label='DM 라이브러리'] article[data-library-kind='pc-preset']")]
      .find((element) => element.querySelector("strong")?.textContent?.trim() === expectedName);
    const stageElement = document.querySelector("section[aria-label='Mapless Play Context']");
    const playCore = document.querySelector(".session-reference-play-core");
    if (!(entryElement instanceof HTMLElement) || !(stageElement instanceof HTMLElement) || !(playCore instanceof HTMLElement)) {
      throw new Error("W3 PC preset synthetic pointer bridge could not resolve the production drag surfaces");
    }
    const entryRect = entryElement.getBoundingClientRect();
    const stageRect = stageElement.getBoundingClientRect();
    const candidates = [
      [stageRect.left + stageRect.width * 0.5, stageRect.top + stageRect.height * 0.5],
      [stageRect.left + stageRect.width * 0.25, stageRect.top + stageRect.height * 0.5],
      [stageRect.left + stageRect.width * 0.75, stageRect.top + stageRect.height * 0.5],
    ];
    const dropPoint = candidates.find(([x,y]) => {
      const target = document.elementFromPoint(x,y);
      return Boolean(target && playCore.contains(target) && !entryElement.contains(target));
    });
    if (!dropPoint) throw new Error("W3 PC preset synthetic pointer bridge could not find an uncovered production play drop point");
    const [dropX,dropY] = dropPoint;
    const startX = entryRect.left + entryRect.width * 0.5;
    const startY = entryRect.top + entryRect.height * 0.5;
    const trace = [];
    const tracePointer = (event) => trace.push({type:event.type,clientX:event.clientX,clientY:event.clientY,target:event.target instanceof Element?event.target.tagName:null});
    for (const type of ["pointerdown","pointermove","pointerup"]) document.addEventListener(type,tracePointer,true);
    Object.defineProperties(entryElement,{
      setPointerCapture:{configurable:true,value:()=>undefined},
      hasPointerCapture:{configurable:true,value:()=>false},
      releasePointerCapture:{configurable:true,value:()=>undefined},
    });
    const dispatch = (type,x,y,buttons) => entryElement.dispatchEvent(new PointerEvent(type,{
      bubbles:true,cancelable:true,composed:true,pointerId:1,pointerType:"mouse",isPrimary:true,button:0,buttons,clientX:x,clientY:y,
    }));
    try{
      dispatch("pointerdown",startX,startY,1);
      dispatch("pointermove",dropX,dropY,1);
      dispatch("pointerup",dropX,dropY,0);
    }finally{
      delete entryElement.setPointerCapture;
      delete entryElement.hasPointerCapture;
      delete entryElement.releasePointerCapture;
      for (const type of ["pointerdown","pointermove","pointerup"]) document.removeEventListener(type,tracePointer,true);
    }
    const hit=document.elementFromPoint(dropX,dropY);
    return {inputBridge:"Tauri DOM PointerEvent sequence",start:{x:startX,y:startY},drop:{x:dropX,y:dropY,hit:hit instanceof Element?`${hit.tagName}.${hit.className}`:null},trace};
  }, presetName);
  await writeFile(path.join(artifactRoot,"w3-08-drop-diagnostic.json"),JSON.stringify({gate:"W3-08",verificationSha,presetName,...dropDiagnostic},null,2),"utf8");
  await host.browser.waitUntil(async () => {
    const feedback = await host.browser.$("//div[contains(@class,'session-dm-library-drop-feedback')]");
    return await feedback.isExisting() && (await feedback.getText()).includes(presetName) && (await feedback.getText()).includes("Actor를 소환했습니다");
  }, { timeout: 20_000, timeoutMsg: `${presetName} PC preset drop did not materialize an Actor` });
  await click(host.browser, `${pane}//button[@aria-label='DM 라이브러리 닫기']`, "DM 라이브러리 닫기");
  const card = `//section[@aria-label='아군 Actor Board']//button[contains(@class,'session-actor-card') and contains(@aria-label,${JSON.stringify(presetName)})]`;
  await host.browser.$(card).waitForDisplayed({ timeout: 20_000, timeoutMsg: `${presetName} did not appear on the allied Actor board` });
  await host.browser.waitUntil(async () => {
    const actor = await host.browser.$(card);
    return await actor.getAttribute("aria-pressed") === "true" && (await actor.getAttribute("class") ?? "").split(/\s+/).includes("controlled");
  }, { timeout: 15_000, timeoutMsg: `${presetName} was not selected after PC preset materialization` });
}

async function addCombatant(host) {
  await click(host.browser, exactButton("인카운터"), "인카운터 도구");
  const pane = "//aside[@aria-label='DM Encounter 도구']";
  await host.browser.$(pane).waitForDisplayed({ timeout: 15_000 });
  const definition = await host.browser.$(`${pane}//div[contains(@class,'session-dm-definition-grid') and not(contains(@class,'campaign-library'))]//button[1]`);
  await definition.waitForDisplayed({ timeout: 15_000, timeoutMsg: "No production Combatant definition was available" });
  await definition.waitForEnabled({ timeout: 15_000 });
  const enemyName = await definition.$("strong").getText();
  await definition.click();
  const enemyCard = `//section[@aria-label='상대 Actor Board']//button[contains(@class,'session-actor-card') and contains(@aria-label,${JSON.stringify(enemyName)})]`;
  await host.browser.$(enemyCard).waitForDisplayed({ timeout: 20_000, timeoutMsg: `${enemyName} did not materialize on the enemy Actor board` });
  await click(host.browser, `${pane}//button[@aria-label='Encounter 닫기']`, "Encounter 닫기");
  return { enemyName, enemyCard };
}

async function selectHostCharacter(host, characterName) {
  const characterCard = `//section[@aria-label='아군 Actor Board']//button[contains(@class,'session-actor-card') and contains(@aria-label,${JSON.stringify(characterName)})]`;
  const card = await host.browser.$(characterCard);
  await card.waitForDisplayed({ timeout: 15_000, timeoutMsg: `${characterName} did not appear on the allied Actor board` });
  const pressedBefore = await card.getAttribute("aria-pressed");
  const clicked = pressedBefore !== "true";
  if (clicked) await click(host.browser, characterCard, `${characterName} Actor 선택`);
  const diagnostic = await host.browser.execute((expectedName) => {
    const alliedCard = [...document.querySelectorAll("section[aria-label='아군 Actor Board'] button.session-actor-card")]
      .find((element) => element.getAttribute("aria-label")?.includes(expectedName)) ?? null;
    const controlledCard = document.querySelector(".session-actor-card.controlled");
    const currentTurnCard = document.querySelector(".session-actor-card.current-turn");
    const hotbarActor = document.querySelector(".session-controlled-actor");
    const cardState = (element) => element instanceof HTMLElement ? {
      actorId: element.dataset.actorId ?? null,
      ariaPressed: element.getAttribute("aria-pressed"),
      className: element.className,
      ariaLabel: element.getAttribute("aria-label"),
    } : null;
    return {
      alliedCard: cardState(alliedCard),
      controlledCard: cardState(controlledCard),
      currentTurnCard: cardState(currentTurnCard),
      hotbarActor: hotbarActor instanceof HTMLElement ? {
        ariaLabel: hotbarActor.getAttribute("aria-label"),
        title: hotbarActor.getAttribute("title"),
        actorName: hotbarActor.querySelector(".session-controlled-info strong")?.textContent?.trim() ?? null,
      } : null,
    };
  }, characterName);
  await writeFile(path.join(artifactRoot, "w3-08-selection-diagnostic.json"), JSON.stringify({
    gate: "W3-08",
    verificationSha,
    characterName,
    pressedBefore,
    clicked,
    ...diagnostic,
  }, null, 2), "utf8");
  log(`W3-08 Actor 선택 진단 · ${JSON.stringify(diagnostic)}`);
  await host.browser.waitUntil(async () => {
    const current = await host.browser.$(characterCard);
    return await current.getAttribute("aria-pressed") === "true"
      && (await current.getAttribute("class") ?? "").split(/\s+/).includes("controlled");
  }, { timeout: 15_000, timeoutMsg: `${characterName} did not become the controlled Host Actor` });
}

async function drainResolution(host, actionName) {
  const layer = "//section[contains(@class,'session-resolution-layer')]";
  await host.browser.waitUntil(async () => {
    const existing = await host.browser.$(layer).isExisting();
    const animation = await host.browser.$("//*[contains(@class,'visual-dice') or contains(@class,'physics-dice')]").isExisting();
    return existing || animation;
  }, { timeout: 15_000, timeoutMsg: `${actionName} did not enter the production resolution presentation` });

  for (let attempt = 0; attempt < 80; attempt += 1) {
    const resolution = await host.browser.$(layer);
    if (!await resolution.isExisting()) {
      await new Promise((resolve) => setTimeout(resolve, 250));
      continue;
    }
    const close = await host.browser.$(`${layer}//button[normalize-space(.)='닫기']`);
    if (await close.isExisting() && await close.isDisplayed() && await close.isEnabled()) {
      await close.click();
      await host.browser.waitUntil(async () => !await host.browser.$(layer).isExisting(), {
        timeout: 15_000,
        timeoutMsg: `${actionName} resolution did not close`,
      });
      return;
    }
    const interruptSkip = await host.browser.$(`${layer}//button[normalize-space(.)='넘기기']`);
    if (await interruptSkip.isExisting() && await interruptSkip.isDisplayed() && await interruptSkip.isEnabled()) {
      await interruptSkip.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      continue;
    }
    const next = await host.browser.$(`${layer}//button[contains(@class,'session-resolution-next')]`);
    if (await next.isExisting() && await next.isDisplayed() && await next.isEnabled()) {
      await next.click();
      await new Promise((resolve) => setTimeout(resolve, 200));
      continue;
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`${actionName} resolution did not reach completion`);
}

async function executeTargetedAction(host, actionSelector, targetSelector, description) {
  const action = await host.browser.$(actionSelector);
  await action.waitForDisplayed({ timeout: 15_000, timeoutMsg: `${description} was not visible` });
  const unavailable = (await action.getAttribute("class") ?? "").includes("unavailable") || await action.getAttribute("aria-disabled") === "true";
  assert.equal(unavailable, false, `${description} was unavailable`);
  const actionLabel = await action.getAttribute("aria-label");
  const actionName = actionLabel?.split(" · ")[0]?.trim() || description;
  await action.click();

  const targetingContext = "//span[contains(@class,'session-command-context-label') and contains(normalize-space(.),'액터를 클릭하세요')]";
  await host.browser.waitUntil(async () => {
    const targeting = await host.browser.$(targetingContext).isExisting();
    const resolution = await host.browser.$("//section[contains(@class,'session-resolution-layer')]").isExisting();
    const animation = await host.browser.$("//*[contains(@class,'visual-dice') or contains(@class,'physics-dice')]").isExisting();
    return targeting || resolution || animation;
  }, { timeout: 15_000, timeoutMsg: `${description} did not begin targeting or resolution` });

  if (await host.browser.$(targetingContext).isExisting()) {
    const target = await host.browser.$(targetSelector);
    await target.waitForDisplayed({ timeout: 15_000, timeoutMsg: `${description} target was not visible` });
    const targetClass = await target.getAttribute("class") ?? "";
    assert.ok(targetClass.includes("valid-target"), `${description} target was not eligible`);
    await target.click();
    const execute = await host.browser.$("//button[contains(@class,'primary') and starts-with(normalize-space(.),'실행 ·')]");
    if (await execute.isExisting()) {
      await execute.waitForEnabled({ timeout: 15_000 });
      await execute.click();
    }
  }

  await drainResolution(host, actionName);
  return actionName;
}

async function assertActivity(host, actionName) {
  await click(host.browser, exactButton("기록"), "세션 기록");
  const pane = "//aside[@aria-label='최근 세션 활동']";
  await host.browser.$(pane).waitForDisplayed({ timeout: 15_000 });
  await host.browser.waitUntil(async () => (await host.browser.$(pane).getText()).includes(actionName), {
    timeout: 15_000,
    timeoutMsg: `Activity did not record ${actionName}`,
  });
  await click(host.browser, `${pane}//button[@aria-label='활동 닫기']`, "활동 닫기");
}

async function performCombatAndSpell(host, characterName) {
  const { enemyName, enemyCard } = await addCombatant(host);
  await selectHostCharacter(host, characterName);

  const weaponSelector = "//section[@data-category='action']//button[contains(@class,'session-hotbar-slot') and not(contains(@class,'unavailable'))][.//*[@data-action-icon='weapon-attack' or starts-with(@data-action-icon,'weapon-')]][1]";
  const weaponAction = await executeTargetedAction(host, weaponSelector, enemyCard, "장착 무기 공격");
  await assertActivity(host, weaponAction);

  const damageSpellSelector = "//section[@data-category='class']//button[contains(@class,'session-hotbar-slot') and not(contains(@class,'unavailable'))][.//*[@data-action-icon='acid' or @data-action-icon='cold' or @data-action-icon='fire' or @data-action-icon='force' or @data-action-icon='lightning' or @data-action-icon='necrotic' or @data-action-icon='poison' or @data-action-icon='psychic' or @data-action-icon='radiant' or @data-action-icon='thunder']][1]";
  const spellAction = await executeTargetedAction(host, damageSpellSelector, enemyCard, "damage-type spell");
  await assertActivity(host, spellAction);
  return { enemyName, weaponAction, spellAction };
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
  await waitForText(host.browser, "TABLETOP, YOUR WAY");
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
  const characterName = `W3 Local Sorcerer ${runId.slice(-6)}`;
  const host = await launchInstance("W3 Local Host", hostDataRoot, await reservePort());
  const sessionPort = await reservePort();

  await createPlayableCharacter(host, characterName);
  await saveEvidence(host, "w3-08-character-ready");
  const { initialAbsoluteMinute, presetName } = await createCampaignWithCalendar(host, campaignName, characterName);
  await saveEvidence(host, "w3-08-preset-saved");
  await openHostSession(host, sessionPort);
  await saveEvidence(host, "w3-08-live-host");
  await spawnPcPreset(host, presetName);
  await saveEvidence(host, "w3-08-preset-spawned");

  const combat = await performCombatAndSpell(host, presetName);
  await saveEvidence(host, "w3-08-combat-spell-complete");
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
    lifecycle: "actual Tauri Character -> Campaign PC preset save -> local Host session -> DM Library preset drop -> Combatant + weapon attack + damage spell -> DM Long Rest (+8h) -> UI session end -> process exit -> same Host data root restart -> Campaign continuity",
    endpoint: "127.0.0.1",
    characterName,
    presetName,
    campaignName,
    initialAbsoluteMinute,
    expectedRestartAbsoluteMinute: initialAbsoluteMinute + 480,
    combat,
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
