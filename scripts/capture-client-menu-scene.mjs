/**
 * R22 (SESSION_SCENARIOS.md SC-64): the right-click menu is not trapped in the board, and a scene can be deleted.
 *
 * The board is a clipped box, so a menu drawn inside it lost everything past its bottom edge — right-clicking a
 * token low on a short window hid 삭제 with no way to reach it. The menu now sits on the window and flips above the
 * pointer when it has to. The scene menu grew a 장면 삭제 that the last scene refuses. Writes 75–76.
 *
 *   node scripts/capture-client-menu-scene.mjs
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
const iconOf = (page, name) => page.locator(`.cl-scene-card[data-token-name="${name}"]`);

try {
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  // A short window, so the board is short and the tall token menu cannot fit below a low icon.
  const context = await browser.newContext({ viewport: { width: 1280, height: 640 }, locale: "ko-KR" });
  const dm = await context.newPage();
  dm.on("pageerror", (e) => { failures.push(`page error: ${e.message}`); console.error("page error:", e.message); });
  dm.on("dialog", (dialog) => void dialog.accept());
  await dm.goto(`${base}#/campaigns`);
  await dm.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await dm.getByLabel("새 캠페인 이름").fill("메뉴 시험");
  await dm.getByRole("button", { name: "새 캠페인" }).click();
  await dm.getByRole("heading", { name: "메뉴 시험" }).waitFor();
  await dm.getByRole("button", { name: "게임 시작" }).click();
  await dm.locator(".cl-chat-input").waitFor();
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await dm.locator(".cl-scene").waitFor({ timeout: 10000 });

  // Six goblins, so the grid wraps and the last ones sit low on a short board.
  await tab(dm, "컴펜디움").click();
  await dm.getByLabel("컴펜디움 검색").fill("goblin warrior");
  for (let n = 0; n < 6; n += 1) await dm.getByLabel("고블린 전사 캔버스에 놓기", { exact: true }).click();
  await tab(dm, "채팅").click();
  const last = dm.locator(".cl-scene-card").last();
  await last.waitFor({ timeout: 10000 });
  const name = await last.getAttribute("data-token-name");
  const before = await dm.locator(".cl-scene-card").count();

  // Right-click the lowest icon: the menu must land whole inside the window, above the pointer if need be.
  const box = await last.boundingBox();
  await last.click({ button: "right" });
  const menu = dm.locator(".cl-token-menu");
  await menu.waitFor({ timeout: 5000 });
  const rect = await menu.boundingBox();
  const view = await dm.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  check(rect.y >= 0 && rect.y + rect.height <= view.height + 1, `the menu fits the window vertically (top ${Math.round(rect.y)}, bottom ${Math.round(rect.y + rect.height)}, window ${view.height})`);
  check(rect.x >= 0 && rect.x + rect.width <= view.width + 1, `and horizontally (left ${Math.round(rect.x)}, right ${Math.round(rect.x + rect.width)}, window ${view.width})`);
  check(rect.y < box.y + box.height, "it opened upward from a low icon");
  await dm.screenshot({ path: path.join(OUT, "75-token-menu-fits.png") });
  // The proof it is reachable: press 삭제 and the token is gone.
  await menu.getByRole("button", { name: "삭제", exact: true }).click();
  await dm.waitForFunction((count) => document.querySelectorAll(".cl-scene-card").length === count - 1, before, { timeout: 5000 });
  check(true, `삭제 on a low icon works (${name} is gone)`);
  check((await dm.locator(".cl-token-menu").count()) === 0, "and the menu closed");

  // A second scene, then delete the first one from ⋯.
  await dm.getByRole("button", { name: "+ 장면" }).first().click();
  await dm.waitForFunction(() => document.querySelectorAll(".cl-page-chip").length === 2, null, { timeout: 5000 });
  const names = await dm.locator(".cl-page-chip").allInnerTexts();
  await dm.getByRole("button", { name: "⋯" }).click();
  const sceneMenu = dm.locator(".cl-dd-menu");
  await sceneMenu.waitFor();
  const menuRect = await sceneMenu.boundingBox();
  check(menuRect.y + menuRect.height <= view.height + 1, "the scene menu fits the window too");
  await dm.screenshot({ path: path.join(OUT, "76-scene-menu-delete.png") });
  await sceneMenu.getByRole("menuitem", { name: /장면 삭제/ }).click();
  await dm.waitForFunction(() => document.querySelectorAll(".cl-page-chip").length === 1, null, { timeout: 5000 });
  check(true, `the scene was deleted (${names.length} scenes → one left)`);

  // The last scene refuses to go: the table needs somewhere to be.
  await dm.getByRole("button", { name: "⋯" }).click();
  const lastItem = dm.locator(".cl-dd-menu").getByRole("menuitem", { name: /장면 삭제/ });
  await lastItem.waitFor();
  check(await lastItem.isDisabled(), "the last scene cannot be deleted");
  await dm.keyboard.press("Escape");

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
