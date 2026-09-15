/**
 * R21 (SESSION_SCENARIOS.md SC-63): a campaign made in one browser tab, launched from another. The second tab has
 * its own session id, so the campaign's stored owner is not this user — the host used to land at their own table
 * as a plain player. The host seat is the DM. Writes 74 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-host-dm.mjs
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

  // Tab one makes the campaign and closes. Its user id lived in that tab's sessionStorage and goes with it.
  const first = await context.newPage();
  first.on("pageerror", (e) => { failures.push(`first page error: ${e.message}`); });
  await first.goto(`${base}#/campaigns`);
  await first.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  await first.getByLabel("새 캠페인 이름").fill("어제 만든 캠페인");
  await first.getByRole("button", { name: "새 캠페인" }).click();
  await first.getByRole("heading", { name: "어제 만든 캠페인" }).waitFor();
  const firstId = await first.evaluate(() => window.sessionStorage.getItem("simplevtt-user-id") ?? "?");
  await first.close();

  // Tab two is a new session: same browser profile (so the campaign is in IndexedDB), a brand-new user id.
  const second = await context.newPage();
  second.on("pageerror", (e) => { failures.push(`second page error: ${e.message}`); console.error("second page error:", e.message); });
  second.on("dialog", (dialog) => void dialog.accept());
  await second.goto(`${base}#/campaigns`);
  await second.getByLabel("내 이름 (테이블에서 보이는 이름)").fill("DM 민수");
  const secondId = await second.evaluate(() => window.sessionStorage.getItem("simplevtt-user-id") ?? "?");
  check(Boolean(firstId) && firstId !== secondId, `the new tab has its own user id (${firstId} → ${secondId})`);
  const card = second.locator(".cl-card.clickable", { hasText: "어제 만든 캠페인" });
  await card.waitFor({ timeout: 10000 });
  check(true, "the campaign made in the other tab is still listed");
  await card.click();
  await second.getByRole("button", { name: "게임 시작" }).click();
  await second.locator(".cl-chat-input").waitFor({ timeout: 10000 });

  // The DM controls are the proof: the tracker button, the clock's rest buttons and the scene tools are GM-only.
  await second.getByRole("button", { name: /^턴 트래커/ }).waitFor({ timeout: 10000 });
  check(true, "the host sees the DM's 턴 트래커 button");
  check(await second.getByRole("button", { name: "긴 휴식" }).isVisible(), "the host sees the DM's rest controls, not a player's 제안 buttons");
  check(!(await second.getByRole("button", { name: "긴 휴식 제안" }).isVisible().catch(() => false)), "and not the player's ask buttons");
  await second.getByRole("button", { name: "+ 장면" }).first().waitFor({ timeout: 10000 });
  check(true, "the host can make a scene");
  // The party list shows exactly one DM: this tab, with no ghost left from the tab that made the campaign.
  const chips = await second.locator(".cl-avatar-chip").allInnerTexts();
  check(chips.length === 1 && chips[0].includes("GM"), `one seat at the table and it is the DM: ${JSON.stringify(chips)}`);
  await second.screenshot({ path: path.join(OUT, "74-host-is-dm.png") });

  await browser.close();
  if (failures.length) { console.error(`${failures.length} failure(s)`); process.exitCode = 1; } else console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
