import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { createServer, Socket } from "node:net";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
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
const w1Only = process.argv.includes("--w1");
const w2Only = process.argv.includes("--w2");
const keepOpen = process.argv.includes("--keep-open");
const verificationSha = process.env.V1_VERIFICATION_SHA ?? process.env.W1_VERIFICATION_SHA ?? process.env.GITHUB_SHA ?? "local";

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
  let response;
  for (let attempt = 0; attempt < 50 && !response?.ok; attempt += 1) {
    try { response = await fetch("http://127.0.0.1:1420/"); } catch { await new Promise((resolve) => setTimeout(resolve, 100)); }
  }
  assert.ok(response?.ok, "Vite warm-up did not become HTTP-ready");
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
          target.scrollIntoView({ block:"center" });
          target.click();
          return { clicked:true, section:section.id, selectedBefore, textBefore };
        }
      }
      const unresolved = sections.filter((section) => section.querySelector(".create-status-pill")?.textContent?.trim() === "선택 필요").map((section) => section.id);
      return { clicked:false, unresolved };
    }, preferredLabels);
    if (!result.clicked) return result.unresolved;
    await browser.waitUntil(async () => browser.execute(({ sectionId, selectedBefore, textBefore }) => {
      const section = document.getElementById(sectionId);
      if (!section) return false;
      const selectedNow = section.querySelectorAll(".create-option-card.selected, .spell-choice-grid .spell-tile.selected, .proficiency-grid button.selected").length;
      return selectedNow > selectedBefore || section.textContent !== textBefore || section.querySelector(".create-status-pill")?.textContent?.trim() !== "선택 필요";
    }, { sectionId:result.section, selectedBefore:result.selectedBefore, textBefore:result.textBefore }), {
      timeout:15_000,
      timeoutMsg:`Character choice did not commit in ${result.section}`,
    });
  }
  throw new Error("Character choice completion exceeded 120 UI clicks");
}

async function chooseCharacterSource(browser, tab, name, preferredLabels = []) {
  await click(browser, `//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(tab)}]]`, `${tab} 탭`);
  const option = `//button[contains(@class,'create-option-card')][.//strong[normalize-space(.)=${JSON.stringify(name)}]]`;
  await click(browser, option, `${tab} ${name}`);
  await browser.waitUntil(async () => (await browser.$(option).getAttribute("class")).includes("selected"), {
    timeout:15_000,
    timeoutMsg:`${tab} ${name} selection did not commit`,
  });
  const unresolved = await completeVisibleCharacterChoices(browser, preferredLabels);
  assert.deepEqual(unresolved, [], `${tab} UI choices remain unresolved: ${unresolved.join(", ")}`);
}

async function openCharacterTab(browser, label, sectionId) {
  await click(browser, `//nav[contains(@class,'focused-create-tabs')]//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`, `${label} 탭`);
  await browser.$(`//section[@id=${JSON.stringify(sectionId)}]`).waitForDisplayed({ timeout:15_000 });
}

async function finishW1FighterDraft(instance, name, selectSources = false, source = {}) {
  const { speciesName = "인간", className = "파이터", backgroundName = "군인", preferredLabels = [] } = source;
  await openCharacterTab(instance.browser, "정체성", "identity");
  await replaceValue(instance.browser, labelControl("캐릭터 이름"), name, "캐릭터 이름");
  if (selectSources) {
    await chooseCharacterSource(instance.browser, "종족", speciesName, preferredLabels);
    await chooseCharacterSource(instance.browser, "클래스", className, preferredLabels);
    await chooseCharacterSource(instance.browser, "배경", backgroundName, preferredLabels);
  }
  for (const [tab,sectionId] of [["정체성","identity"],["종족","species"],["클래스","class"],["배경","background"]]) {
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
      tabs:[...document.querySelectorAll(".focused-create-tabs button")].map((button) => button.textContent?.trim()),
      validation:[...document.querySelectorAll(".validation.blocking")].map((item) => item.textContent?.trim()),
    }));
    throw new Error(`Character 저장 is disabled: ${JSON.stringify(diagnostics)}`);
  }
  await click(instance.browser, exactButton("모험 시작"), "Character 저장");
  await waitForText(instance.browser, name, 30_000);
}

