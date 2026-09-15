/**
 * Evidence capture: hit-point roll with the dice overlay in the wizard, a skill roll on the sheet, the level-up
 * screen (class, HP roll, only the new choices) and the sheet after. Writes 20-23 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-levelup.mjs
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
try {
  const browser = await chromium.launch({ args: ["--use-gl=swiftshader", "--enable-webgl", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ko-KR" })).newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text().slice(0, 200)); });
  const base = `http://127.0.0.1:${PORT}/`;
  await page.goto(`${base}#/new`);
  await page.getByLabel("이름").fill("카엘");
  await page.getByRole("button", { name: /^2 종족/ }).click();
  await page.getByRole("button", { name: /^엘프/ }).click();
  await page.getByRole("button", { name: /^3 배경/ }).click();
  await page.getByRole("button", { name: /^범죄자/ }).click();
  await page.getByRole("button", { name: /^4 능력치/ }).click();
  await page.getByRole("button", { name: "표준 배열" }).click();
  await page.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await page.getByLabel("추가할 직업").selectOption("dnd.srd521.class.rogue");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "레벨 추가" }).click();
  await page.getByRole("button", { name: /^d8 굴림/ }).first().click();
  await page.waitForSelector(".visual-dice-overlay", { timeout: 5000 });
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(OUT, "20-wizard-hp-roll-dice.png") });
  await page.waitForSelector(".visual-dice-overlay", { state: "detached", timeout: 15000 });
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await page.getByRole("button", { name: /^7 검토·저장/ }).click();
  await page.getByText("막힘 없음").first().waitFor();
  await page.getByRole("button", { name: "저장하고 시트 열기" }).click();
  await page.getByRole("button", { name: "레벨 업" }).waitFor();
  await page.locator(".cl-skill .cl-roll").first().click();
  await page.waitForSelector(".visual-dice-overlay", { timeout: 5000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: path.join(OUT, "21-sheet-skill-roll.png") });
  await page.waitForSelector(".visual-dice-overlay", { state: "detached", timeout: 15000 });
  await page.getByRole("button", { name: "레벨 업" }).click();
  await page.getByRole("button", { name: "+1 레벨" }).click();
  await page.getByRole("button", { name: /d8 굴림/ }).click();
  await page.waitForSelector(".visual-dice-overlay", { state: "detached", timeout: 15000 });
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click().catch(() => {});
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "22-levelup-screen.png"), fullPage: true });
  await page.getByRole("button", { name: "레벨 업 적용" }).click();
  await page.getByText("총 4레벨").first().waitFor();
  await page.screenshot({ path: path.join(OUT, "23-sheet-after-levelup.png") });
  await browser.close();
  console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
