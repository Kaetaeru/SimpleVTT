/**
 * R23 (SESSION_SCENARIOS.md SC-66): the bonus action is spent when a bonus-action feature is used.
 *
 * Attacks, actions and spells already told the table what they cost, but a feature is used on the sheet — so the
 * fighter's 재기의 바람 left the 추가 행동 chip lit and the bonus action looked unused. Writes 78.
 *
 *   node scripts/capture-client-economy.mjs
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { connect } from "node:net";
import path from "node:path";
const require = createRequire(import.meta.url);
function loadPlaywright() { for (const candidate of [process.env.PLAYWRIGHT_MODULE, "playwright", "/opt/node22/lib/node_modules/playwright"].filter(Boolean)) { try { return require(candidate); } catch { /* next */ } } throw new Error("playwright not found"); }
const { chromium } = loadPlaywright();

const PORT = 1430;
const portOpen = (port) => new Promise((resolve) => { const socket = connect(port, "127.0.0.1"); socket.once("connect", () => { socket.end(); resolve(true); }); socket.once("error", () => resolve(false)); });
let server = null;
if (!(await portOpen(PORT))) { server = spawn(process.execPath, [path.resolve("node_modules/vite/bin/vite.js"), "--config", "vite.client.config.ts", "--port", String(PORT), "--strictPort"], { stdio: "ignore", detached: true }); for (let i = 0; i < 100 && !(await portOpen(PORT)); i++) await new Promise((r) => setTimeout(r, 300)); }
const OUT = path.resolve("docs/evidence/new-client-m1");
const base = `http://127.0.0.1:${PORT}/`;
const failures = [];
const check = (condition, message) => { if (!condition) { failures.push(message); console.error("FAIL:", message); } else console.log("ok:", message); };
const tab = (page, name) => page.getByRole("tab", { name: new RegExp(`^${name}`) });
/** The economy chip by its label, and whether it reads as spent. */
const chipUsed = async (page, label) => (await page.locator(`.cl-econ:has-text("${label}")`).first().getAttribute("class"))?.includes("used") ?? false;

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const context = await browser.newContext({ viewport: { width: 1500, height: 960 }, locale: "ko-KR" });
  const dm = await context.newPage();
  const player = await context.newPage();
  for (const [label, page] of [["dm", dm], ["player", player]]) {
    page.on("pageerror", (e) => { failures.push(`${label} page error: ${e.message}`); console.error(`${label} page error:`, e.message); });
    page.on("dialog", (dialog) => void dialog.accept());
  }
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("행동 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "행동 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await player.locator(".cl-scene").waitFor({ timeout: 10000 });

  // A level 3 fighter: 재기의 바람 is a bonus action.
  await tab(player, "저널").click();
  await player.getByRole("button", { name: "+ 캐릭터" }).click();
  const wizard = player.locator(".cl-window").last();
  await wizard.getByLabel("이름").fill("지연의 파이터");
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
  await player.locator(".cl-window", { hasText: "지연의 파이터" }).locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await player.locator(".cl-window").last().getByLabel("창 닫기").click();
  await player.getByLabel("지연의 파이터 토큰 놓기").click();
  await player.locator('.cl-scene-card[data-token-name="지연의 파이터"]').waitFor({ timeout: 10000 });
  await tab(player, "채팅").click();

  // Into initiative, so there is a turn to spend.
  await player.locator('.cl-scene-card[data-token-name="지연의 파이터"]').click();
  const bar = player.getByRole("toolbar", { name: "지연의 파이터 액션" });
  await bar.waitFor();
  await bar.getByRole("button", { name: /^이니셔티브/ }).click();
  // The DM starts the round, so the fighter's turn is the current one and its economy shows.
  await dm.getByRole("button", { name: /^턴 트래커/ }).click();
  await dm.locator(".cl-tracker").waitFor();
  await dm.locator(".cl-tracker-row").first().waitFor({ timeout: 10000 });
  await dm.locator(".cl-tracker").getByRole("button", { name: "▶ 다음 턴" }).click();
  await player.locator(".cl-turn-econ").waitFor({ timeout: 10000 });
  check(!(await chipUsed(player, "추가 행동")), "the turn starts with the bonus action in hand");
  check(!(await chipUsed(player, "행동")), "and the action too");

  // 재기의 바람 on the 추가 행동 row: a bonus action, so the chip must go out.
  // R65 (D200): it is a button on the row now, with its uses beside it, not an entry in a menu.
  check((await bar.getByRole("button", { name: /^재기의 바람/ }).innerText()).includes("2/2"), "the row shows 재기의 바람 with its uses");
  await bar.getByRole("button", { name: /^재기의 바람/ }).click();
  await player.waitForFunction(() => { const chip = [...document.querySelectorAll(".cl-econ")].find((item) => item.textContent?.includes("추가 행동")); return chip?.className.includes("used") ?? false; }, null, { timeout: 10000 });
  check(true, "using 재기의 바람 spends the bonus action");
  check(!(await chipUsed(player, "행동")), "and leaves the action alone");
  await bar.getByRole("button", { name: /^재기의 바람/ }).filter({ hasText: "1/2" }).waitFor({ timeout: 10000 });
  check(true, "and the button counts the use");
  await player.screenshot({ path: path.join(OUT, "78-bonus-action-spent.png") });

  // Coming round to this turn again hands the economy back.
  await dm.locator(".cl-tracker").getByRole("button", { name: "▶ 다음 턴" }).click();
  await player.waitForFunction(() => { const chip = [...document.querySelectorAll(".cl-econ")].find((item) => item.textContent?.includes("추가 행동")); return chip ? !chip.className.includes("used") : true; }, null, { timeout: 10000 });
  check(true, "the next turn hands the bonus action back");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