async function createW1Character(instance, name) {
  await click(instance.browser, navButton("캐릭터"), "캐릭터 메뉴");
  await click(instance.browser, exactButton("새 캐릭터"), "새 캐릭터");
  await finishW1FighterDraft(instance,name,true);
}

async function latestCharacterDocument(dataRoot) {
  const directory = path.join(dataRoot, "character-library");
  const files = (await readdir(directory)).filter((name) => /^character-library\.\d+\.json$/.test(name));
  assert.ok(files.length > 0, "Character library did not write a durable generation");
  files.sort((left, right) => Number(right.match(/\d+/)?.[0]) - Number(left.match(/\d+/)?.[0]));
  return JSON.parse(await readFile(path.join(directory, files[0]), "utf8"));
}

function storedCharacterIdentity(document, name) {
  const record = document.characters.find((candidate) => candidate.source?.name === name);
  assert.ok(record, `Durable Character was not found: ${name}`);
  const sheet = record.materializedCache?.sheet;
  assert.ok(sheet, `Durable Character sheet was not materialized: ${name}`);
  return {
    id:record.characterId,
    name:sheet.name,
    className:sheet.className,
    species:sheet.species,
    background:sheet.background,
  };
}

async function runW105() {
  const dataRoot = path.join(runRoot, "w1", "data");
  const name = `W1 재시작 파이터 ${runId.slice(-6)}`;
  const first = await launchInstance("W1 Create", dataRoot, await reservePort());
  await createW1Character(first, name);
  await saveEvidence(first, "w1-05-created");
  const before = storedCharacterIdentity(await latestCharacterDocument(dataRoot), name);
  await stopInstance(first);

  const restarted = await launchInstance("W1 Restart", dataRoot, await reservePort());
  await click(restarted.browser, navButton("캐릭터"), "재시작 후 캐릭터 메뉴");
  await waitForText(restarted.browser, name, 30_000);
  const card = `//button[contains(@class,'character-card')][.//h2[normalize-space(.)=${JSON.stringify(name)}]]`;
  await restarted.browser.$(card).waitForDisplayed({ timeout:15_000 });
  const after = storedCharacterIdentity(await latestCharacterDocument(dataRoot), name);
  assert.deepEqual(after, before, "Character identity changed across real Tauri restart");
  await saveEvidence(restarted, "w1-05-restarted");
  await writeFile(path.join(artifactRoot, "w1-05.json"), JSON.stringify({
    gate:"W1-05",
    status:"PASS",
    verificationSha,
    windowsTauri:true,
    dataRoot,
    before,
    after,
  }, null, 2), "utf8");
  log(`W1-05 생성·저장·프로세스 종료·동일 data root 재시작 검증 통과 · ${before.id}`);
  return { instance:restarted,dataRoot,name,identity:after };
}

function characterArticle(name) {
  return `//article[contains(@class,'character-card-entry')][.//h2[normalize-space(.)=${JSON.stringify(name)}]]`;
}

