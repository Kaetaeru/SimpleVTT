/**
 * Theatre of the Mind on one PC (SESSION_SCENARIOS.md SC-44..47): a new campaign opens in TotM mode; "+ 장면" makes
 * a scene with no grid; a goblin from the compendium and the player's character appear as icons; the player's ⚔
 * resolves without any distance; the DM's ⚔ opens the pre-roll dialog and "반드시 치명타" forces a crit; on the
 * player's turn the 벗어남 button on the goblin's icon asks the DM for an opportunity attack, which lands as a
 * reaction card; the turn panel (D97) shows the official actions on your turn. Writes 63-68 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-totm.mjs
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
const iconOf = (page, name) => page.locator(`.cl-scene-card[data-token-name="${name}"]`);
const cardOf = (page, head) => page.locator(".cl-chat-msg.action", { hasText: head });

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
  await dm.getByLabel("새 캠페인 이름").fill("여관 난투");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "여관 난투" }).waitFor();
  check((await dm.getByLabel("테이블 방식").inputValue()) === "totm", "a new campaign opens in TotM mode");
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });

  // SC-44: "+ 장면" → a scene without a grid on both screens; the goblin and the fighter are icons.
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await player.locator(".cl-scene").waitFor({ timeout: 10000 });
  check((await player.locator(".cl-page-bar").innerText()).includes("장면"), "the player's page bar says it is a scene");
  check(await player.locator(".cl-canvas-page").count() === 0, "no grid canvas on a scene");
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("goblin warrior");
  await dm.getByLabel("고블린 전사 캔버스에 놓기", { exact: true }).click();
  await iconOf(dm, "고블린 전사").waitFor({ timeout: 10000 });
  await iconOf(player, "고블린 전사").waitFor({ timeout: 10000 });
  check((await iconOf(player, "고블린 전사").innerText()).includes("10/10"), "the goblin's icon carries its own HP bar");
  await tab(dm, "채팅").click();
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
  await iconOf(dm, "앨리스의 파이터").waitFor({ timeout: 10000 });
  check(await player.locator(".cl-scene-row[aria-label='플레이어'] .cl-scene-card[data-token-name='앨리스의 파이터']").count() === 1, "the fighter is in the 플레이어 row");
  await tab(player, "채팅").click();

  // SC-45: the player's ⚔ on the goblin icon: no range, no distance on the card.
  await iconOf(player, "앨리스의 파이터").click();
  const playerBar = player.getByRole("toolbar", { name: "앨리스의 파이터 액션" });
  await playerBar.waitFor();
  await playerBar.getByRole("button", { name: /^⚔ 대검/ }).click();
  await player.locator(".cl-targeting-banner").waitFor();
  await iconOf(player, "고블린 전사").click();
  await player.locator(".cl-targeting-banner[data-picked='1']").waitFor({ timeout: 10000 });
  await player.screenshot({ path: path.join(OUT, "63-totm-scene-targeting.png") });
  await player.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  const head = "앨리스의 파이터 → 고블린 전사: 대검";
  await cardOf(dm, head).waitFor({ timeout: 15000 });
  await cardOf(player, head).waitFor({ timeout: 15000 });
  check(!/\d+ ft/.test(await cardOf(player, head).innerText()), "the card carries no distance");

  // SC-46: the DM's ⚔ opens the pre-roll dialog; 반드시 치명타 forces a crit.
  await iconOf(dm, "고블린 전사").click();
  const goblinBar = dm.getByRole("toolbar", { name: "고블린 전사 액션" });
  await goblinBar.waitFor();
  await goblinBar.getByRole("button", { name: /^⚔ 시미터/ }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-targeting-banner[data-picked='1']").waitFor({ timeout: 10000 });
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  await dm.getByLabel("반드시").waitFor({ timeout: 10000 });
  await dm.getByLabel("반드시").selectOption("crit");
  await dm.getByLabel("엄폐").selectOption("2");
  await dm.screenshot({ path: path.join(OUT, "64-totm-dm-preroll-dialog.png") });
  await dm.getByRole("button", { name: "공격", exact: true }).click();
  const head2 = "고블린 전사 → 앨리스의 파이터: 시미터";
  await cardOf(player, head2).waitFor({ timeout: 15000 });
  const critCard = await cardOf(player, head2).innerText();
  check(critCard.includes("치명타") && critCard.includes("엄폐 +2"), "the forced crit and the cover show on the player's card");

  // SC-47: on the player's turn, 벗어남 on the goblin's icon asks the DM; the DM's opportunity attack lands as a reaction.
  await dm.getByRole("button", { name: /^턴 트래커/ }).click();
  const tracker = dm.locator(".cl-window", { hasText: "턴 트래커" });
  await tracker.waitFor();
  await tracker.getByRole("button", { name: "전투 시작" }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await iconOf(dm, "고블린 전사").click();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-targeting-banner").getByRole("button", { name: "확정" }).click();
  await tracker.locator(".cl-tracker-row[data-turn-name='앨리스의 파이터']").waitFor({ timeout: 10000 });
  for (let n = 0; n < 3 && (await player.locator(".cl-scene-card.turn[data-token-name='앨리스의 파이터']").count()) === 0; n += 1) { await tracker.getByRole("button", { name: "▶ 다음 턴" }).click(); await player.waitForTimeout(400); }
  await player.locator(".cl-scene-card.turn[data-token-name='앨리스의 파이터']").waitFor({ timeout: 10000 });
  const leave = player.getByRole("button", { name: "고블린 전사에게서 벗어남" });
  await leave.waitFor({ timeout: 10000 });
  check(await player.getByRole("button", { name: "앨리스의 파이터에게서 벗어남" }).count() === 0, "no 벗어남 on one's own icon");
  await leave.click();
  const promptCard = dm.locator(".cl-chat-msg.prompt", { hasText: "벗어납니다" }).last();
  await promptCard.getByRole("button", { name: /⚔ 시미터/ }).waitFor({ timeout: 15000 });
  check(await player.locator(".cl-chat-msg.prompt", { hasText: "벗어납니다" }).getByRole("button").count() === 0, "the player's copy of the prompt has no buttons");
  await dm.screenshot({ path: path.join(OUT, "65-totm-opportunity-prompt-dm.png") });
  await promptCard.getByRole("button", { name: /⚔ 시미터/ }).click();
  const head3 = "시미터 · 기회 공격";
  await cardOf(player, head3).waitFor({ timeout: 15000 });
  await player.locator(".cl-chat-msg.prompt .cl-pill", { hasText: "기회 공격" }).waitFor({ timeout: 15000 });
  check(true, "the opportunity attack is a card on both screens and the prompt shows 기회 공격");
  await player.screenshot({ path: path.join(OUT, "66-totm-opportunity-attack-player.png") });

  // SC-48: it is the fighter's turn, so the player has the turn panel; 회피 leaves a card and a 🛡 mark; 턴 마침 passes the turn.
  const panel = player.getByRole("region", { name: "앨리스의 파이터의 턴" });
  await panel.waitFor({ timeout: 10000 });
  check(await dm.getByRole("region", { name: "앨리스의 파이터의 턴" }).count() === 0, "the DM has no panel for a player's character");
  check((await panel.innerText()).includes("질주") && (await panel.innerText()).includes("붙잡기"), "the panel lists the official actions");
  await panel.getByRole("button", { name: "회피", exact: true }).click();
  await player.locator(".cl-chat-msg.act", { hasText: "회피" }).waitFor({ timeout: 15000 });
  await iconOf(dm, "앨리스의 파이터").locator(".cl-marker[title='회피']").waitFor({ timeout: 15000 });
  check(true, "회피 lands as a card and a mark on the DM's screen");
  await panel.getByRole("button", { name: "영향" }).click();
  await player.getByLabel("기술").selectOption("intimidation");
  await player.getByRole("button", { name: "영향", exact: true }).last().click();
  await player.locator(".cl-chat-msg.act", { hasText: "위협" }).waitFor({ timeout: 15000 });
  check(true, "영향 asks for the skill and rolls it");
  await player.screenshot({ path: path.join(OUT, "67-turn-panel-player.png") });
  await panel.getByRole("button", { name: /턴 마침/ }).click();
  // SC-49: the goblin's turn belongs to no player, so the DM gets its panel; 붙잡기 targets the fighter and rolls its save.
  const dmPanel = dm.getByRole("region", { name: "고블린 전사의 턴" });
  // The round-counter row may sit between the two turns: the DM advances until the goblin's turn.
  for (let n = 0; n < 3 && (await dmPanel.count()) === 0; n += 1) { await dm.waitForTimeout(1200); if ((await dmPanel.count()) === 0) await tracker.getByRole("button", { name: "▶ 다음 턴" }).click(); }
  await dmPanel.waitFor({ timeout: 10000 });
  check(await player.getByRole("region", { name: "고블린 전사의 턴" }).count() === 0, "the player has no panel on the goblin's turn");
  // The tracker window opens over the panel: drag it down out of the way, as a DM would.
  const trackerHead = await tracker.locator(".cl-window-head").boundingBox();
  await dm.mouse.move(trackerHead.x + trackerHead.width / 2, trackerHead.y + trackerHead.height / 2);
  await dm.mouse.down();
  await dm.mouse.move(trackerHead.x + trackerHead.width / 2 + 60, trackerHead.y + 480, { steps: 8 });
  await dm.mouse.up();
  await dm.screenshot({ path: path.join(OUT, "68-turn-panel-dm-goblin.png") });
  await dmPanel.getByRole("button", { name: "붙잡기" }).click();
  await dm.locator(".cl-targeting-banner").waitFor();
  await iconOf(dm, "앨리스의 파이터").click();
  await dm.locator(".cl-chat-msg.act", { hasText: "붙잡기" }).waitFor({ timeout: 15000 });
  check((await dm.locator(".cl-chat-msg.act", { hasText: "붙잡기" }).last().innerText()).includes("내성"), "붙잡기 rolls the target's save against the DC");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
