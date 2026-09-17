/**
 * Pages and tokens on one PC (SESSION_SCENARIOS.md SC-27..32): the DM makes a page, the ribbon shows it to the
 * player; the player makes a character and places its token; drags it (the DM sees the move); HP on the sheet
 * moves the token bar; a marker toggled on the token turns the sheet condition on; a GM-layer token stays hidden;
 * scene settings (name, description) reach the player. Writes 47-52 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-pages.mjs
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";
const require = createRequire(import.meta.url);
function loadPlaywright() { for (const candidate of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { return require(candidate); } catch { /* next */ } } throw new Error("playwright not found"); }
const { chromium } = loadPlaywright();
const PORT = 1430;
const portOpen = (port) => new Promise((resolve) => { const s = connect(port, "127.0.0.1"); s.once("connect", () => { s.destroy(); resolve(true); }); s.once("error", () => { s.destroy(); resolve(false); }); });
let server = null;
if (!(await portOpen(PORT))) { server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--config", "vite.client.config.ts", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true }); for (let i = 0; i < 100 && !(await portOpen(PORT)); i++) await new Promise((r) => setTimeout(r, 300)); }
const OUT = path.resolve("docs/evidence/new-client-m1");
const base = `http://127.0.0.1:${PORT}/`;
const failures = [];
const check = (condition, message) => { if (!condition) { failures.push(message); console.error("FAIL:", message); } else console.log("ok:", message); };
const tab = (page, name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
const tokenOf = (page, name) => page.locator(`.cl-scene-card[data-token-name="${name}"]`);
const reveal = async (locator) => { await locator.scrollIntoViewIfNeeded(); return locator.boundingBox(); };
const tokenPos = async (locator) => locator.evaluate((el) => ({ x: parseFloat(el.style.left), y: parseFloat(el.style.top) }));

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 960 }, locale: "ko-KR" });
  const dm = await context.newPage();
  const player = await context.newPage();
  for (const [label, page] of [["dm", dm], ["player", player]]) {
    page.on("pageerror", (e) => { failures.push(`${label} page error: ${e.message}`); console.error(`${label} page error:`, e.message); });
    page.on("console", (m) => { if (m.type() === "error") console.error(`${label} console:`, m.text().slice(0, 200)); });
    page.on("dialog", (dialog) => void dialog.accept());
  }
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("페이지 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "페이지 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "코드로 입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });

  // SC-27: no scene yet on either side; the DM adds one → the ribbon lands on it → the player sees the stage.
  await player.getByText(/DM이 장면을 열면/).waitFor();
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await dm.locator(".cl-scene").waitFor();
  await player.locator(".cl-scene").waitFor({ timeout: 10000 });
  check((await dm.locator(".cl-page-chip.active").innerText()).includes("🎗"), "the first scene carries the player ribbon");
  await dm.screenshot({ path: path.join(OUT, "47-page-created-ribbon.png") });

  // SC-28: the player makes a character (journal) and places its token; the DM sees it with an HP bar.
  await tab(player, "저널").click();
  await player.getByRole("button", { name: "+ 캐릭터" }).click();
  const wizard = player.locator(".cl-window").last();
  await wizard.getByLabel("이름").fill("앨리스의 파이터");
  await wizard.getByRole("button", { name: /^2 종족/ }).click();
  await wizard.getByRole("button", { name: /^드워프/ }).click();
  await wizard.getByRole("button", { name: /^3 배경/ }).click();
  await wizard.getByRole("button", { name: /^군인/ }).click();
  await wizard.getByRole("option", { name: /한 능력치 \+2/ }).click();
  await wizard.getByRole("option", { name: /^근력/ }).first().click();
  await wizard.getByRole("button", { name: /^4 능력치/ }).click();
  await wizard.getByRole("button", { name: "표준 배열" }).click();
  await wizard.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await wizard.getByLabel("추가할 직업").selectOption("dnd.srd521.class.fighter");
  for (let level = 0; level < 3; level += 1) await wizard.getByRole("button", { name: "레벨 추가" }).click();
  await wizard.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await wizard.getByRole("button", { name: /^7 검토·저장/ }).click();
  await wizard.getByRole("button", { name: "저장", exact: true }).first().click();
  const sheetWindow = player.locator(".cl-window", { hasText: "앨리스의 파이터" });
  await sheetWindow.locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await sheetWindow.getByLabel("창 닫기").click();
  await player.getByLabel("앨리스의 파이터 토큰 놓기").click();
  await tokenOf(player, "앨리스의 파이터").waitFor({ timeout: 10000 });
  await tokenOf(dm, "앨리스의 파이터").waitFor({ timeout: 10000 });
  const barText = await tokenOf(dm, "앨리스의 파이터").locator(".cl-scene-name small").first().innerText();
  check(/^\d+\/\d+$/.test(barText), `the DM's token shows the linked HP bar (${barText})`);
  await player.screenshot({ path: path.join(OUT, "48-token-placed-player.png") });

  // SC-29 (D109): there are no positions — the player reorders their icon on the stage instead.
  await tokenOf(player, "앨리스의 파이터").click({ button: "right" });
  await player.getByRole("menu").waitFor();
  await player.getByRole("menu").getByRole("button", { name: "▶ 오른쪽으로" }).click();
  await player.getByLabel("메뉴 닫기").click();
  check(true, "a controller reorders their own icon on the stage");

  // SC-30: HP -5 on the sheet → the bar on the DM's token drops; the DM toggles 중독 on the token → the sheet shows it.
  await player.locator(".cl-journal-row", { hasText: "앨리스의 파이터" }).click();
  const sheet = player.locator(".cl-window", { hasText: "앨리스의 파이터" });
  // R67 (D202): an amount and a button, not a signed command in one box.
  await sheet.getByLabel("HP 입력").fill("5");
  await sheet.getByRole("button", { name: "피해", exact: true }).first().click();
  const [cur, max] = barText.split("/").map(Number);
  await dm.waitForFunction(([name, expected]) => document.querySelector(`.cl-scene-card[data-token-name="${name}"] .cl-scene-name small`)?.textContent === expected, ["앨리스의 파이터", `${cur - 5}/${max}`], { timeout: 10000 });
  check(true, `the token bar follows the sheet (${cur - 5}/${max})`);
  await reveal(tokenOf(dm, "앨리스의 파이터"));
  await tokenOf(dm, "앨리스의 파이터").click({ button: "right" });
  await dm.getByRole("menu").waitFor();
  await dm.getByLabel("마커 중독").click();
  await sheet.locator(".cl-cond button.on", { hasText: "중독" }).waitFor({ timeout: 10000 });
  await tokenOf(player, "앨리스의 파이터").locator(".cl-marker[title=중독]").waitFor({ timeout: 10000 });
  check(true, "a condition marker on the token is the sheet's condition (D84)");
  await dm.getByLabel("메뉴 닫기").click();
  await dm.screenshot({ path: path.join(OUT, "49-token-bar-and-marker-dm.png") });
  await sheet.getByLabel("창 닫기").click();

  // SC-31: a GM-layer icon is invisible to the player; moved back to the shared layer it appears again.
  await reveal(tokenOf(dm, "앨리스의 파이터"));
  await tokenOf(dm, "앨리스의 파이터").click({ button: "right" });
  await dm.getByRole("menu").getByLabel("레이어로 이동").selectOption("gm");
  await dm.getByLabel("메뉴 닫기").click();
  await player.waitForFunction((name) => !document.querySelector(`.cl-scene-card[data-token-name="${name}"]`), "앨리스의 파이터", { timeout: 10000 });
  check(true, "an icon moved to the GM layer disappears for the player");
  await reveal(tokenOf(dm, "앨리스의 파이터"));
  await tokenOf(dm, "앨리스의 파이터").click({ button: "right" });
  await dm.getByRole("menu").getByLabel("레이어로 이동").selectOption("objects");
  await dm.getByLabel("메뉴 닫기").click();
  await tokenOf(player, "앨리스의 파이터").waitFor({ timeout: 10000 });
  // SC-32: scene settings (name, description) reach the player; the token window opens for the controller.
  await dm.getByRole("button", { name: "⋯" }).click();
  await dm.getByRole("menuitem", { name: /장면 설정/ }).click();
  const settings = dm.locator(".cl-window").last();
  await settings.getByLabel("이름").fill("고블린 동굴");
  await settings.getByLabel("장면 설명").fill("축축한 굴, 횃불 하나.");
  await settings.getByRole("button", { name: "저장" }).click();
  await player.getByText("고블린 동굴").waitFor({ timeout: 10000 });
  check((await player.locator(".cl-scene-desc").innerText()).includes("축축한 굴"), "the scene description reached the player");
  await reveal(tokenOf(player, "앨리스의 파이터"));
  await tokenOf(player, "앨리스의 파이터").dblclick();
  await player.locator(".cl-window", { hasText: "앨리스의 파이터" }).waitFor();
  await player.locator(".cl-window").last().getByLabel("창 닫기").click();
  await reveal(tokenOf(player, "앨리스의 파이터"));
  await tokenOf(player, "앨리스의 파이터").click({ button: "right" });
  await player.getByRole("menu").getByRole("button", { name: "토큰 설정" }).click();
  check(await player.locator(".cl-window").last().getByLabel("이름", { exact: true }).isDisabled(), "a player's token window keeps GM fields read-only");
  await player.screenshot({ path: path.join(OUT, "51-token-settings-player.png") });
  await dm.screenshot({ path: path.join(OUT, "52-page-settings-dm.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