async function runW106({ instance,dataRoot,name,identity }) {
  const duplicateName=`${name} 복제`;
  const importedName=`${name} 가져오기`;
  await click(instance.browser, `${characterArticle(name)}//button[normalize-space(.)='복제']`, "Character 복제");
  await finishW1FighterDraft(instance,duplicateName);

  await click(instance.browser,navButton("캐릭터"),"복제 저장 후 캐릭터 메뉴");
  await click(instance.browser, `//button[contains(@class,'character-card') and contains(@class,'utility')][.//h3[normalize-space(.)='JSON 가져오기']]`, "Character JSON 가져오기");
  const payload=JSON.stringify({name:importedName,className:"파이터",species:"인간",background:"군인",level:1});
  await replaceValue(instance.browser, "//section[contains(@class,'focused-import')]//textarea", payload, "Character JSON");
  await click(instance.browser, exactButton("가져와서 검토"), "Character JSON 검토");
  await instance.browser.$("//section[@id='review']").waitForDisplayed({ timeout:15_000 });
  await finishW1FighterDraft(instance,importedName);
  await click(instance.browser,navButton("캐릭터"),"가져오기 저장 후 캐릭터 메뉴");

  let document=await latestCharacterDocument(dataRoot);
  const original=storedCharacterIdentity(document,name);
  const duplicate=storedCharacterIdentity(document,duplicateName);
  const imported=storedCharacterIdentity(document,importedName);
  assert.equal(original.id,identity.id);
  assert.equal(new Set([original.id,duplicate.id,imported.id]).size,3,"new, duplicate, and import must own distinct Character IDs");
  for (const entry of [original,duplicate,imported]) {
    const record=document.characters.find((candidate)=>candidate.characterId===entry.id);
    assert.equal(record?.source.characterId,entry.id,"Character source provenance must remain record-local");
    assert.equal(record?.materializedCache?.sheet?.id,entry.id,"materialized Character identity must remain record-local");
  }

  const remove=`${characterArticle(duplicateName)}//button[normalize-space(.)='삭제']`;
  await instance.browser.$(remove).click();
  await instance.browser.acceptAlert();
  await instance.browser.waitUntil(async()=>!await instance.browser.$(characterArticle(duplicateName)).isExisting(),{
    timeout:15_000,timeoutMsg:"deleted Character remained visible",
  });
  document=await latestCharacterDocument(dataRoot);
  assert.equal(document.characters.some((record)=>record.characterId===duplicate.id),false);
  await saveEvidence(instance,"w1-06-lifecycle");
  await stopInstance(instance);

  const restarted=await launchInstance("W1 Library Restart",dataRoot,await reservePort());
  await click(restarted.browser,navButton("캐릭터"),"W1-06 재시작 후 캐릭터 메뉴");
  await waitForText(restarted.browser,name,30_000);
  await waitForText(restarted.browser,importedName,30_000);
  assert.equal(await restarted.browser.$(characterArticle(duplicateName)).isExisting(),false);
  const after=await latestCharacterDocument(dataRoot);
  assert.ok(after.characters.some((record)=>record.characterId===original.id));
  assert.ok(after.characters.some((record)=>record.characterId===imported.id));
  assert.equal(after.characters.some((record)=>record.characterId===duplicate.id),false);
  await saveEvidence(restarted,"w1-06-restarted");
  await writeFile(path.join(artifactRoot,"w1-06.json"),JSON.stringify({
    gate:"W1-06",status:"PASS",verificationSha,windowsTauri:true,
    original,duplicate,imported,deletedId:duplicate.id,remainingIds:after.characters.map((record)=>record.characterId),
  },null,2),"utf8");
  log(`W1-06 import·duplicate·delete·identity/provenance·재시작 검증 통과 · ${original.id}`);
  return { instance:restarted,dataRoot,name,identity:original };
}

function storedCharacterSheet(document,name) {
  const record=document.characters.find((candidate)=>candidate.source?.name===name);
  assert.ok(record?.materializedCache?.sheet,`Durable Character sheet was not found: ${name}`);
  return record.materializedCache.sheet;
}

function sheetCard(root,heading) {
  return `${root}//article[contains(@class,'sheet-play-card')][.//h2[normalize-space(.)=${JSON.stringify(heading)}]]`;
}

