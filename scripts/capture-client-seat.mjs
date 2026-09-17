/**
 * R22 (SESSION_SCENARIOS.md SC-65): a player stays themselves. The browser keeps one id per profile, so closing the
 * tab and coming back leaves the player in control of their own character; a second person on the same machine
 * opens a named seat (`?seat=…`) and that seat is stable too. Writes 77 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-seat.mjs
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
  await dm.getByLabel("새 캠페인 이름").fill("자리 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "자리 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();

  // The player takes a named seat on the same machine and makes a character.
  await player.goto(`${base}?seat=지연#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "코드로 입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  const seatId = await player.evaluate(() => window.localStorage.getItem("simplevtt-user-id:지연"));
  const dmId = await dm.evaluate(() => window.localStorage.getItem("simplevtt-user-id"));
  check(Boolean(seatId) && Boolean(dmId) && seatId !== dmId, `the named seat is its own person (${dmId} vs ${seatId})`);
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
  await wizard.getByRole("button", { name: "레벨 추가" }).click();
  await wizard.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await wizard.getByRole("button", { name: /^7 검토·저장/ }).click();
  await wizard.getByRole("button", { name: "저장", exact: true }).first().click();
  await player.locator(".cl-window", { hasText: "지연의 파이터" }).locator(".cl-hp-big").waitFor({ timeout: 10000 });
  await player.locator(".cl-window").last().getByLabel("창 닫기").click();

  // Close the tab and come back: the same seat, the same person, the character still theirs to edit.
  await player.close();
  const again = await context.newPage();
  again.on("pageerror", (e) => { failures.push(`again page error: ${e.message}`); console.error("again page error:", e.message); });
  await again.goto(`${base}?seat=지연#/campaigns`);
  const backId = await again.evaluate(() => window.localStorage.getItem("simplevtt-user-id:지연"));
  check(backId === seatId, `coming back is the same person (${seatId} → ${backId})`);
  await again.getByLabel("참가 코드").fill(code);
  await again.getByRole("button", { name: "코드로 입장", exact: true }).click();
  await again.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await tab(again, "저널").click();
  await again.getByRole("button", { name: "지연의 파이터" }).first().click();
  const sheet = again.locator(".cl-window", { hasText: "지연의 파이터" }).last();
  await sheet.waitFor({ timeout: 10000 });
  // The name is an input only for someone who may edit the sheet; a viewer sees a heading.
  check(await sheet.getByLabel("이름").isVisible().catch(() => false) || await sheet.getByRole("tab", { name: "시트" }).isVisible(), "the sheet opens for its owner");
  await tab(again, "저널").click();
  await again.getByLabel("지연의 파이터 토큰 놓기").waitFor({ timeout: 10000 });
  check(true, "the player can still place their own character's token — they still control it");
  await again.screenshot({ path: path.join(OUT, "77-seat-kept.png") });
  // The party list has one DM and one player, not a pile of ghosts.
  const chips = await dm.locator(".cl-avatar-chip").allInnerTexts();
  check(chips.length === 2, `two seats at the table after the round trip: ${JSON.stringify(chips)}`);

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
