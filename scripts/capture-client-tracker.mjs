/**
 * Tracker, compendium and targeting on one PC (SESSION_SCENARIOS.md SC-34..38): the DM drops a goblin from the
 * compendium (NPC + unlinked token), the player places their character; the DM presses 전투 시작, picks both
 * tokens in targeting mode, initiative cards land in chat and the tracker opens on the player's screen too; 다음 턴
 * moves the highlight and a round wraps; the action bar rolls a goblin attack; the NPC sheet shows the stat block.
 * Writes 53-58 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-tracker.mjs
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
const tokenOf = (page, name) => page.locator(`.cl-token[data-token-name="${name}"]`);
const reveal = async (locator) => { await locator.scrollIntoViewIfNeeded(); return locator.boundingBox(); };

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
  await dm.getByLabel("새 캠페인 이름").fill("전투 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "전투 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  // These scenarios exercise the grid table; a new campaign opens in TotM mode (D95), so switch it before launching.
  await dm.getByLabel("테이블 방식").selectOption("grid");
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });
  await dm.getByRole("button", { name: "+ 페이지" }).first().click();
  await player.locator(".cl-canvas-page").waitFor({ timeout: 10000 });

  // SC-34: the DM drops a goblin from the compendium: NPC in the journal (folder 괴물), unlinked token with 7/7.
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("goblin warrior");
  await dm.getByLabel("고블린 전사 캔버스에 놓기", { exact: true }).click();
  await tokenOf(dm, "고블린 전사").waitFor({ timeout: 10000 });
  const goblinBar = await tokenOf(dm, "고블린 전사").locator(".cl-token-bar small").first().innerText();
  check(goblinBar === "10/10", `the goblin token carries its own HP (${goblinBar})`);
  await tokenOf(player, "고블린 전사").waitFor({ timeout: 10000 });
  // The goblin is selected after placement: three arrow presses move it away from the page centre where the
  // player's token will land.
  for (let n = 0; n < 3; n += 1) await dm.keyboard.press("ArrowRight");
  await player.waitForFunction((name) => parseFloat(document.querySelector(`.cl-token[data-token-name="${name}"]`)?.style.left ?? "0") > 12 * 70, "고블린 전사", { timeout: 10000 });
  check(true, "arrow keys move the selected token (seen by the player)");
  await tab(dm, "저널").click();
  await dm.locator(".cl-journal-folder-head", { hasText: "괴물" }).waitFor();
  await dm.locator(".cl-journal-row", { hasText: "고블린 전사" }).click();
  const npcWindow = dm.locator(".cl-window", { hasText: "NPC · 고블린 전사" });
  await npcWindow.getByText(/방어도/).waitFor();
  check((await npcWindow.innerText()).includes("시미터"), "the NPC sheet shows the stat block with its actions");
  await dm.screenshot({ path: path.join(OUT, "53-compendium-goblin-npc-sheet.png") });
  await npcWindow.getByLabel("창 닫기").click();

  // SC-35: the player makes a character and places its token.
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
  await player.locator(".cl-window", { hasText: "앨리스의 파이터" }).locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await player.locator(".cl-window").last().getByLabel("창 닫기").click();
  await player.getByLabel("앨리스의 파이터 토큰 놓기").click();
  await tokenOf(dm, "앨리스의 파이터").waitFor({ timeout: 10000 });

  // SC-36: 전투 시작 → targeting mode → both tokens → initiative cards, tracker rows on both screens.
  await dm.getByRole("button", { name: /^턴 트래커/ }).click();
  const tracker = dm.locator(".cl-window", { hasText: "턴 트래커" });
  await tracker.waitFor();
  check(await player.locator(".cl-window", { hasText: "턴 트래커" }).count() === 0, "the player gets no tracker window (the ribbon shows the order once combat starts)");
  await tracker.getByRole("button", { name: "전투 시작" }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  const g = await reveal(tokenOf(dm, "고블린 전사"));
  await dm.mouse.click(g.x + g.width / 2, g.y + g.height / 2);
  const a = await reveal(tokenOf(dm, "앨리스의 파이터"));
  await dm.mouse.click(a.x + a.width / 2, a.y + a.height / 2);
  check((await dm.locator(".cl-targeting-banner").innerText()).includes("2개 선택"), "targeting mode counted two picks");
  await dm.screenshot({ path: path.join(OUT, "54-targeting-mode.png") });
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  await tracker.locator(".cl-tracker-row[data-turn-name='고블린 전사']").waitFor({ timeout: 10000 });
  await tracker.locator(".cl-tracker-row[data-turn-name='앨리스의 파이터']").waitFor({ timeout: 10000 });
  await player.locator(".cl-turn-ribbon .cl-turn-ribbon-item[data-turn-name='고블린 전사']").waitFor({ timeout: 10000 });
  await tab(dm, "채팅").click();
  check(await dm.locator(".cl-roll-card", { hasText: "이니셔티브" }).count() >= 2, "initiative rolls are chat cards");
  await dm.screenshot({ path: path.join(OUT, "55-tracker-after-initiative.png") });

  // SC-37: 다음 턴 highlights the token; going around wraps to 라운드 2 and the counter row shows 2.
  await tracker.getByRole("button", { name: "▶ 다음 턴" }).click();
  await dm.locator(".cl-token.turn").waitFor({ timeout: 10000 });
  await player.locator(".cl-token.turn").waitFor({ timeout: 10000 });
  check(true, "the current turn's token is highlighted on both screens");
  for (let n = 0; n < 3; n += 1) await tracker.getByRole("button", { name: "▶ 다음 턴" }).click();
  await tracker.getByText("라운드 2").waitFor({ timeout: 10000 });
  await dm.locator(".cl-chat-msg.system", { hasText: "라운드 2" }).waitFor({ timeout: 10000 });
  check(true, "a full round wraps to 라운드 2 (chat notes it)");
  await player.screenshot({ path: path.join(OUT, "56-tracker-player-round-2.png") });

  // SC-38: the token action bar: "⚔ 시미터" resolves against a target (R7, capture-client-attack.mjs); the plain
  // 피해 button next to it rolls the scimitar damage into chat; the player's bar shows their attacks.
  await reveal(tokenOf(dm, "고블린 전사"));
  await tokenOf(dm, "고블린 전사").click();
  const bar = dm.getByRole("toolbar", { name: "고블린 전사 액션" });
  await bar.waitFor();
  check(await bar.getByRole("button", { name: /^⚔ 시미터/ }).count() === 1, "the goblin's bar offers ⚔ 시미터 (rules resolution)");
  await bar.getByRole("button", { name: "피해" }).first().click();
  await dm.locator(".cl-roll-card", { hasText: "고블린 전사 · 시미터 피해" }).waitFor({ timeout: 15000 });
  await tab(player, "채팅").click();
  await player.locator(".cl-roll-card", { hasText: "고블린 전사 · 시미터 피해" }).waitFor({ timeout: 15000 });
  check(true, "the action bar's damage roll reaches chat on both screens");
  await dm.screenshot({ path: path.join(OUT, "57-action-bar-goblin.png") });
  await reveal(tokenOf(player, "앨리스의 파이터"));
  await tokenOf(player, "앨리스의 파이터").click();
  const playerBar = player.getByRole("toolbar", { name: "앨리스의 파이터 액션" });
  await playerBar.waitFor();
  check((await playerBar.innerText()).includes("이니셔티브") && (await playerBar.innerText()).includes("⚔"), "the player's action bar shows initiative and ⚔ attacks");
  await player.screenshot({ path: path.join(OUT, "58-action-bar-player.png") });
  await player.click(".cl-canvas-page", { position: { x: 5, y: 5 } }).catch(() => {});
  check(await player.getByRole("toolbar", { name: "고블린 전사 액션" }).count() === 0, "a player has no action bar for the goblin");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