function visibleStoredResources(resources) {
  const ids=new Set(resources.map((resource)=>resource.id));
  return resources
    .filter((resource)=>resource.id!=="resource:fighter.action-surge.turn")
    .filter((resource)=>resource.id!=="resource.second-wind"||!ids.has("resource:fighter.second-wind"))
    .filter((resource)=>resource.id!=="resource.action-surge"||!ids.has("resource:fighter.action-surge"))
    .map((resource)=>resource.id==="resource:fighter.second-wind"?{...resource,label:"세컨드 윈드"}:resource.id==="resource:fighter.action-surge"?{...resource,label:"액션 서지"}:resource);
}

async function runW107({instance,dataRoot,name,identity}) {
  const stored=storedCharacterSheet(await latestCharacterDocument(dataRoot),name);
  const visibleResources=visibleStoredResources(stored.resources);
  assert.equal(stored.id,identity.id);
  assert.ok(visibleResources.length>0,"representative W1 Character must expose at least one resource");
  assert.ok(stored.items.length>0,"representative W1 Character must persist inventory");
  assert.ok(stored.features.length>0,"representative W1 Character must persist features");
  assert.ok(stored.attacks.length>0,"representative W1 Character must persist actions");
  assert.equal((stored.cantrips?.length??0)+(stored.preparedSpells?.length??0)+(stored.spellbookSpells?.length??0),0,"representative Fighter spell expectation changed");

  await click(instance.browser,`${characterArticle(name)}//button[contains(@class,'character-card')]`,"저장된 Character Full Sheet");
  const root="//div[contains(@class,'sheet-play-screen')]";
  await instance.browser.$(`${root}//h1[normalize-space(.)=${JSON.stringify(name)}]`).waitForDisplayed({timeout:15_000});
  const status=await instance.browser.$(`${root}//div[contains(@class,'sheet-play-statusbar')]`).getText();
  assert.match(status,new RegExp(`AC\\s*${stored.ac}(?!\\d)`));
  assert.match(status,new RegExp(`HP\\s*${stored.hp}/${stored.maxHp}(?!\\d)`));
  const resources=await instance.browser.$(sheetCard(root,"자원")).getText();
  for(const resource of visibleResources){assert.ok(resources.includes(resource.label));assert.ok(resources.includes(`${resource.current}/${resource.max}`));}
  const equipment=await instance.browser.$(sheetCard(root,"장비")).getText();
  for(const item of stored.equipment)assert.ok(equipment.includes(item),`Full Sheet equipment missing: ${item}`);
  const features=await instance.browser.$(sheetCard(root,"기능")).getText();
  for(const feature of stored.features)assert.ok(features.includes(feature),`Full Sheet feature missing: ${feature}`);
  const attacks=await instance.browser.$(sheetCard(root,"공격 & 피해")).getText();
  for(const attack of stored.attacks){assert.ok(attacks.includes(attack.name));assert.ok(attacks.includes(attack.damage));}
  assert.match(await instance.browser.$(sheetCard(root,"주문")).getText(),/주문 없음/);
  await saveEvidence(instance,"w1-07-full-sheet");

  await click(instance.browser,"//nav[@aria-label='캐릭터 관리 섹션']//button[normalize-space(.)='인벤토리']","Full Sheet 인벤토리");
  const inventory=`//section[@aria-label=${JSON.stringify(`${name} 인벤토리`)}]`;
  await instance.browser.$(inventory).waitForDisplayed({timeout:15_000});
  const inventoryText=await instance.browser.$(inventory).getText();
  for(const item of stored.items)assert.ok(inventoryText.includes(item.name),`Full Sheet inventory missing: ${item.name}`);
  assert.ok(inventoryText.includes(String(stored.goldGp??0)),"Full Sheet gold does not match durable Character");
  await saveEvidence(instance,"w1-07-inventory");
  await writeFile(path.join(artifactRoot,"w1-07.json"),JSON.stringify({
    gate:"W1-07",status:"PASS",verificationSha,windowsTauri:true,characterId:stored.id,
    expected:{hp:stored.hp,maxHp:stored.maxHp,ac:stored.ac,resources:visibleResources,equipment:stored.equipment,items:stored.items.map((item)=>({id:item.id,name:item.name,quantity:item.quantity})),spells:[],features:stored.features,actions:stored.attacks},
  },null,2),"utf8");
  log(`W1-07 durable Character와 Full Sheet HP·AC·resource·inventory·spells·features·actions 일치 검증 통과 · ${stored.id}`);
  return {instance,dataRoot,name,identity,stored};
}

