/**
 * Evidence capture for the live sheet (offline session): damage, temp HP, condition, add and equip an item, gold,
 * provenance popovers (AC, attack), short rest with hit dice, activity log. Writes 16-19 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-play.mjs
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
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ko-KR" })).newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  const base = `http://127.0.0.1:${PORT}/`;
  await page.goto(`${base}#/new`);
  await page.getByLabel("이름").fill("브란");
  await page.getByRole("button", { name: /^2 종족/ }).click();
  await page.getByRole("button", { name: /^드워프/ }).click();
  await page.getByRole("button", { name: /^3 배경/ }).click();
  await page.getByRole("button", { name: /^군인/ }).click();
  await page.getByRole("button", { name: /^4 능력치/ }).click();
  await page.getByRole("button", { name: "표준 배열" }).click();
  await page.getByRole("button", { name: /^5 직업·레벨/ }).click();
  await page.getByLabel("추가할 직업").selectOption("dnd.srd521.class.cleric");
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "레벨 추가" }).click();
  await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
  await page.getByRole("button", { name: /^7 검토·저장/ }).click();
  await page.getByText("막힘 없음").first().waitFor();
  await page.getByRole("button", { name: "저장하고 시트 열기" }).click();
  await page.getByRole("button", { name: "짧은 휴식" }).waitFor();
  await page.getByLabel("HP 양").fill("9");
  await page.getByRole("button", { name: "피해", exact: true }).click();
  await page.getByLabel("임시 HP").fill("4");
  await page.getByRole("button", { name: "임시 HP", exact: true }).click();
  await page.getByRole("group", { name: /\/3$/ }).first().locator("button").first().click().catch(() => {});
  await page.getByRole("button", { name: "중독" }).click();
  await page.getByRole("button", { name: "아이템 추가" }).click();
  await page.getByLabel("아이템 검색").fill("장검");
  await page.getByRole("button", { name: /^장검/ }).first().click();
  await page.getByLabel("금화 증감").fill("-15");
  await page.getByRole("button", { name: "적용" }).click();
  await page.getByLabel(/장검 장비/).click();
  await page.locator(".cl-stat .cl-explain").nth(1).hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "16-sheet-play-ac-provenance.png") });
  await page.locator(".cl-table .cl-explain").first().hover();
  await page.waitForTimeout(200);
  await page.screenshot({ path: path.join(OUT, "17-sheet-attack-provenance.png") });
  await page.getByRole("button", { name: "짧은 휴식" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "+", exact: true }).first().click();
  await page.screenshot({ path: path.join(OUT, "18-sheet-short-rest.png") });
  await page.getByRole("button", { name: "휴식 마치기" }).click();
  await page.waitForTimeout(300);
  await page.screenshot({ path: path.join(OUT, "19-sheet-after-rest-log.png"), fullPage: true });
  await browser.close();
  console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
