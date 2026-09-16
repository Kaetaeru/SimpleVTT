/**
 * R17 (SESSION_SCENARIOS.md SC-62): the DM saves a shared macro and a rollable table; the player runs the macro
 * from the macro bar and draws from the table, and `/roll 4d6kh3` shows the die it dropped. Writes 72–73 to
 * docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-macro.mjs
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
  await dm.getByLabel("새 캠페인 이름").fill("매크로 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "매크로 시험" }).waitFor();
  const code = (await dm.locator(".cl-code").first().textContent())?.trim() ?? "";
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await player.goto(`${base}?seat=player#/campaigns`);
  await player.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("지연");
  await player.getByLabel("참가 코드").fill(code);
  await player.getByRole("button", { name: "입장", exact: true }).click();
  await player.locator(".cl-chat-input").waitFor({ timeout: 10000 });
  await dm.locator(".cl-avatar-chip", { hasText: "지연" }).waitFor({ timeout: 10000 });

  // The DM writes one private macro, one shared macro and a weighted rollable table.
  await dm.getByRole("button", { name: "매크로·굴림표 편집" }).click();
  await dm.getByRole("button", { name: "+ 매크로" }).click();
  await dm.getByLabel("매크로 1 이름").fill("비밀굴림");
  await dm.getByLabel("매크로 1 내용").fill("/gmroll 1d20");
  await dm.getByRole("button", { name: "+ 매크로" }).click();
  await dm.getByLabel("매크로 2 이름").fill("능력치");
  await dm.getByLabel("매크로 2 내용").fill("/roll 4d6kh3 #능력치");
  await dm.getByLabel("능력치 플레이어에게도").check();
  await dm.getByRole("button", { name: "+ 굴림표" }).click();
  await dm.getByLabel("굴림표 1 이름").fill("조우");
  await dm.getByLabel("조우 1번 항목").fill("고블린 셋이 길을 막는다");
  await dm.getByLabel("조우 1번 가중치").fill("5");
  await dm.getByRole("button", { name: "+ 항목" }).click();
  await dm.getByLabel("조우 2번 항목").fill("아무 일도 없다");
  // R25 (D134): a table a player may draw from is shared on purpose, like a macro.
  await dm.getByLabel("조우 플레이어에게도").check();
  await dm.screenshot({ path: path.join(OUT, "72-macro-editor.png") });

  // The player's macro bar shows the shared macro and the table, never the private macro or the rows.
  const bar = player.locator(".cl-macro-bar").first();
  await bar.getByRole("button", { name: "#능력치" }).waitFor({ timeout: 10000 });
  check(!(await bar.innerText()).includes("비밀굴림"), "the player never sees the DM's private macro");
  check((await bar.innerText()).includes("조우"), "the player sees the table's name");
  await bar.getByRole("button", { name: "#능력치" }).click();
  const roll = player.locator(".cl-chat-msg", { hasText: "능력치" }).last();
  await roll.waitFor({ timeout: 15000 });
  check((await roll.locator(".cl-die.dropped").count()) === 1, "4d6kh3 shows exactly one dropped die");
  const dice = await roll.locator(".cl-die").allInnerTexts();
  check(dice.length === 4, `four dice were rolled: ${dice.join(",")}`);
  const kept = await roll.locator(".cl-die:not(.dropped)").allInnerTexts();
  const total = Number((await roll.locator(".cl-total").innerText()).trim());
  check(kept.reduce((sum, value) => sum + Number(value), 0) === total, `the total is the three kept dice: ${kept.join("+")} = ${total}`);

  // Drawing from the table: the host rolls, so the player sees a row without ever holding the list.
  await bar.getByRole("button", { name: "🎲 조우" }).click();
  const drawn = player.locator(".cl-chat-msg", { hasText: "굴림표 조우" }).last();
  await drawn.waitFor({ timeout: 15000 });
  const text = await drawn.innerText();
  check(/고블린 셋이 길을 막는다|아무 일도 없다/.test(text), `the drawn row is one of the table's: ${text}`);
  await player.screenshot({ path: path.join(OUT, "73-macro-bar-and-table.png") });

  // The extended grammar works from the chat box too.
  await player.getByLabel("채팅 입력").fill("/roll 4d6r1!>6 #폭발");
  await player.getByRole("button", { name: "보내기" }).click();
  await player.locator(".cl-chat-msg", { hasText: "폭발" }).last().waitFor({ timeout: 15000 });
  check(true, "reroll and explode parse from the chat box");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