function levelUpTab(label) {
  return `//nav[@aria-label='레벨업 단계']//button[.//span[normalize-space(.)=${JSON.stringify(label)}]]`;
}

async function runW108({instance,dataRoot,name,identity,stored:before}) {
  await click(instance.browser,"//nav[@aria-label='캐릭터 관리 섹션']//button[normalize-space(.)='개요 / 시트']","레벨 업 전 Full Sheet");
  await click(instance.browser,exactButton("레벨 업"),"대표 Character 레벨 업 진입");
  await instance.browser.$("//div[contains(@class,'levelup-v10')]").waitForDisplayed({timeout:15_000});
  await click(instance.browser,levelUpTab("HP"),"레벨 업 HP choice");
  const fixed="//div[contains(@class,'levelup-segmented')]//button[contains(normalize-space(.),'고정값')]";
  await click(instance.browser,fixed,"고정 HP choice");
  await instance.browser.waitUntil(async()=>(await instance.browser.$(fixed).getAttribute("class")??"").includes("active"),{timeout:15_000,timeoutMsg:"fixed HP choice did not commit"});
  await click(instance.browser,levelUpTab("검토"),"레벨 업 검토");
  await waitForText(instance.browser,"Blocking 없음",15_000);
  const commit="//footer[contains(@class,'levelup-v10-footer')]//button[contains(@class,'primary') and normalize-space(.)='레벨 업']";
  await instance.browser.$(commit).waitForEnabled({timeout:15_000});
  await saveEvidence(instance,"w1-08-review");
  await click(instance.browser,commit,"레벨 업 commit");

  const root="//div[contains(@class,'sheet-play-screen')]";
  await instance.browser.$(`${root}//h1[normalize-space(.)=${JSON.stringify(name)}]`).waitForDisplayed({timeout:30_000});
  const after=storedCharacterSheet(await latestCharacterDocument(dataRoot),name);
  assert.equal(after.id,identity.id,"level-up changed Character identity");
  assert.equal(after.level,before.level+1,"level-up did not persist the next level");
  assert.ok(after.maxHp>before.maxHp,"fixed HP choice did not increase maximum HP");
  const gainedFeatures=after.features.filter((feature)=>!before.features.includes(feature));
  assert.ok(gainedFeatures.some((feature)=>feature.includes("행동 폭증")),`Fighter level 2 feature missing: ${gainedFeatures.join(", ")}`);
  const gainedResources=visibleStoredResources(after.resources).filter((resource)=>!visibleStoredResources(before.resources).some((candidate)=>candidate.id===resource.id));
  assert.ok(gainedResources.some((resource)=>resource.label==="액션 서지"),`Fighter level 2 action resource missing: ${gainedResources.map((resource)=>resource.label).join(", ")}`);
  const features=await instance.browser.$(sheetCard(root,"기능")).getText();
  for(const feature of gainedFeatures)assert.ok(features.includes(feature),`level-up feature is not rendered: ${feature}`);
  const resources=await instance.browser.$(sheetCard(root,"자원")).getText();
  assert.ok(resources.includes("액션 서지"),"level-up action resource is not rendered");
  await saveEvidence(instance,"w1-08-committed");
  await stopInstance(instance);

  const restarted=await launchInstance("W1 Level Up Restart",dataRoot,await reservePort());
  await click(restarted.browser,navButton("캐릭터"),"레벨 업 재시작 후 캐릭터 메뉴");
  await click(restarted.browser,`${characterArticle(name)}//button[contains(@class,'character-card')]`,"레벨 업 Character 다시 열기");
  await restarted.browser.$(`${root}//h1[normalize-space(.)=${JSON.stringify(name)}]`).waitForDisplayed({timeout:15_000});
  const persisted=storedCharacterSheet(await latestCharacterDocument(dataRoot),name);
  assert.equal(persisted.id,after.id);
  assert.equal(persisted.level,after.level);
  assert.equal(persisted.maxHp,after.maxHp);
  for(const feature of gainedFeatures)assert.ok(persisted.features.includes(feature));
  assert.ok((await restarted.browser.$(sheetCard(root,"자원")).getText()).includes("액션 서지"));
  await saveEvidence(restarted,"w1-08-restarted");
  await writeFile(path.join(artifactRoot,"w1-08.json"),JSON.stringify({
    gate:"W1-08",status:"PASS",verificationSha,windowsTauri:true,characterId:after.id,
    choice:{hpMethod:"fixed",maxHpBefore:before.maxHp,maxHpAfter:after.maxHp},
    progression:{levelBefore:before.level,levelAfter:after.level,gainedFeatures,gainedResources:gainedResources.map((resource)=>({id:resource.id,label:resource.label,current:resource.current,max:resource.max}))},
    restart:{level:persisted.level,maxHp:persisted.maxHp,features:persisted.features},
  },null,2),"utf8");
  log(`W1-08 level-up choice·validation·commit·새 feature/action·동일 data root 재시작 검증 통과 · ${after.id}`);
}


