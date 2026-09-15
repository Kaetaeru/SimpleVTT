/**
 * Evidence capture: feature use (Rage with the round counter), spell casting with the slot picker, the active-effects panel.
 * Writes 24-26 to docs/evidence/new-client-m1.
 *
 *   node scripts/capture-client-use.mjs
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
  const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
  const page = await (await browser.newContext({ viewport: { width: 1380, height: 900 }, locale: "ko-KR" })).newPage();
  page.on("pageerror", (e) => console.error("page error:", e.message));
  page.on("console", (m) => { if (m.type() === "error") console.error("console:", m.text().slice(0, 200)); });
  page.on("dialog", (dialog) => void dialog.accept());
  const base = `http://127.0.0.1:${PORT}/`;
  const create = async (name, species, background, classId, levels) => {
    await page.goto(`${base}#/new`);
    await page.getByLabel("이름").fill(name);
    await page.getByRole("button", { name: /^2 종족/ }).click();
    await page.getByRole("button", { name: new RegExp(`^${species}`) }).click();
    await page.getByRole("button", { name: /^3 배경/ }).click();
    await page.getByRole("button", { name: new RegExp(`^${background}`) }).click();
    await page.getByRole("button", { name: /^4 능력치/ }).click();
    await page.getByRole("button", { name: "표준 배열" }).click();
    await page.getByRole("button", { name: /^5 직업·레벨/ }).click();
    await page.getByLabel("추가할 직업").selectOption(classId);
    for (let i = 0; i < levels; i++) await page.getByRole("button", { name: "레벨 추가" }).click();
    await page.getByRole("button", { name: "남은 선택 빠르게 채우기" }).click();
    await page.getByRole("button", { name: /^7 검토·저장/ }).click();
    await page.getByText("막힘 없음").first().waitFor();
    await page.getByRole("button", { name: "저장하고 시트 열기" }).click();
    await page.getByRole("button", { name: "다음 라운드" }).waitFor();
  };
  // Barbarian: Rage → effect with a round counter; advance three rounds.
  await create("그로크", "드워프", "군인", "dnd.srd521.class.barbarian", 3);
  const rage = page.locator(".cl-feature", { hasText: "격노" }).first();
  await rage.getByRole("button", { name: "사용", exact: true }).click();
  for (let i = 0; i < 3; i++) await page.getByRole("button", { name: "다음 라운드" }).click();
  await page.getByText("3/10 라운드").waitFor();
  await page.screenshot({ path: path.join(OUT, "24-sheet-rage-rounds.png") });
  // Cleric: cast Bless with the slot picker, then a ritual and an instantaneous heal.
  await create("브란", "인간", "신앙 수행자", "dnd.srd521.class.cleric", 3);
  const bless = page.locator(".cl-spell-row", { hasText: "축복" }).first();
  await bless.getByRole("button", { name: /^시전/ }).click();
  await page.screenshot({ path: path.join(OUT, "25-sheet-cast-picker.png") });
  await page.getByRole("group", { name: /축복 시전 방법/ }).getByRole("button", { name: /^2레벨 슬롯/ }).click();
  await page.getByText("집중, 최대 1분").first().waitFor();
  const cure = page.locator(".cl-spell-row", { hasText: "상처 치료" }).first();
  await cure.getByRole("button", { name: /^시전/ }).click();
  await page.getByRole("group", { name: /상처 치료 시전 방법/ }).getByRole("button", { name: /^1레벨 슬롯/ }).click();
  await page.locator(".cl-effect", { hasText: "축복" }).waitFor();
  await page.screenshot({ path: path.join(OUT, "26-sheet-effects-after-cast.png") });
  await browser.close();
  console.log("done");
} finally { if (server) { try { process.kill(-server.pid, "SIGTERM"); } catch {} } }