const W2_ARCHETYPES = [
  { key:"martial", label:"martial", className:"파이터" },
  { key:"prepared-caster", label:"prepared caster", className:"위저드", caster:true },
  { key:"spontaneous-caster", label:"spontaneous caster", className:"소서러", caster:true },
  { key:"pact-caster", label:"pact caster", className:"워락", caster:true },
  { key:"shapeshifter", label:"shapeshifter", className:"드루이드", caster:true, levelTwo:true },
  { key:"healer", label:"healer", className:"클레릭", caster:true, preferredLabels:["상처 치료"], requiredSpell:"dnd.srd521.spell.cure-wounds" },
];

function w2SpellIds(sheet) {
  return [...new Set([
    ...(sheet.cantrips ?? []),
    ...(sheet.preparedSpells ?? []).map((id) => id.replace(/^always:/,"")),
    ...(sheet.spellbookSpells ?? []),
  ])];
}

function assertW2ArchetypeSheet(profile, sheet) {
  assert.equal(sheet.className,profile.className,`${profile.label}: durable class changed`);
  assert.ok(sheet.items.length > 0,`${profile.label}: durable inventory is empty`);
  assert.ok(sheet.features.length > 0,`${profile.label}: durable features are empty`);
  if (profile.caster) {
    assert.ok(w2SpellIds(sheet).length > 0,`${profile.label}: no acquired spell reached the durable sheet`);
    assert.ok(Object.values(sheet.spellSlotMaximums ?? {}).some((value) => value > 0) || (sheet.pactMagicSlotMaximum ?? 0) > 0,`${profile.label}: no spell-slot capacity reached the durable sheet`);
  } else {
    assert.ok(sheet.attacks.length > 0,`${profile.label}: no weapon action reached the durable sheet`);
  }
  if (profile.requiredSpell) assert.ok(w2SpellIds(sheet).includes(profile.requiredSpell),`${profile.label}: required healing spell is missing`);
  if (profile.levelTwo) {
    assert.equal(sheet.level,2,`${profile.label}: level-up did not persist`);
    assert.ok(sheet.resources.some((resource) => resource.label === "야생 변신" && resource.max > 0),`${profile.label}: Wild Shape resource is missing`);
  }
}

async function createW2Archetype(instance, profile, name) {
  await click(instance.browser,navButton("캐릭터"),`${profile.label} 캐릭터 메뉴`);
  await click(instance.browser,exactButton("새 캐릭터"),`${profile.label} 새 캐릭터`);
  await finishW1FighterDraft(instance,name,true,profile);
}

async function levelW2Shapeshifter(instance, dataRoot, name) {
  await click(instance.browser,navButton("캐릭터"),"shapeshifter 캐릭터 메뉴");
  await click(instance.browser,`${characterArticle(name)}//button[contains(@class,'character-card')]`,"shapeshifter Full Sheet");
  const root="//div[contains(@class,'sheet-play-screen')]";
  await instance.browser.$(`${root}//h1[normalize-space(.)=${JSON.stringify(name)}]`).waitForDisplayed({timeout:15_000});
  const before=storedCharacterSheet(await latestCharacterDocument(dataRoot),name);
  await click(instance.browser,exactButton("레벨 업"),"shapeshifter 레벨 업");
  await instance.browser.$("//div[contains(@class,'levelup-v10')]").waitForDisplayed({timeout:15_000});
  await click(instance.browser,levelUpTab("HP"),"shapeshifter HP choice");
  const fixed="//div[contains(@class,'levelup-segmented')]//button[contains(normalize-space(.),'고정값')]";
  await click(instance.browser,fixed,"shapeshifter fixed HP");
  await instance.browser.waitUntil(async()=>(await instance.browser.$(fixed).getAttribute("class")??"").includes("active"),{timeout:15_000,timeoutMsg:"shapeshifter fixed HP did not commit"});
  await click(instance.browser,levelUpTab("선택"),"shapeshifter progression choices");
  const unresolved=await completeVisibleCharacterChoices(instance.browser);
  assert.deepEqual(unresolved,[],`shapeshifter choices remain unresolved: ${unresolved.join(", ")}`);
  await click(instance.browser,levelUpTab("검토"),"shapeshifter level-up review");
  await waitForText(instance.browser,"Blocking 없음",15_000);
  const commit="//footer[contains(@class,'levelup-v10-footer')]//button[contains(@class,'primary') and normalize-space(.)='레벨 업']";
  await instance.browser.$(commit).waitForEnabled({timeout:15_000});
  await click(instance.browser,commit,"shapeshifter level-up commit");
  await instance.browser.$(`${root}//h1[normalize-space(.)=${JSON.stringify(name)}]`).waitForDisplayed({timeout:30_000});
  const after=storedCharacterSheet(await latestCharacterDocument(dataRoot),name);
  assert.equal(after.id,before.id);
  assert.equal(after.level,2);
  assert.ok(after.maxHp>before.maxHp);
}

async function verifyW2RenderedSheet(instance, profile, name, expected) {
  await click(instance.browser,navButton("캐릭터"),`${profile.label} restart 캐릭터 메뉴`);
  await click(instance.browser,`${characterArticle(name)}//button[contains(@class,'character-card')]`,`${profile.label} restart Full Sheet`);
  const root="//div[contains(@class,'sheet-play-screen')]";
  await instance.browser.$(`${root}//h1[normalize-space(.)=${JSON.stringify(name)}]`).waitForDisplayed({timeout:15_000});
  const stored=storedCharacterSheet(await latestCharacterDocument(instance.dataRoot),name);
  assert.equal(stored.id,expected.id,`${profile.label}: Character ID changed after restart`);
  assert.equal(stored.level,expected.level,`${profile.label}: level changed after restart`);
  assert.deepEqual(w2SpellIds(stored),expected.spells,`${profile.label}: spells changed after restart`);
  assert.deepEqual(stored.features,expected.features,`${profile.label}: features changed after restart`);
  assertW2ArchetypeSheet(profile,stored);

  const status=await instance.browser.$(`${root}//div[contains(@class,'sheet-play-statusbar')]`).getText();
  assert.match(status,new RegExp(`AC\\s*${stored.ac}(?!\\d)`));
  assert.match(status,new RegExp(`HP\\s*${stored.hp}/${stored.maxHp}(?!\\d)`));
  const features=await instance.browser.$(sheetCard(root,"기능")).getText();
  for(const feature of stored.features) assert.ok(features.includes(feature),`${profile.label}: rendered feature missing: ${feature}`);
  if (profile.caster) {
    const spells=await instance.browser.$(sheetCard(root,"주문")).getText();
    assert.doesNotMatch(spells,/주문 없음/,`${profile.label}: rendered spell card is empty`);
    if (profile.requiredSpell) assert.ok(spells.includes("상처 치료"),`${profile.label}: rendered healing spell is missing`);
  } else {
    const attacks=await instance.browser.$(sheetCard(root,"공격 & 피해")).getText();
    for(const attack of stored.attacks) assert.ok(attacks.includes(attack.name),`${profile.label}: rendered action missing: ${attack.name}`);
  }
  if (profile.levelTwo) {
    const resources=await instance.browser.$(sheetCard(root,"자원")).getText();
    assert.ok(resources.includes("야생 변신"),`${profile.label}: rendered Wild Shape resource is missing`);
  }
  await saveEvidence(instance,`w2-08-${profile.key}-restarted`);
  return stored;
}

async function runW208() {
  const dataRoot=path.join(runRoot,"w2","data");
  const created=await launchInstance("W2 Matrix Create",dataRoot,await reservePort());
  const expected=[];
  for(const profile of W2_ARCHETYPES) {
    const name=`W2 ${profile.label} ${runId.slice(-6)}`;
    await createW2Archetype(created,profile,name);
    if (profile.levelTwo) await levelW2Shapeshifter(created,dataRoot,name);
    const sheet=storedCharacterSheet(await latestCharacterDocument(dataRoot),name);
    assertW2ArchetypeSheet(profile,sheet);
    expected.push({
      key:profile.key,name,id:sheet.id,className:sheet.className,level:sheet.level,
      species:sheet.species,background:sheet.background,spells:w2SpellIds(sheet),
      features:[...sheet.features],resources:sheet.resources.map((resource)=>({id:resource.id,label:resource.label,current:resource.current,max:resource.max,recovery:resource.recovery})),
      items:sheet.items.map((item)=>({id:item.id,name:item.name,quantity:item.quantity})),
      actions:sheet.attacks.map((attack)=>({name:attack.name,damage:attack.damage})),
    });
    await saveEvidence(created,`w2-08-${profile.key}-created`);
  }
  await stopInstance(created);

  const restarted=await launchInstance("W2 Matrix Restart",dataRoot,await reservePort());
  const verified=[];
  for(const profile of W2_ARCHETYPES) {
    const before=expected.find((entry)=>entry.key===profile.key);
    assert.ok(before);
    const after=await verifyW2RenderedSheet(restarted,profile,before.name,before);
    verified.push({key:profile.key,id:after.id,className:after.className,level:after.level,spells:w2SpellIds(after),features:after.features});
  }
  await writeFile(path.join(artifactRoot,"w2-08.json"),JSON.stringify({
    gate:"W2-08",status:"PASS",verificationSha,windowsTauri:true,dataRoot,
    lifecycle:"production UI create -> acquire -> durable sheet -> process exit -> same data root restart -> rendered Full Sheet",
    expected,verified,
  },null,2),"utf8");
  log(`W2-08 six-archetype Windows Tauri lifecycle matrix 통과 · ${artifactRoot}`);
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

  if (w1Only) {
    const w105=await runW105();
    const w106=await runW106(w105);
    const w107=await runW107(w106);
    await runW108(w107);
    log(`W1 실제 Tauri 증거: ${artifactRoot}`);
    return;
  }
  if (w2Only) {
    await runW208();
    return;
  }

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

